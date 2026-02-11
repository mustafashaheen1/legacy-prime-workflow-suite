import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// API endpoint to fetch AI chat history for a user
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    // Get the most recent messages (descending order) then reverse to show oldest-first
    const { data, error } = await supabase
      .from('ai_chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(messageLimit);

    if (error) {
      console.error('[GetChatHistory] Database error:', error);
      return res.status(500).json({ error: `Failed to fetch chat history: ${error.message}` });
    }

    console.log('[GetChatHistory] Found', data?.length || 0, 'messages');

    // Reverse the array to show oldest messages first (they came back newest-first from DB)
    const reversedData = (data || []).reverse();

    // Convert to frontend format
    const messages = reversedData.map((msg: any) => {
      // Parse metadata if it's a string (sometimes Supabase returns JSONB as string)
      let metadata = msg.metadata;
      if (typeof metadata === 'string') {
        try {
          metadata = JSON.parse(metadata);
        } catch (e) {
          console.error('[GetChatHistory] Failed to parse metadata:', e);
          metadata = null;
        }
      }

      return {
        id: msg.id,
        role: msg.role,
        text: msg.content,
        files: msg.files || [],
        createdAt: msg.created_at,
        parts: [{ type: 'text', text: msg.content }],
        // Include metadata for estimate links and takeoff links
        ...(metadata?.estimateLink && { estimateLink: metadata.estimateLink }),
        ...(metadata?.takeoffLink && { takeoffLink: metadata.takeoffLink }),
      };
    });

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error: any) {
    console.error('[GetChatHistory] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch chat history' });
  }
}
