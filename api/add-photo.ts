import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { uploadToS3, generateS3Key, deleteFromS3 } from '../backend/lib/s3';
import { validateImageFile, base64ToBuffer } from '../backend/lib/file-validation';

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
    const { companyId, projectId, category, notes, fileData, fileName, mimeType, fileSize, date } = req.body;

    // Validate required fields
    if (!companyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }
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
