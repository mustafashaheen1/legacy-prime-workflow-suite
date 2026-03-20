import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'File ID is required' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch file metadata to get s3_key
    const { data: file, error: fetchError } = await supabase
      .from('project_files')
      .select('id, s3_key')
      .eq('id', id)
      .single();

    if (fetchError || !file) {
      console.error('[DeleteProjectFile] File not found:', id, fetchError?.message);
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from S3 (non-fatal if it fails)
    if (file.s3_key) {
      try {
        const s3 = new S3Client({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });

        const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET;
        if (bucketName) {
          await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: file.s3_key }));
          console.log('[DeleteProjectFile] S3 object deleted:', file.s3_key);
        }
      } catch (s3Err: any) {
        console.warn('[DeleteProjectFile] S3 deletion failed (non-fatal):', s3Err.message);
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('project_files')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[DeleteProjectFile] DB delete error:', deleteError.message);
      return res.status(500).json({ error: deleteError.message });
    }

    console.log('[DeleteProjectFile] Deleted file:', id);
    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('[DeleteProjectFile] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Failed to delete file' });
  }
}
