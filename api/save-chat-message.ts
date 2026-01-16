import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// API endpoint to save an AI chat message
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, role, content, files = [], metadata = null } = req.body;

    // Validate required fields
    if (!userId || !role || !content) {
      return res.status(400).json({
        error: 'Missing required fields: userId, role, content',
      });
    }

    // Validate role
    if (!['user', 'assistant'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid role. Must be "user" or "assistant"',
      });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[SaveChatMessage] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[SaveChatMessage] Saving message for user:', userId, 'role:', role);

    const { data, error } = await supabase
      .from('ai_chat_messages')
      .insert({
        user_id: userId,
        role,
        content,
        files,
        metadata,
      })
      .select()
      .single();

    if (error) {
      console.error('[SaveChatMessage] Database error:', error);
      return res.status(500).json({ error: `Failed to save message: ${error.message}` });
    }

    console.log('[SaveChatMessage] Message saved:', data.id);

    return res.status(200).json({
      success: true,
      id: data.id,
      userId: data.user_id,
      role: data.role,
      content: data.content,
      createdAt: data.created_at,
      files: data.files,
      metadata: data.metadata,
    });
  } catch (error: any) {
    console.error('[SaveChatMessage] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save message' });
  }
}
