import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[UploadProjectFileDirect] ===== API ROUTE STARTED =====');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      fileData,
      fileName,
      fileType,
      fileSize,
      companyId,
      projectId,
      category,
      notes,
    } = req.body;

    console.log('[UploadProjectFileDirect] Request:', { fileName, fileType, fileSize, companyId, projectId, category });

    if (!fileData || !fileName || !fileType || !companyId || !projectId || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate base64 data size
    const base64SizeMB = (fileData.length / 1024 / 1024).toFixed(2);
    const maxBase64Size = 5 * 1024 * 1024; // 5MB
    if (fileData.length > maxBase64Size) {
      console.error('[UploadProjectFileDirect] File too large:', base64SizeMB, 'MB');
      return res.status(413).json({
        error: `File is too large (${base64SizeMB}MB). Please compress images or use files smaller than 5MB.`
      });
    }

    console.log('[UploadProjectFileDirect] File size OK:', base64SizeMB, 'MB');

    // Initialize S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucketName = process.env.AWS_S3_BUCKET;
    if (!bucketName) {
      console.error('[UploadProjectFileDirect] S3 bucket not configured');
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    // Convert base64 to buffer
    const base64Data = fileData.replace(/^data:.+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    console.log('[UploadProjectFileDirect] File size after base64 decode:', buffer.length, 'bytes');

    // Generate S3 key with organized folder structure
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `projects/${companyId}/${projectId}/${category}/${timestamp}-${sanitizedFileName}`;

    console.log('[UploadProjectFileDirect] Uploading to S3:', s3Key);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: fileType,
      CacheControl: 'max-age=31536000',
    });

    await s3Client.send(command);

    console.log('[UploadProjectFileDirect] S3 upload successful');

    // Construct S3 URL
    const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    // Initialize Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[UploadProjectFileDirect] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[UploadProjectFileDirect] Saving to database...');

    // Save file metadata to database
    const { data, error } = await supabase
      .from('project_files')
      .insert({
        company_id: companyId,
        project_id: projectId,
        name: fileName,
        category,
        file_type: fileType,
        file_size: buffer.length,
        uri: s3Url,
        s3_key: s3Key,
        notes: notes || null,
        upload_date: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (error) {
      console.error('[UploadProjectFileDirect] Database error:', error);
      return res.status(500).json({ error: `Failed to save file metadata: ${error.message}` });
    }

    console.log('[UploadProjectFileDirect] ===== API ROUTE COMPLETED =====');
    console.log('[UploadProjectFileDirect] File saved:', data.id);

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
    console.error('[UploadProjectFileDirect] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to upload file',
    });
  }
}
