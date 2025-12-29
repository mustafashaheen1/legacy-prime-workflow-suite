import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[CompleteInspectionVideo] ===== API ROUTE STARTED =====');
  console.log('[CompleteInspectionVideo] Method:', req.method);

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('[CompleteInspectionVideo] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, videoKey, videoDuration, videoSize } = req.body;

    console.log('[CompleteInspectionVideo] Completing video upload for token:', token);

    // Validate required fields
    if (!token || !videoKey) {
      console.log('[CompleteInspectionVideo] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[CompleteInspectionVideo] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('[CompleteInspectionVideo] Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[CompleteInspectionVideo] Updating database...');
    const updateStart = Date.now();

    const { data, error } = await supabase
      .from('inspection_videos')
      .update({
        status: 'completed',
        video_url: videoKey,
        video_duration: videoDuration || null,
        video_size: videoSize || null,
        completed_at: new Date().toISOString(),
      })
      .eq('token', token)
      .select()
      .single();

    const updateDuration = Date.now() - updateStart;
    console.log(`[CompleteInspectionVideo] Database UPDATE completed in ${updateDuration}ms`);

    if (error) {
      console.error('[CompleteInspectionVideo] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[CompleteInspectionVideo] ===== API ROUTE COMPLETED =====');
    console.log('[CompleteInspectionVideo] Inspection ID:', data.id);

    return res.status(200).json({
      success: true,
      inspectionId: data.id,
      status: data.status,
      updateDuration,
    });
  } catch (error: any) {
    console.error('[CompleteInspectionVideo] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
      stack: error.stack?.substring(0, 500),
    });
  }
}
