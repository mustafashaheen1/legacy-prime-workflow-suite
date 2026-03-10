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
      .from('conversation_participants')
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
      .from('messages')
      .select(`
        *,
        users (
          id,
          name,
          avatar
        ),
        reply_msg:reply_to (
          id,
          sender_id,
          type,
          content,
          file_name,
          users (
            id,
            name
          )
        )
      `)
      .eq('conversation_id', conversationId)
      .or('is_deleted.eq.false,is_deleted.is.null')
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[Get Messages] Database error:', messagesError);
      throw new Error(messagesError.message);
    }

    // Transform messages to include sender info and reply_to data
    const transformedMessages = (messages || []).map(msg => {
      const replyMsg = msg.reply_msg as any;
      return {
        id: msg.id,
        senderId: msg.sender_id,
        type: msg.type,
        content: msg.content,
        text: msg.content, // Alias for compatibility
        fileName: msg.file_name,
        fileUrl: msg.file_url,
        duration: msg.duration,
        timestamp: msg.created_at,
        createdAt: msg.created_at,
        sender: msg.users || { id: msg.sender_id, name: 'Unknown', avatar: null },
        replyTo: replyMsg ? {
          id: replyMsg.id,
          senderId: replyMsg.sender_id,
          senderName: (replyMsg.users as any)?.name || 'Unknown',
          type: replyMsg.type,
          text: replyMsg.content,
          content: replyMsg.content,
          fileName: replyMsg.file_name,
        } : undefined,
      };
    });

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
