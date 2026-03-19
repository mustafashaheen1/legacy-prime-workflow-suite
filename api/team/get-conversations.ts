import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

/**
 * Get Conversations API
 * Fetches all conversations for a user with participant info, last message,
 * unread count, and other participant's last_read_at (for read receipts).
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

    // Fetch user's conversation participations
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

    const conversations = await Promise.all(
      (participations || []).map(async (p: any) => {
        const conv = p.conversations;
        if (!conv) return null;

        const lastReadAt = p.last_read_at as string | null;

        // Run all queries for this conversation in parallel
        const [participantsResult, lastMessageResult, unreadResult] = await Promise.all([
          // Participants WITH their last_read_at (needed for read receipts)
          supabase
            .from('conversation_participants')
            .select(`
              user_id,
              last_read_at,
              users (
                id,
                name,
                email,
                avatar,
                role
              )
            `)
            .eq('conversation_id', conv.id),

          // Last non-deleted message
          supabase
            .from('messages')
            .select('content, type, created_at, sender_id, file_name')
            .eq('conversation_id', conv.id)
            .or('is_deleted.eq.false,is_deleted.is.null')
            .order('created_at', { ascending: false })
            .limit(1)
            .single(),

          // Count messages since this user's last_read_at (that weren't sent by them)
          supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', userId)
            .or('is_deleted.eq.false,is_deleted.is.null')
            .gt('created_at', lastReadAt || '1970-01-01T00:00:00.000Z'),
        ]);

        const participants = participantsResult.data || [];
        const lastMessage = lastMessageResult.data || null;
        const unreadCount = unreadResult.count ?? 0;

        // For individual chats: use other participant's name/avatar and their last_read_at
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
          lastReadAt,
          // New fields for WhatsApp-like UX
          unreadCount,
          otherLastReadAt,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
        };
      })
    );

    const validConversations = conversations
      .filter((c) => c !== null)
      .sort((a, b) => {
        const aTime = a.lastMessageAt || a.createdAt;
        const bTime = b.lastMessageAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

    console.log('[Get Conversations] Fetched', validConversations.length, 'conversations for user:', userId);

    return res.status(200).json({
      success: true,
      conversations: validConversations,
    });
  } catch (error: any) {
    console.error('[Get Conversations] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch conversations',
    });
  }
}
