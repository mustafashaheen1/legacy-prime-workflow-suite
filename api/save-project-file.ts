import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[SaveProjectFile] ===== API ROUTE STARTED =====');
  console.log('[SaveProjectFile] Method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, projectId, name, category, fileType, fileSize, url, s3Key, notes } = req.body;

    console.log('[SaveProjectFile] Saving file for project:', projectId);

    // Validate required fields
    if (!companyId || !projectId || !name || !category || !url) {
      console.log('[SaveProjectFile] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: companyId, projectId, name, category, url' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[SaveProjectFile] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[SaveProjectFile] Inserting into database...');

    const { data, error } = await supabase
      .from('project_files')
      .insert({
        company_id: companyId,
        project_id: projectId,
        name,
        category,
        file_type: fileType || 'unknown',
        file_size: fileSize || 0,
        uri: url, // Database uses 'uri' column
        s3_key: s3Key || null,
        notes: notes || null,
        upload_date: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[SaveProjectFile] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[SaveProjectFile] ===== API ROUTE COMPLETED =====');
    console.log('[SaveProjectFile] File saved:', data.id);

    return res.status(200).json({
      success: true,
      file: {
        id: data.id,
        projectId: data.project_id,
        name: data.name,
        category: data.category,
        fileType: data.file_type,
        fileSize: data.file_size,
        uri: data.uri, // Return as 'uri' to match interface
        s3Key: data.s3_key,
        notes: data.notes,
        uploadDate: data.upload_date,
      },
    });
  } catch (error: any) {
    console.error('[SaveProjectFile] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
