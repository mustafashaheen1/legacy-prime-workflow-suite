import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Vercel has platform limits (~4-6MB), client should compress before upload
    },
  },
};

// Generate 8-character alphanumeric code (A-Z, 0-9)
function generateShortCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[UploadEstimateFile] ===== API ROUTE STARTED =====');

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
      subcontractorId,
      userId,
    } = req.body;

    console.log('[UploadEstimateFile] Request:', { fileName, fileType, fileSize, companyId, projectId });

    if (!fileData || !fileName || !fileType || !companyId || !projectId) {
      return res.status(400).json({ error: 'Missing required fields: fileData, fileName, fileType, companyId, projectId' });
    }

    // Validate base64 data size (must fit in Vercel's body limit)
    const base64SizeMB = (fileData.length / 1024 / 1024).toFixed(2);
    const maxBase64Size = 5 * 1024 * 1024; // 5MB in bytes (safe for Vercel)
    if (fileData.length > maxBase64Size) {
      console.error('[UploadEstimateFile] File too large:', base64SizeMB, 'MB');
      return res.status(413).json({
        error: `File is too large (${base64SizeMB}MB). Please compress images or use files smaller than 5MB.`
      });
    }

    console.log('[UploadEstimateFile] File size OK:', base64SizeMB, 'MB');

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
      console.error('[UploadEstimateFile] S3 bucket not configured');
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    // Convert base64 to buffer
    const base64Data = fileData.replace(/^data:.+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    console.log('[UploadEstimateFile] File size after base64 decode:', buffer.length, 'bytes');

    // Generate S3 key with organized folder structure
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `estimates/${companyId}/${projectId}/${timestamp}-${random}-${sanitizedFileName}`;

    console.log('[UploadEstimateFile] Uploading to S3:', s3Key);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      Body: buffer,
      ContentType: fileType,
      // Optional: Set cache control for better performance
      CacheControl: 'max-age=31536000', // 1 year
    });

    await s3Client.send(command);

    console.log('[UploadEstimateFile] S3 upload successful');

    // Construct S3 URL
    const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    // Initialize Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[UploadEstimateFile] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique short code (with retry logic)
    let shortCode = generateShortCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from('file_share_links')
        .select('short_code')
        .eq('short_code', shortCode)
        .single();

      if (!existing) {
        console.log('[UploadEstimateFile] Generated unique short code:', shortCode);
        break;
      }

      console.log('[UploadEstimateFile] Short code collision, regenerating...');
      shortCode = generateShortCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.error('[UploadEstimateFile] Failed to generate unique short code after', maxAttempts, 'attempts');
      return res.status(500).json({ error: 'Failed to generate unique short code' });
    }

    // Set expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    console.log('[UploadEstimateFile] Saving to database...');

    // Save link mapping to database
    const { data, error } = await supabase
      .from('file_share_links')
      .insert({
        short_code: shortCode,
        company_id: companyId,
        project_id: projectId,
        subcontractor_id: subcontractorId || null,
        s3_key: s3Key,
        s3_url: s3Url,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize || buffer.length,
        expires_at: expiresAt.toISOString(),
        created_by: userId || null,
        view_count: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[UploadEstimateFile] Database error:', error);
      return res.status(500).json({ error: `Failed to save link: ${error.message}` });
    }

    // Generate short URL
    const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://legacy-prime-workflow-suite.vercel.app';
    const shortUrl = `${baseUrl}/f/${shortCode}`;

    console.log('[UploadEstimateFile] ===== API ROUTE COMPLETED =====');
    console.log('[UploadEstimateFile] Short URL:', shortUrl);

    return res.status(200).json({
      success: true,
      id: data.id,
      shortCode,
      shortUrl,
      s3Url,
      s3Key,
      expiresAt: expiresAt.toISOString(),
      fileSize: buffer.length,
    });
  } catch (error: any) {
    console.error('[UploadEstimateFile] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to upload file',
    });
  }
}
