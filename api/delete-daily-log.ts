import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'legacy-prime-construction-media';

/**
 * Delete files from S3
 */
async function cleanupS3Files(keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      await s3Client.send(command);
      console.log('[S3] Deleted file:', key);
    } catch (error: any) {
      console.error('[S3] Failed to delete file:', key, error);
    }
  }
}

export const config = {
  maxDuration: 30,
};

// Direct API endpoint for deleting daily logs
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Delete Daily Log] Starting request...');

  try {
    const { dailyLogId, companyId } = req.body;

    // Validate required fields
    if (!dailyLogId) {
      return res.status(400).json({ error: 'Missing required field: dailyLogId' });
    }
    if (!companyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Delete Daily Log] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Delete Daily Log] Deleting daily log:', dailyLogId);

    // 1. Get all photos associated with this daily log to delete from S3
    const { data: photos, error: photosError } = await supabase
      .from('daily_log_photos')
      .select('uri')
      .eq('daily_log_id', dailyLogId);

    if (photosError) {
      console.error('[Delete Daily Log] Error fetching photos:', photosError);
    }

    // Extract S3 keys from photo URIs
    const s3Keys: string[] = [];
    if (photos && photos.length > 0) {
      for (const photo of photos) {
        if (photo.uri && photo.uri.includes(BUCKET_NAME)) {
          // Extract key from S3 URL
          // Format: https://bucket.s3.region.amazonaws.com/key
          const urlParts = photo.uri.split(`${BUCKET_NAME}.s3.`);
          if (urlParts.length > 1) {
            const key = urlParts[1].split('.amazonaws.com/')[1];
            if (key) {
              s3Keys.push(key);
            }
          }
        }
      }
      console.log('[Delete Daily Log] Found', s3Keys.length, 'S3 files to delete');
    }

    // 2. Verify the daily log belongs to the company
    const { data: dailyLog, error: verifyError } = await supabase
      .from('daily_logs')
      .select('id, company_id')
      .eq('id', dailyLogId)
      .eq('company_id', companyId)
      .single();

    if (verifyError || !dailyLog) {
      console.error('[Delete Daily Log] Daily log not found or unauthorized');
      return res.status(404).json({ error: 'Daily log not found or unauthorized' });
    }

    // 3. Delete from database (cascade will delete tasks and photos)
    const { error: deleteError } = await supabase
      .from('daily_logs')
      .delete()
      .eq('id', dailyLogId)
      .eq('company_id', companyId);

    if (deleteError) {
      console.error('[Delete Daily Log] Database error:', deleteError);
      return res.status(500).json({ error: `Failed to delete daily log: ${deleteError.message}` });
    }

    console.log('[Delete Daily Log] Database records deleted');

    // 4. Clean up S3 files
    if (s3Keys.length > 0) {
      await cleanupS3Files(s3Keys);
      console.log('[Delete Daily Log] S3 cleanup complete');
    }

    console.log('[Delete Daily Log] Success. Total time:', Date.now() - startTime, 'ms');

    return res.status(200).json({
      success: true,
      message: 'Daily log deleted successfully',
    });
  } catch (error: any) {
    console.error('[Delete Daily Log] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to delete daily log',
    });
  }
}
