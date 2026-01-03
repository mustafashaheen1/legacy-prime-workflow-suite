import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

/**
 * Upload Audio to S3
 * Uploads voice message audio files to AWS S3
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { audioData, userId, fileName } = req.body;

    if (!audioData || !userId) {
      return res.status(400).json({ error: 'audioData and userId are required' });
    }

    // Validate AWS credentials
    const {
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      AWS_S3_BUCKET,
    } = process.env;

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !AWS_S3_BUCKET) {
      console.error('[Upload Audio] AWS credentials not configured');
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

    // Generate unique filename
    const fileExtension = fileName?.split('.').pop() || 'm4a';
    const uniqueFileName = `voice-messages/${userId}/${uuidv4()}.${fileExtension}`;

    // Convert base64 to buffer
    const base64Data = audioData.replace(/^data:audio\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: uniqueFileName,
      Body: buffer,
      ContentType: `audio/${fileExtension}`,
      // ACL removed - bucket should be configured with public access policy
    });

    await s3Client.send(uploadCommand);

    // Generate public URL
    const fileUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${uniqueFileName}`;

    console.log('[Upload Audio] File uploaded successfully:', fileUrl);

    return res.status(200).json({
      success: true,
      url: fileUrl,
      fileName: uniqueFileName,
    });
  } catch (error: any) {
    console.error('[Upload Audio] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload audio file',
    });
  }
}
