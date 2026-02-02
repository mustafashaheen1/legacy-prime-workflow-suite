import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[ResolveFileLink] ===== API ROUTE STARTED =====');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.query;

    console.log('[ResolveFileLink] Resolving code:', code);

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid short code' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[ResolveFileLink] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lookup short code in database
    const { data, error } = await supabase
      .from('file_share_links')
      .select('*')
      .eq('short_code', code)
      .single();

    if (error || !data) {
      console.error('[ResolveFileLink] Link not found:', error);
      return res.status(404).json({ error: 'Link not found or expired' });
    }

    console.log('[ResolveFileLink] Found link:', data.file_name);

    // Check if link has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      console.log('[ResolveFileLink] Link has expired:', data.expires_at);
      return res.status(410).json({ error: 'Link has expired' });
    }

    // Increment view count and update last viewed timestamp
    const { error: updateError } = await supabase
      .from('file_share_links')
      .update({
        view_count: (data.view_count || 0) + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq('id', data.id);

    if (updateError) {
      console.error('[ResolveFileLink] Failed to update view count:', updateError);
      // Don't fail the request, just log the error
    }

    console.log('[ResolveFileLink] ===== API ROUTE COMPLETED =====');
    console.log('[ResolveFileLink] View count:', (data.view_count || 0) + 1);

    // Return file info (frontend will handle download/redirect)
    return res.status(200).json({
      success: true,
      fileName: data.file_name,
      fileType: data.file_type,
      fileSize: data.file_size,
      s3Url: data.s3_url,
      expiresAt: data.expires_at,
      viewCount: (data.view_count || 0) + 1,
    });
  } catch (error: any) {
    console.error('[ResolveFileLink] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to resolve link',
    });
  }
}
