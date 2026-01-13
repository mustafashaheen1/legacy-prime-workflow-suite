import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Direct API endpoint for verifying business files - bypasses tRPC for better performance
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Verify Business File] Starting request...');

  try {
    const { fileId, verified, verifiedBy, notes } = req.body;

    // Validate required fields
    if (!fileId || verified === undefined || !verifiedBy) {
      return res.status(400).json({
        error: 'Missing required fields: fileId, verified, verifiedBy',
      });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Verify Business File] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const verifiedDate = new Date().toISOString();

    console.log('[Verify Business File] Updating file:', fileId, 'verified:', verified);

    const { data, error } = await supabase
      .from('business_files')
      .update({
        verified,
        verified_by: verifiedBy,
        verified_date: verifiedDate,
        notes: notes || null,
      })
      .eq('id', fileId)
      .select()
      .single();

    console.log('[Verify Business File] Database update completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Verify Business File] Database error:', error);
      return res.status(500).json({
        error: `Failed to verify file: ${error.message}`,
      });
    }

    console.log('[Verify Business File] Success:', data.id, 'Total time:', Date.now() - startTime, 'ms');

    // Return the updated file data
    return res.status(200).json({
      success: true,
      id: data.id,
      subcontractorId: data.subcontractor_id,
      type: data.type,
      name: data.name,
      fileType: data.file_type,
      fileSize: data.file_size,
      uri: data.uri,
      uploadDate: data.upload_date,
      expiryDate: data.expiry_date || undefined,
      verified: data.verified,
      verifiedBy: data.verified_by || undefined,
      verifiedDate: data.verified_date || undefined,
      notes: data.notes || undefined,
    });
  } catch (error: any) {
    console.error('[Verify Business File] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to verify file',
    });
  }
}
