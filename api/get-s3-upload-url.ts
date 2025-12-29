import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileName, fileType } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'File name required' });
    }

    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucketName = process.env.AWS_S3_BUCKET;
    if (!bucketName) {
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    // Generate unique filename with appropriate folder
    const timestamp = Date.now();
    const folder = fileName.startsWith('inspection-') ? 'inspection-videos' : 'takeoff-documents';
    const uniqueFileName = `${folder}/${timestamp}-${fileName}`;

    // Create pre-signed URL for PUT operation
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueFileName,
      ContentType: fileType || 'application/pdf',
    });

    // URL expires in 10 minutes
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });

    // Construct the final S3 URL (after upload)
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${uniqueFileName}`;

    console.log('[S3 Pre-signed URL] Generated for:', uniqueFileName);

    return res.status(200).json({
      success: true,
      uploadUrl,
      fileUrl,
      key: uniqueFileName,
    });
  } catch (error: any) {
    console.error('[S3 Pre-signed URL] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate upload URL',
    });
  }
}
