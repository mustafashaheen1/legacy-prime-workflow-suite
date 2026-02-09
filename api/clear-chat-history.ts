/**
 * Clear Chat History API
 * Deletes all chat messages for a user
 * Platform: iOS, Android, Web
 * Runtime: Node.js (Vercel Serverless)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId'
      });
    }

    console.log('[Clear Chat] Clearing chat history for user:', userId);

    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete all chat messages for this user
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[Clear Chat] Database error:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    console.log('[Clear Chat] ✅ Chat history cleared successfully');

    return res.status(200).json({
      success: true,
      message: 'Chat history cleared successfully'
    });

  } catch (error: any) {
    console.error('[Clear Chat] Exception:', error.message || error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
