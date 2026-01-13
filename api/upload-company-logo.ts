import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// API endpoint for uploading company logo to S3
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Upload Company Logo] Starting request...');

  try {
    const { companyId, fileType = 'image/jpeg' } = req.body;

    // Validate required fields
    if (!companyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(fileType)) {
      return res.status(400).json({
        error: `Invalid file type. Must be one of: ${validTypes.join(', ')}`,
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
      console.error('[Upload Company Logo] S3 bucket not configured');
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    // Generate unique S3 key for logo
    const timestamp = Date.now();
    const extension = fileType.split('/')[1] || 'jpg';
    const s3Key = `companies/${companyId}/logo-${timestamp}.${extension}`;

    console.log('[Upload Company Logo] Generating presigned URL for:', s3Key);

    // Generate presigned upload URL
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 }); // 10 minutes

    // Construct the final S3 URL (after upload)
    const logoUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    console.log('[Upload Company Logo] Presigned URL generated in', Date.now() - startTime, 'ms');

    return res.status(200).json({
      success: true,
      uploadUrl, // Presigned URL for client to upload file to S3
      logoUrl,   // Final URL to store in database
      s3Key,
    });
  } catch (error: any) {
    console.error('[Upload Company Logo] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate upload URL',
    });
  }
}
