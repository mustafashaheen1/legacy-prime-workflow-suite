import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Upload Subcontractor Business File] Starting request...');

  try {
    const {
      subcontractorId,
      token,
      type,
      name,
      fileType,
      fileSize,
      expiryDate,
      notes,
    } = req.body;

    // Validate required fields - either subcontractorId OR token must be provided
    if (!subcontractorId && !token) {
      return res.status(400).json({
        error: 'Either subcontractorId or token is required',
      });
    }

    if (!type || !name || !fileType) {
      return res.status(400).json({
        error: 'Missing required fields: type, name, fileType',
      });
    }

    // Validate type
    const validTypes = ['license', 'insurance', 'w9', 'certificate', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Validate file size (max 10MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
    if (fileSize && fileSize > maxFileSize) {
      return res.status(400).json({
        error: 'File size exceeds maximum limit of 10MB',
      });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Upload Subcontractor Business File] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let actualSubcontractorId = subcontractorId;

    // Validate token if provided (during registration without subcontractorId)
    if (token && !subcontractorId) {
      const { data: tokenData, error: tokenError } = await supabase
        .from('registration_tokens')
        .select('*')
        .eq('token', token)
        .single();

      if (tokenError || !tokenData) {
        console.error('[Upload Subcontractor Business File] Invalid token');
        return res.status(401).json({ error: 'Invalid registration token' });
      }

      // Check if token expired
      const expiry = new Date(tokenData.expires_at);
      const now = new Date();

      if (now > expiry) {
        console.error('[Upload Subcontractor Business File] Token expired');
        return res.status(401).json({ error: 'Registration link has expired' });
      }

      // Use special temporary ID pattern for files uploaded during registration
      actualSubcontractorId = `temp_${token}`;
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
      console.error('[Upload Subcontractor Business File] S3 bucket not configured');
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    // Generate unique S3 key
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `subcontractors/${actualSubcontractorId}/business-files/${timestamp}-${random}-${sanitizedFileName}`;

    console.log('[Upload Subcontractor Business File] Generating presigned URL for:', s3Key);

    // Generate presigned upload URL
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 }); // 10 minutes

    // Construct the final S3 URL (after upload)
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    console.log('[Upload Subcontractor Business File] Presigned URL generated in', Date.now() - startTime, 'ms');

    // Save file metadata to database
    // If uploading during registration (temp ID), store with token reference
    const { data, error} = await supabase
      .from('business_files')
      .insert({
        subcontractor_id: actualSubcontractorId.startsWith('temp_') ? null : actualSubcontractorId,
        registration_token: token || null,
        type,
        name,
        file_type: fileType,
        file_size: fileSize || 0,
        uri: fileUrl,
        s3_key: s3Key,
        expiry_date: expiryDate || null,
        notes: notes || null,
        verified: false,
      })
      .select()
      .single();

    console.log('[Upload Subcontractor Business File] Database insert completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Upload Subcontractor Business File] Database error:', error);
      return res.status(500).json({
        error: `Failed to save file metadata: ${error.message}`,
      });
    }

    console.log('[Upload Subcontractor Business File] Success:', data.id, 'Total time:', Date.now() - startTime, 'ms');

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
      s3Key: data.s3_key,
      uploadUrl, // Presigned URL for client to upload file to S3
      uploadDate: data.upload_date,
      expiryDate: data.expiry_date || undefined,
      verified: data.verified,
      notes: data.notes || undefined,
    });
  } catch (error: any) {
    console.error('[Upload Subcontractor Business File] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process upload request',
    });
  }
}
