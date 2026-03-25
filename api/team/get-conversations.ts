import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

/**
 * Get Conversations API
 * Fetches all conversations for a user with participant info, last message,
 * unread count, and other participant's last_read_at (for read receipts).
 *
 * Batched: 3 total DB queries regardless of conversation count (was N×3).
 *   Batch A — all participants for all conversations
 *   Batch B — recent messages for all conversations (last-per-conv resolved in JS)
 *   Batch C — all potentially-unread messages since oldest last_read_at (count in JS)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── Step 1: Fetch this user's conversation participations (1 query) ───────
    const { data: participations, error: participationsError } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        last_read_at,
        conversations (
          id,
          name,
          type,
          created_at,
          updated_at,
          last_message_at
        )
      `)
      .eq('user_id', userId);

    if (participationsError) {
      console.error('[Get Conversations] Database error:', participationsError);
      throw new Error(participationsError.message);
    }

    if (!participations || participations.length === 0) {
      return res.status(200).json({ success: true, conversations: [] });
    }

    // Extract valid conversation IDs and build per-conv last_read_at lookup
    const convIds: string[] = [];
    const myLastReadByConv: Record<string, string> = {};

    for (const p of participations as any[]) {
      const id = p.conversations?.id;
      if (id) {
        convIds.push(id);
        myLastReadByConv[id] = p.last_read_at || '1970-01-01T00:00:00.000Z';
      }
    }

    // Oldest last_read_at across all conversations — used as lower bound for
    // the unread batch query so we fetch the minimum data needed.
    const minLastReadAt = Object.values(myLastReadByConv).reduce(
      (min, t) => (t < min ? t : min),
      new Date().toISOString()
    );

    // ── Step 2: Run all batch queries in parallel ─────────────────────────────
    //
    // Batch B was previously a single query with limit(convIds.length * 3).
    // This caused "No messages yet" for all conversations except the most active
    // one: if Henry has 50+ messages, all 50 fetched rows came from Henry and
    // every other conversation got zero rows → lastMessage: null.
    //
    // Fix: one limit(1) query per conversation, all run in parallel inside the
    // same Promise.all. Each returns exactly the most-recent non-deleted message
    // for that conversation. Wall time = max(single query) ≈ same as before.
    const lastMsgQueries = convIds.map((id) =>
      supabase
        .from('messages')
        .select('content, type, created_at, sender_id, file_name, conversation_id')
        .eq('conversation_id', id)
        .or('is_deleted.eq.false,is_deleted.is.null')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    );

    const [allParticipantsResult, unreadMessagesResult, ...lastMsgResults] = await Promise.all([

      // Batch A: ALL participants for ALL conversations in one query
      supabase
        .from('conversation_participants')
        .select(`
          user_id,
          last_read_at,
          conversation_id,
          users (
            id,
            name,
            email,
            avatar,
            role
          )
        `)
        .in('conversation_id', convIds),

      // Batch C: All potentially-unread messages since the oldest last_read_at.
      // Capped at 500 rows — more than enough to count unread badges accurately.
      supabase
        .from('messages')
        .select('id, conversation_id, sender_id, created_at')
        .in('conversation_id', convIds)
        .neq('sender_id', userId)
        .or('is_deleted.eq.false,is_deleted.is.null')
        .gt('created_at', minLastReadAt)
        .order('created_at', { ascending: false })
        .limit(500),

      // Batch B: last message per conversation (one query each, all parallel)
      ...lastMsgQueries,
    ]);

    // ── Step 3: Build lookup maps from batch results ──────────────────────────

    // Group participants by conversation_id
    const participantsByConv: Record<string, any[]> = {};
    for (const p of (allParticipantsResult.data || []) as any[]) {
      if (!participantsByConv[p.conversation_id]) participantsByConv[p.conversation_id] = [];
      participantsByConv[p.conversation_id].push(p);
    }

    // Last message per conversation — one result per convId, same index order
    const lastMessageByConv: Record<string, any> = {};
    (lastMsgResults as any[]).forEach((result, i) => {
      if (!result.error && result.data) {
        lastMessageByConv[convIds[i]] = result.data;
      }
    });

    // Unread count per conversation (filter by each conv's last_read_at in JS)
    const unreadByConv: Record<string, number> = {};
    for (const msg of (unreadMessagesResult.data || []) as any[]) {
      const myLastRead = myLastReadByConv[msg.conversation_id] || '1970-01-01T00:00:00.000Z';
      if (msg.created_at > myLastRead) {
        unreadByConv[msg.conversation_id] = (unreadByConv[msg.conversation_id] || 0) + 1;
      }
    }

    // ── Step 4: Assemble final conversation objects ───────────────────────────
    const conversations = (participations as any[])
      .map((p: any) => {
        const conv = p.conversations;
        if (!conv) return null;

        const participants = participantsByConv[conv.id] || [];
        const lastMessage = lastMessageByConv[conv.id] || null;
        const unreadCount = unreadByConv[conv.id] || 0;

        let conversationName = conv.name;
        let conversationAvatar: string | null = null;
        let otherLastReadAt: string | null = null;

        if (conv.type === 'individual') {
          const otherParticipant = participants.find((pt: any) => pt.user_id !== userId);
          if (otherParticipant?.users) {
            const u = otherParticipant.users as any;
            conversationName = u.name;
            conversationAvatar = u.avatar || null;
          }
          otherLastReadAt = otherParticipant?.last_read_at || null;
        }

        return {
          id: conv.id,
          name: conversationName,
          type: conv.type,
          avatar: conversationAvatar,
          participants: participants.map((pt: any) => pt.users).filter(Boolean),
          lastMessage: lastMessage || null,
          lastMessageAt: conv.last_message_at || lastMessage?.created_at || null,
          lastReadAt: p.last_read_at,
          unreadCount,
          otherLastReadAt,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
        };
      })
      .filter((c) => c !== null)
      .sort((a, b) => {
        const aTime = a.lastMessageAt || a.createdAt;
        const bTime = b.lastMessageAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

    console.log('[Get Conversations] Fetched', conversations.length, 'conversations for user:', userId);

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error: any) {
    console.error('[Get Conversations] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch conversations',
    });
  }
}
