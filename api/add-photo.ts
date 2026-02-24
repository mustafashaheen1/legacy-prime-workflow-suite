import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { requireAuth } from './lib/auth-helper.js';
import { getActorName, notifyCompanyAdmins } from '../backend/lib/notifyAdmins.js';

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'legacy-prime-construction-media';

// Allowed MIME types for images
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
];

const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760'); // 10MB default

/**
 * Validate image file type and size
 */
function validateImageFile(params: {
  mimeType: string;
  size: number;
}): { valid: boolean; error?: string } {
  const { mimeType, size } = params;

  if (!ALLOWED_IMAGE_TYPES.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid file type: ${mimeType}. Allowed types: JPEG, PNG, HEIC, HEIF, WebP`,
    };
  }

  if (size > MAX_IMAGE_SIZE) {
    const maxSizeMB = (MAX_IMAGE_SIZE / 1024 / 1024).toFixed(1);
    const actualSizeMB = (size / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `File too large: ${actualSizeMB}MB. Maximum size is ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Convert base64 string to Buffer
 */
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  return Buffer.from(base64Data, 'base64');
}

/**
 * Generate S3 key (path) for a file
 */
function generateS3Key(params: {
  companyId: string;
  projectId: string;
  type: 'photos' | 'videos';
  fileName: string;
}): string {
  const { companyId, projectId, type, fileName } = params;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const random = Math.random().toString(36).substring(2, 8);
  const extension = fileName.split('.').pop() || 'jpg';
  const key = `company-${companyId}/project-${projectId}/${type}/${timestamp}-${random}.${extension}`;
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
    if (error.name === 'NoSuchBucket') {
      throw new Error('Storage configuration error. Bucket does not exist.');
    } else if (error.name === 'AccessDenied') {
      throw new Error('Storage access denied. Check IAM permissions.');
    } else if (error.name === 'RequestTimeout') {
      throw new Error('Upload timed out. Please try again.');
    } else {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }
}

/**
 * Delete a file from S3
 */
async function deleteFromS3(key: string): Promise<void> {
  console.log('[S3] Deleting file:', key);
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    console.log('[S3] Delete successful:', key);
  } catch (error: any) {
    console.error('[S3] Delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

export const config = {
  maxDuration: 60, // 60 seconds for photo upload
};

// Direct API endpoint for adding photos - bypasses tRPC to avoid timeout issues
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Add Photo] Starting request...');

  try {
    // 🎯 PHASE 2B: Extract user from JWT (required for uploaded_by tracking)
    let authUser;
    try {
      authUser = await requireAuth(req);
      console.log('[Add Photo] ✅ Authenticated user:', authUser.email);
    } catch (authError: any) {
      console.error('[Add Photo] Authentication failed:', authError.message);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to upload photos'
      });
    }

    const { projectId, category, notes, fileData, fileName, mimeType, fileSize, date } = req.body;

    // 🎯 SECURITY: Use company ID from authenticated user, not from request body
    const companyId = authUser.companyId;

    // Validate required fields
    if (!projectId) {
      return res.status(400).json({ error: 'Missing required field: projectId' });
    }
    if (!category) {
      return res.status(400).json({ error: 'Missing required field: category' });
    }
    if (!fileData) {
      return res.status(400).json({ error: 'Missing required field: fileData' });
    }
    if (!fileName) {
      return res.status(400).json({ error: 'Missing required field: fileName' });
    }
    if (!mimeType) {
      return res.status(400).json({ error: 'Missing required field: mimeType' });
    }
    if (!fileSize) {
      return res.status(400).json({ error: 'Missing required field: fileSize' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Add Photo] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Add Photo] Adding photo for project:', projectId);

    // 1. Validate file type and size
    const validation = validateImageFile({
      mimeType,
      size: fileSize,
    });

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // 2. Convert base64 to Buffer
    console.log('[Add Photo] Converting base64 to buffer...');
    const fileBuffer = base64ToBuffer(fileData);

    // 3. Generate S3 key
    const s3Key = generateS3Key({
      companyId,
      projectId,
      type: 'photos',
      fileName,
    });

    console.log('[Add Photo] Uploading to S3:', {
      key: s3Key,
      size: fileBuffer.length,
      mimeType,
    });

    // 4. Upload to S3
    const uploadStartTime = Date.now();
    const { url: s3Url, key } = await uploadToS3({
      buffer: fileBuffer,
      key: s3Key,
      contentType: mimeType,
    });

    console.log('[Add Photo] S3 upload successful in', Date.now() - uploadStartTime, 'ms:', s3Url);

    // 5. Save to database with S3 metadata
    const { data, error } = await supabase
      .from('photos')
      .insert({
        company_id: companyId,
        project_id: projectId,
        category,
        notes: notes || null,
        url: s3Url,
        s3_key: key,
        file_size: fileSize,
        file_type: mimeType,
        compressed: false,
        date: date || new Date().toISOString(),
        uploaded_by: authUser.id, // 🎯 PHASE 3: Auto-capture uploader
      })
      .select()
      .single();

    console.log('[Add Photo] Database insert completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Add Photo] Database error:', error);

      // Delete from S3 if database save fails (prevent orphaned files)
      try {
        await deleteFromS3(key);
        console.log('[Add Photo] Cleaned up S3 file after database error');
      } catch (cleanupError) {
        console.error('[Add Photo] Failed to cleanup S3 file:', cleanupError);
      }

      return res.status(500).json({ error: `Failed to save photo: ${error.message}` });
    }

    if (!data) {
      return res.status(500).json({ error: 'No data returned from insert' });
    }

    console.log('[Add Photo] Success. Total time:', Date.now() - startTime, 'ms');

    // Notify admins — must complete BEFORE responding (Vercel freezes after res.json)
    try {
      const [name, projectRes] = await Promise.all([
        getActorName(supabase, authUser.id),
        supabase.from('projects').select('name').eq('id', projectId).single(),
      ]);
      const projectName = projectRes.data?.name ?? 'a project';
      await notifyCompanyAdmins(supabase, {
        companyId,
        actorId: authUser.id,
        type: 'general',
        title: 'Photo Added',
        message: `${name} added a ${category} photo to ${projectName}`,
        data: { photoId: data.id, projectId },
      });
    } catch (e) {
      console.warn('[Add Photo] Admin notify failed (non-fatal):', e);
    }

    // Convert snake_case back to camelCase for response
    const photo = {
      id: data.id,
      projectId: data.project_id,
      category: data.category,
      notes: data.notes || undefined,
      url: data.url,
      date: data.date,
      fileSize: data.file_size,
      fileType: data.file_type,
      s3Key: data.s3_key,
      compressed: data.compressed,
    };

    return res.status(200).json({
      success: true,
      photo,
    });
  } catch (error: any) {
    console.error('[Add Photo] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to add photo',
    });
  }
}
