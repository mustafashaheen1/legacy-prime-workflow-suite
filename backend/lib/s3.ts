import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as getS3SignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 client with credentials from environment variables
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'legacy-prime-construction-media';

/**
 * Generate S3 key (path) for a file
 * Format: company-{companyId}/project-{projectId}/photos|videos/{timestamp}-{random}.{ext}
 */
export function generateS3Key(params: {
  companyId: string;
  projectId: string;
  type: 'photos' | 'videos';
  fileName: string;
}): string {
  const { companyId, projectId, type, fileName } = params;

  // Generate timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Generate random string
  const random = Math.random().toString(36).substring(2, 8);

  // Get file extension from fileName
  const extension = fileName.split('.').pop() || 'jpg';

  // Construct key
  const key = `company-${companyId}/project-${projectId}/${type}/${timestamp}-${random}.${extension}`;

  return key;
}

/**
 * Upload a file buffer to S3
 * Returns the S3 URL and key
 */
export async function uploadToS3(params: {
  buffer: Buffer;
  key: string;
  contentType: string;
}): Promise<{ url: string; key: string }> {
  const { buffer, key, contentType } = params;

  console.log('[S3] Uploading file:', {
    key,
    contentType,
    size: buffer.length,
    bucket: BUCKET_NAME,
  });

  try {
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // Generate the S3 URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;

    console.log('[S3] Upload successful:', url);

    return { url, key };
  } catch (error: any) {
    console.error('[S3] Upload error:', error);

    // Handle specific S3 errors
    if (error.name === 'NoSuchBucket') {
      throw new Error('Storage configuration error. Bucket does not exist.');
    } else if (error.name === 'AccessDenied') {
      throw new Error('Storage access denied. Check IAM permissions.');
    } else if (error.name === 'RequestTimeout') {
      throw new Error('Upload timed out. Please try again.');
    } else {
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }
}

/**
 * Generate a presigned URL for downloading a file from S3
 * URL expires in 7 days
 */
export async function getSignedUrl(key: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    // Generate presigned URL valid for 7 days (604800 seconds)
    const url = await getS3SignedUrl(s3Client, command, { expiresIn: 604800 });

    return url;
  } catch (error: any) {
    console.error('[S3] Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  console.log('[S3] Deleting file:', key);

  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);

    console.log('[S3] Delete successful:', key);
  } catch (error: any) {
    console.error('[S3] Delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}
