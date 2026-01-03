import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  maxDuration: 10,
};

/**
 * Generate Presigned URL for S3 Upload
 * Returns a presigned URL that allows direct upload to S3 from the client
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, fileName, fileType } = req.body;

    if (!userId || !fileName || !fileType) {
      return res.status(400).json({ error: 'userId, fileName, and fileType are required' });
    }

    // Validate AWS credentials
    const {
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      AWS_S3_BUCKET,
    } = process.env;

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !AWS_S3_BUCKET) {
      console.error('[Get Upload URL] AWS credentials not configured');
      return res.status(500).json({ error: 'AWS S3 not configured' });
    }

    // Initialize S3 client
    const s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    // Determine folder based on file type
    let folder = 'files';
    if (fileType.startsWith('image/')) {
      folder = 'images';
    } else if (fileType.startsWith('audio/')) {
      folder = 'voice-messages';
    } else if (fileType.startsWith('video/')) {
      folder = 'videos';
    }

    // Generate unique filename
    const fileExtension = fileName.split('.').pop() || 'bin';
    const uniqueFileName = `${folder}/${userId}/${uuidv4()}.${fileExtension}`;

    // Create presigned URL for PUT operation
    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: uniqueFileName,
      ContentType: fileType,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 }); // 5 minutes

    // Generate the final public URL
    const publicUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${uniqueFileName}`;

    console.log('[Get Upload URL] Generated presigned URL for:', uniqueFileName);

    return res.status(200).json({
      success: true,
      uploadUrl: presignedUrl,
      publicUrl: publicUrl,
      fileName: uniqueFileName,
    });
  } catch (error: any) {
    console.error('[Get Upload URL] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate upload URL',
    });
  }
}
