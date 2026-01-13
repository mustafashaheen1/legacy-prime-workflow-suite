import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';

// Direct API endpoint for uploading business files - bypasses tRPC for better performance
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Upload Business File] Starting request...');

  try {
    const {
      subcontractorId,
      type,
      name,
      fileType,
      fileSize,
      expiryDate,
      notes,
    } = req.body;

    // Validate required fields
    if (!subcontractorId || !type || !name || !fileType) {
      return res.status(400).json({
        error: 'Missing required fields: subcontractorId, type, name, fileType',
      });
    }

    // Validate type
    const validTypes = ['license', 'insurance', 'w9', 'certificate', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Create S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucketName = process.env.AWS_S3_BUCKET;
    if (!bucketName) {
      console.error('[Upload Business File] S3 bucket not configured');
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    // Generate unique S3 key
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `subcontractors/${subcontractorId}/business-files/${timestamp}-${random}-${sanitizedFileName}`;

    console.log('[Upload Business File] Generating presigned URL for:', s3Key);

    // Generate presigned upload URL
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 }); // 10 minutes

    // Construct the final S3 URL (after upload)
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    console.log('[Upload Business File] Presigned URL generated in', Date.now() - startTime, 'ms');

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Upload Business File] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save file metadata to database
    const { data, error } = await supabase
      .from('business_files')
      .insert({
        subcontractor_id: subcontractorId,
        type,
        name,
        file_type: fileType,
        file_size: fileSize || 0,
        uri: fileUrl,
        expiry_date: expiryDate || null,
        notes: notes || null,
        verified: false,
      })
      .select()
      .single();

    console.log('[Upload Business File] Database insert completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Upload Business File] Database error:', error);
      return res.status(500).json({
        error: `Failed to save file metadata: ${error.message}`,
      });
    }

    console.log('[Upload Business File] Success:', data.id, 'Total time:', Date.now() - startTime, 'ms');

    // Return the upload URL and file metadata
    return res.status(200).json({
      success: true,
      id: data.id,
      subcontractorId: data.subcontractor_id,
      type: data.type,
      name: data.name,
      fileType: data.file_type,
      fileSize: data.file_size,
      uri: data.uri,
      uploadUrl, // Presigned URL for client to upload file to S3
      s3Key,
      uploadDate: data.upload_date,
      expiryDate: data.expiry_date || undefined,
      verified: data.verified,
      notes: data.notes || undefined,
    });
  } catch (error: any) {
    console.error('[Upload Business File] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process upload request',
    });
  }
}
