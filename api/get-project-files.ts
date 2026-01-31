import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[GetProjectFiles] ===== API ROUTE STARTED =====');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, companyId } = req.query;

    if (!projectId || !companyId) {
      return res.status(400).json({ error: 'Missing required query params: projectId, companyId' });
    }

    console.log('[GetProjectFiles] Fetching files for project:', projectId);

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[GetProjectFiles] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .eq('company_id', companyId)
      .order('upload_date', { ascending: false });

    if (error) {
      console.error('[GetProjectFiles] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    const files = (data || []).map((file: any) => ({
      id: file.id,
      projectId: file.project_id,
      name: file.name,
      category: file.category,
      fileType: file.file_type,
      fileSize: file.file_size,
      uri: file.uri, // Database uses 'uri' column
      s3Key: file.s3_key,
      notes: file.notes,
      uploadDate: file.upload_date,
    }));

    console.log('[GetProjectFiles] ===== API ROUTE COMPLETED =====');
    console.log('[GetProjectFiles] Found', files.length, 'files');

    return res.status(200).json({
      success: true,
      files,
    });
  } catch (error: any) {
    console.error('[GetProjectFiles] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
