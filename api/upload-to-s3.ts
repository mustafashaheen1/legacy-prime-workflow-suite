import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileData, fileName, fileType } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided' });
    }

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
      return res.status(500).json({ error: 'S3 bucket not configured' });
    }

    // Convert base64 to buffer
    const base64Data = fileData.replace(/^data:.+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFileName = `takeoff-documents/${timestamp}-${fileName}`;

    console.log('[S3 Upload] Uploading file:', uniqueFileName, 'Size:', buffer.length, 'bytes');

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueFileName,
      Body: buffer,
      ContentType: fileType || 'application/pdf',
      // Make file publicly readable (you can change this based on your security needs)
      // ACL: 'public-read', // Uncomment if you want public access
    });

    await s3Client.send(command);

    // Construct the S3 URL
    const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${uniqueFileName}`;

    console.log('[S3 Upload] File uploaded successfully:', s3Url);

    return res.status(200).json({
      success: true,
      url: s3Url,
      key: uniqueFileName,
    });
  } catch (error: any) {
    console.error('[S3 Upload] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to upload file to S3',
    });
  }
}
