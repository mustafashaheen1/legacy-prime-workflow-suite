import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Direct API endpoint for getting business files - bypasses tRPC for better performance
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Get Business Files] Starting request...');

  try {
    const { subcontractorId } = req.query;

    // Validate required fields
    if (!subcontractorId || typeof subcontractorId !== 'string') {
      return res.status(400).json({
        error: 'Missing required query parameter: subcontractorId',
      });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Get Business Files] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Get Business Files] Fetching files for subcontractor:', subcontractorId);

    const { data, error } = await supabase
      .from('business_files')
      .select('*')
      .eq('subcontractor_id', subcontractorId)
      .order('upload_date', { ascending: false });

    console.log('[Get Business Files] Database query completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Get Business Files] Database error:', error);
      return res.status(500).json({
        error: `Failed to fetch business files: ${error.message}`,
      });
    }

    console.log('[Get Business Files] Found', data?.length || 0, 'files. Total time:', Date.now() - startTime, 'ms');

    // Convert to camelCase and return
    const files = (data || []).map((file: any) => ({
      id: file.id,
      subcontractorId: file.subcontractor_id,
      type: file.type,
      name: file.name,
      fileType: file.file_type,
      fileSize: file.file_size,
      uri: file.uri,
      uploadDate: file.upload_date,
      expiryDate: file.expiry_date || undefined,
      verified: file.verified,
      verifiedBy: file.verified_by || undefined,
      verifiedDate: file.verified_date || undefined,
      notes: file.notes || undefined,
    }));

    return res.status(200).json({
      success: true,
      files,
    });
  } catch (error: any) {
    console.error('[Get Business Files] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch business files',
    });
  }
}
