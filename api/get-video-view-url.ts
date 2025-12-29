import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const config = {
  maxDuration: 10,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[GetVideoViewUrl] ===== API ROUTE STARTED =====');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const videoKey = req.method === 'GET' ? req.query.videoKey as string : req.body.videoKey;

    if (!videoKey) {
      return res.status(400).json({ error: 'Video key required' });
    }

    console.log('[GetVideoViewUrl] Generating view URL for:', videoKey);

    // Initialize S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucket = process.env.AWS_S3_BUCKET || 'legacy-prime-construction-media';

    // Generate presigned URL for GET request (1 hour expiry)
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: videoKey,
    });

    const startTime = Date.now();
    const viewUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    const duration = Date.now() - startTime;

    console.log(`[GetVideoViewUrl] Generated view URL in ${duration}ms`);

    return res.status(200).json({
      success: true,
      viewUrl,
      duration,
    });
  } catch (error: any) {
    console.error('[GetVideoViewUrl] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate view URL',
    });
  }
}
