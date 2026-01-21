import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// API endpoint to fetch AI chat history for a user
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, limit = '200' } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'Missing required parameter: userId' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[GetChatHistory] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const messageLimit = Math.min(parseInt(limit as string, 10) || 200, 500);

    console.log('[GetChatHistory] Fetching messages for user:', userId, 'limit:', messageLimit);

    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(messageLimit);

    if (error) {
      console.error('[GetChatHistory] Database error:', error);
      return res.status(500).json({ error: `Failed to fetch chat history: ${error.message}` });
    }

    console.log('[GetChatHistory] Found', data?.length || 0, 'messages');

    // Convert to frontend format
    const messages = (data || []).map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      text: msg.content,
      files: msg.files || [],
      createdAt: msg.created_at,
      parts: [{ type: 'text', text: msg.content }],
      // Include metadata for estimate links and takeoff links
      ...(msg.metadata?.estimateLink && { estimateLink: msg.metadata.estimateLink }),
      ...(msg.metadata?.takeoffLink && { takeoffLink: msg.metadata.takeoffLink }),
    }));

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error: any) {
    console.error('[GetChatHistory] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch chat history' });
  }
}
