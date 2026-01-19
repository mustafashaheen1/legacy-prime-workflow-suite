import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'legacy-prime-construction-media';

const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760'); // 10MB default

/**
 * Convert base64 string to Buffer
 */
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  return Buffer.from(base64Data, 'base64');
}

/**
 * Generate S3 key for daily log photo
 */
function generateDailyLogPhotoKey(params: {
  companyId: string;
  projectId: string;
  fileName: string;
}): string {
  const { companyId, projectId, fileName } = params;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  const extension = fileName.split('.').pop() || 'jpg';
  const key = `company-${companyId}/project-${projectId}/daily-logs/${timestamp}-${random}.${extension}`;
  return key;
}

/**
 * Upload a file buffer to S3
 */
async function uploadToS3(params: {
  buffer: Buffer;
  key: string;
  contentType: string;
}): Promise<{ url: string; key: string }> {
  const { buffer, key, contentType } = params;

  console.log('[S3] Uploading file:', {
    key,
    contentType,
    size: buffer.length,
    bucket: BUCKET_NAME,
  });

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
    console.log('[S3] Upload successful:', url);
    return { url, key };
  } catch (error: any) {
    console.error('[S3] Upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

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

/**
 * Resolve user name to user UUID
 */
async function resolveUserId(
  supabase: any,
  companyId: string,
  userName: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', userName)
    .single();

  if (error) {
    console.error('[User Resolve] Error finding user:', userName, error);
    return null;
  }

  return data?.id || null;
}

/**
 * Resolve emails to user UUIDs
 */
async function resolveSharedWithIds(
  supabase: any,
  companyId: string,
  emails: string[]
): Promise<string[]> {
  if (!emails || emails.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('company_id', companyId)
    .in('email', emails);

  if (error) {
    console.error('[Shared With Resolve] Error finding users:', error);
    return [];
  }

  const resolvedIds = (data || []).map((u: any) => u.id);
  const unmatchedEmails = emails.filter(
    (email) => !data?.find((u: any) => u.email === email)
  );

  if (unmatchedEmails.length > 0) {
    console.warn('[Shared With Resolve] Unmatched emails:', unmatchedEmails.join(', '));
  }

  return resolvedIds;
}

/**
 * Upload daily log photos to S3
 */
async function uploadDailyLogPhotos(
  photos: Array<{
    id: string;
    fileData: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    author: string;
    notes?: string;
  }>,
  companyId: string,
  projectId: string
): Promise<Array<{
  id: string;
  s3Url: string;
  s3Key: string;
  author: string;
  notes?: string;
}>> {
  const uploadedPhotos: Array<{
    id: string;
    s3Url: string;
    s3Key: string;
    author: string;
    notes?: string;
  }> = [];

  for (const photo of photos) {
    try {
      // Convert base64 to buffer
      const fileBuffer = base64ToBuffer(photo.fileData);

      // Generate S3 key
      const s3Key = generateDailyLogPhotoKey({
        companyId,
        projectId,
        fileName: photo.fileName,
      });

      // Upload to S3
      const { url: s3Url } = await uploadToS3({
        buffer: fileBuffer,
        key: s3Key,
        contentType: photo.mimeType,
      });

      uploadedPhotos.push({
        id: photo.id,
        s3Url,
        s3Key,
        author: photo.author,
        notes: photo.notes,
      });

      console.log('[Daily Log Photo] Uploaded:', photo.fileName);
    } catch (error: any) {
      console.error('[Daily Log Photo] Upload failed:', photo.fileName, error);
      // Continue with other photos, skip failed ones
    }
  }

  return uploadedPhotos;
}

/**
 * Rollback daily log and cleanup S3 files
 */
async function rollbackDailyLog(
  supabase: any,
  dailyLogId: string | null,
  s3Keys: string[]
): Promise<void> {
  // Delete from database (cascade deletes tasks and photos)
  if (dailyLogId) {
    try {
      await supabase.from('daily_logs').delete().eq('id', dailyLogId);
      console.log('[Rollback] Deleted daily log:', dailyLogId);
    } catch (error) {
      console.error('[Rollback] Failed to delete daily log:', error);
    }
  }

  // Clean up S3 files
  if (s3Keys.length > 0) {
    await cleanupS3Files(s3Keys);
  }
}

export const config = {
  maxDuration: 60, // 60 seconds for photo uploads
};

// Direct API endpoint for saving daily logs
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Save Daily Log] Starting request...');

  try {
    const {
      companyId,
      projectId,
      logDate,
      createdBy, // User name (will be converted to UUID)
      equipmentNote,
      materialNote,
      officialNote,
      subsNote,
      employeesNote,
      workPerformed,
      issues,
      generalNotes,
      tasks,
      photos, // Photos with base64 data
      sharedWith, // Emails (will be converted to UUIDs)
    } = req.body;

    // Validate required fields
    if (!companyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }
    if (!projectId) {
      return res.status(400).json({ error: 'Missing required field: projectId' });
    }
    if (!logDate) {
      return res.status(400).json({ error: 'Missing required field: logDate' });
    }
    if (!createdBy) {
      return res.status(400).json({ error: 'Missing required field: createdBy' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Save Daily Log] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Save Daily Log] Saving daily log for project:', projectId, 'date:', logDate);

    // 1. Resolve user name to UUID
    const createdByUserId = await resolveUserId(supabase, companyId, createdBy);

    if (!createdByUserId) {
      console.warn('[Save Daily Log] User not found:', createdBy, '- using first admin user as fallback');
      // Fallback: Get first admin user in company
      const { data: adminUser } = await supabase
        .from('users')
        .select('id')
        .eq('company_id', companyId)
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (!adminUser) {
        return res.status(400).json({ error: 'Could not resolve user ID for createdBy' });
      }
    }

    // 2. Resolve emails to user IDs for shared_with
    const sharedWithIds = await resolveSharedWithIds(supabase, companyId, sharedWith || []);

    // 3. Upload photos to S3 if provided
    let uploadedPhotos: Array<{
      id: string;
      s3Url: string;
      s3Key: string;
      author: string;
      notes?: string;
    }> = [];

    if (photos && photos.length > 0) {
      console.log('[Save Daily Log] Uploading', photos.length, 'photos to S3...');
      uploadedPhotos = await uploadDailyLogPhotos(photos, companyId, projectId);
      console.log('[Save Daily Log] Successfully uploaded', uploadedPhotos.length, 'photos');
    }

    // 4. Insert daily_logs record
    const { data: dailyLog, error: logError } = await supabase
      .from('daily_logs')
      .insert({
        company_id: companyId,
        project_id: projectId,
        log_date: logDate,
        created_by: createdByUserId,
        equipment_note: equipmentNote || null,
        material_note: materialNote || null,
        official_note: officialNote || null,
        subs_note: subsNote || null,
        employees_note: employeesNote || null,
        work_performed: workPerformed || null,
        issues: issues || null,
        general_notes: generalNotes || null,
        shared_with: sharedWithIds,
      })
      .select()
      .single();

    if (logError) {
      console.error('[Save Daily Log] Database error:', logError);
      // Rollback: Clean up uploaded S3 files
      await cleanupS3Files(uploadedPhotos.map((p) => p.s3Key));
      return res.status(500).json({ error: `Failed to save daily log: ${logError.message}` });
    }

    console.log('[Save Daily Log] Daily log saved:', dailyLog.id);

    // 5. Insert tasks if provided
    if (tasks && tasks.length > 0) {
      const tasksToInsert = tasks.map((task: any) => ({
        daily_log_id: dailyLog.id,
        description: task.description,
        completed: task.completed,
      }));

      const { error: tasksError } = await supabase
        .from('daily_log_tasks')
        .insert(tasksToInsert);

      if (tasksError) {
        console.error('[Save Daily Log] Tasks insert error:', tasksError);
        // Rollback: Delete daily log and cleanup S3
        await rollbackDailyLog(
          supabase,
          dailyLog.id,
          uploadedPhotos.map((p) => p.s3Key)
        );
        return res.status(500).json({ error: 'Failed to save tasks' });
      }

      console.log('[Save Daily Log] Saved', tasks.length, 'tasks');
    }

    // 6. Insert photos if uploaded
    if (uploadedPhotos.length > 0) {
      const photosToInsert = uploadedPhotos.map((photo) => ({
        daily_log_id: dailyLog.id,
        uri: photo.s3Url, // S3 URL not local URI
        author: photo.author,
        notes: photo.notes || null,
      }));

      const { error: photosError } = await supabase
        .from('daily_log_photos')
        .insert(photosToInsert);

      if (photosError) {
        console.error('[Save Daily Log] Photos insert error:', photosError);
        // Rollback: Delete daily log and cleanup S3
        await rollbackDailyLog(
          supabase,
          dailyLog.id,
          uploadedPhotos.map((p) => p.s3Key)
        );
        return res.status(500).json({ error: 'Failed to save photos' });
      }

      console.log('[Save Daily Log] Saved', uploadedPhotos.length, 'photos');
    }

    console.log('[Save Daily Log] Success. Total time:', Date.now() - startTime, 'ms');

    return res.status(200).json({
      success: true,
      dailyLog: {
        id: dailyLog.id,
        uploadedPhotosCount: uploadedPhotos.length,
        tasksCount: tasks?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('[Save Daily Log] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to save daily log',
    });
  }
}
