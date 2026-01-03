import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

/**
 * Get Conversations API
 * Fetches all conversations for a user with participant info and last message
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
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

    // Initialize Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch conversations where user is a participant
    const { data: participations, error: participationsError } = await supabase
      .from('team_conversation_participants')
      .select(`
        conversation_id,
        team_conversations (
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

    // Extract conversations and fetch additional data
    const conversations = await Promise.all(
      (participations || []).map(async (p: any) => {
        const conv = p.team_conversations;
        if (!conv) return null;

        // Fetch all participants for this conversation
        const { data: participants } = await supabase
          .from('team_conversation_participants')
          .select(`
            user_id,
            team_users (
              id,
              name,
              email,
              avatar_url,
              role
            )
          `)
          .eq('conversation_id', conv.id);

        // Fetch last message
        const { data: lastMessage } = await supabase
          .from('team_messages')
          .select('content, type, created_at, sender_id')
          .eq('conversation_id', conv.id)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // For individual chats, use the other participant's info
        let conversationName = conv.name;
        let conversationAvatar = null;

        if (conv.type === 'individual') {
          const otherParticipant = participants?.find(
            (p: any) => p.user_id !== userId
          );
          if (otherParticipant?.team_users) {
            conversationName = otherParticipant.team_users.name;
            conversationAvatar = otherParticipant.team_users.avatar_url;
          }
        }

        return {
          id: conv.id,
          name: conversationName,
          type: conv.type,
          avatar: conversationAvatar,
          participants: participants?.map((p: any) => p.team_users).filter(Boolean) || [],
          lastMessage: lastMessage || null,
          lastMessageAt: conv.last_message_at,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
        };
      })
    );

    // Filter out null conversations and sort by last message
    const validConversations = conversations
      .filter(c => c !== null)
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
