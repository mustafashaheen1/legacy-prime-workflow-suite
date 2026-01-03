import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

/**
 * Get Messages API
 * Fetches all messages for a specific conversation
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { conversationId, userId } = req.query;

    if (!conversationId || typeof conversationId !== 'string') {
      return res.status(400).json({ error: 'conversationId is required' });
    }

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

    // Verify user is participant in conversation
    const { data: participant, error: participantError } = await supabase
      .from('team_conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({
        error: 'User is not a participant in this conversation'
      });
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('team_messages')
      .select(`
        *,
        team_users (
          id,
          name,
          avatar_url
        )
      `)
      .eq('conversation_id', conversationId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[Get Messages] Database error:', messagesError);
      throw new Error(messagesError.message);
    }

    // Transform messages to include sender info
    const transformedMessages = (messages || []).map(msg => ({
      id: msg.id,
      senderId: msg.sender_id,
      type: msg.type,
      content: msg.content,
      text: msg.content, // Alias for compatibility
      fileName: msg.file_name,
      fileUrl: msg.file_url,
      duration: msg.duration,
      timestamp: new Date(msg.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }),
      createdAt: msg.created_at,
      sender: msg.team_users || { id: msg.sender_id, name: 'Unknown', avatar_url: null },
    }));

    console.log('[Get Messages] Fetched', transformedMessages.length, 'messages for conversation:', conversationId);

    return res.status(200).json({
      success: true,
      messages: transformedMessages,
    });
  } catch (error: any) {
    console.error('[Get Messages] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch messages',
    });
  }
}
