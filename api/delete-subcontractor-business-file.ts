import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Delete Subcontractor Business File] Starting request...');

  try {
    const { id, token } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'File ID is required' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Delete Subcontractor Business File] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get file metadata
    const { data: file, error: fetchError } = await supabase
      .from('business_files')
      .select('id, subcontractor_id, s3_key')
      .eq('id', id)
      .single();

    if (fetchError || !file) {
      console.error('[Delete Subcontractor Business File] File not found:', id);
      return res.status(404).json({ error: 'File not found' });
    }

    // Validate token if provided (during registration)
    if (token && typeof token === 'string') {
      const { data: subcontractor, error: tokenError } = await supabase
        .from('subcontractors')
        .select('id, registration_token_expiry')
        .eq('registration_token', token)
        .eq('id', file.subcontractor_id)
        .single();

      if (tokenError || !subcontractor) {
        console.error('[Delete Subcontractor Business File] Invalid token');
        return res.status(401).json({ error: 'Invalid registration token' });
      }

      // Check if token expired
      const expiryDate = new Date(subcontractor.registration_token_expiry);
      const now = new Date();

      if (now > expiryDate) {
        console.error('[Delete Subcontractor Business File] Token expired');
        return res.status(401).json({ error: 'Registration link has expired' });
      }
    }

    // Delete from S3
    if (file.s3_key) {
      try {
        const s3Client = new S3Client({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          },
        });

        const bucketName = process.env.AWS_S3_BUCKET;
        if (!bucketName) {
          console.error('[Delete Subcontractor Business File] S3 bucket not configured');
          return res.status(500).json({ error: 'S3 bucket not configured' });
        }

        const deleteCommand = new DeleteObjectCommand({
          Bucket: bucketName,
          Key: file.s3_key,
        });

        await s3Client.send(deleteCommand);
        console.log('[Delete Subcontractor Business File] File deleted from S3:', file.s3_key);
      } catch (s3Error: any) {
        console.error('[Delete Subcontractor Business File] S3 deletion error:', s3Error);
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('business_files')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('[Delete Subcontractor Business File] Database error:', deleteError);
      return res.status(500).json({
        error: `Failed to delete file metadata: ${deleteError.message}`,
      });
    }

    console.log('[Delete Subcontractor Business File] Success:', id);

    return res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    console.error('[Delete Subcontractor Business File] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to delete file',
    });
  }
}
