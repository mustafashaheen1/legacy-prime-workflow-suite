import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

/**
 * Send Message API
 * Sends a message to a team conversation
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { conversationId, senderId, type, content, fileName, fileUrl, duration } = req.body;

    // Validation
    if (!conversationId || !senderId || !type) {
      return res.status(400).json({
        error: 'conversationId, senderId, and type are required'
      });
    }

    if (type === 'text' && !content) {
      return res.status(400).json({ error: 'content is required for text messages' });
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
      .eq('user_id', senderId)
      .single();

    if (participantError || !participant) {
      return res.status(403).json({
        error: 'User is not a participant in this conversation'
      });
    }

    // Insert message
    const messageData: any = {
      conversation_id: conversationId,
      sender_id: senderId,
      type,
    };

    if (content) messageData.content = content;
    if (fileName) messageData.file_name = fileName;
    if (fileUrl) messageData.file_url = fileUrl;
    if (duration) messageData.duration = duration;

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert(messageData)
      .select('*')
      .single();

    if (messageError) {
      console.error('[Send Message] Database error:', messageError);
      throw new Error(messageError.message);
    }

    console.log('[Send Message] Message sent successfully:', message.id);

    // Fetch sender info for response
    const { data: sender } = await supabase
      .from('users')
      .select('name, avatar')
      .eq('id', senderId)
      .single();

    return res.status(200).json({
      success: true,
      message: {
        ...message,
        sender: sender || { name: 'Unknown', avatar: null },
      },
    });
  } catch (error: any) {
    console.error('[Send Message] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to send message',
    });
  }
}
