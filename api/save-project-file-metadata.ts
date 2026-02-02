import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[SaveProjectFileMetadata] API route started');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      companyId,
      projectId,
      fileName,
      fileType,
      fileSize,
      category,
      s3Key,
      s3Url,
      notes,
    } = req.body;

    console.log('[SaveProjectFileMetadata] Request:', {
      fileName,
      fileType,
      fileSize,
      companyId,
      projectId,
      category,
    });

    if (!companyId || !projectId || !fileName || !fileType || !category || !s3Key || !s3Url) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[SaveProjectFileMetadata] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[SaveProjectFileMetadata] Saving to database...');

    // Save file metadata to database
    const { data, error } = await supabase
      .from('project_files')
      .insert({
        company_id: companyId,
        project_id: projectId,
        name: fileName,
        category,
        file_type: fileType,
        file_size: fileSize,
        uri: s3Url,
        s3_key: s3Key,
        notes: notes || null,
        upload_date: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[SaveProjectFileMetadata] Database error:', error);
      return res.status(500).json({ error: `Failed to save file metadata: ${error.message}` });
    }

    console.log('[SaveProjectFileMetadata] File metadata saved:', data.id);

    return res.status(200).json({
      success: true,
      file: {
        id: data.id,
        projectId: data.project_id,
        name: data.name,
        category: data.category,
        fileType: data.file_type,
        fileSize: data.file_size,
        uri: data.uri,
        s3Key: data.s3_key,
        notes: data.notes,
        uploadDate: data.upload_date,
      },
    });
  } catch (error: any) {
    console.error('[SaveProjectFileMetadata] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to save file metadata',
    });
  }
}
