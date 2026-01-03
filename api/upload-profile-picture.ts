import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
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
 * Upload Profile Picture to S3 and Update User Record
 * Uploads user profile pictures to AWS S3 and updates the database
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageData, userId } = req.body;

    if (!imageData || !userId) {
      return res.status(400).json({ error: 'imageData and userId are required' });
    }

    // Validate AWS credentials
    const {
      AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY,
      AWS_REGION,
      AWS_S3_BUCKET,
      SUPABASE_URL,
      SUPABASE_SERVICE_KEY,
    } = process.env;

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !AWS_S3_BUCKET) {
      console.error('[Upload Profile Picture] AWS credentials not configured');
      return res.status(500).json({ error: 'AWS S3 not configured' });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.error('[Upload Profile Picture] Supabase credentials not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Initialize S3 client
    const s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
      },
    });

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Determine file extension from base64 data
    const matches = imageData.match(/^data:image\/(\w+);base64,/);
    const fileExtension = matches ? matches[1] : 'jpg';

    // Generate unique filename
    const uniqueFileName = `profile-pictures/${userId}/${uuidv4()}.${fileExtension}`;

    // Convert base64 to buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    console.log('[Upload Profile Picture] Uploading to S3:', uniqueFileName);

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: uniqueFileName,
      Body: buffer,
      ContentType: `image/${fileExtension}`,
    });

    await s3Client.send(uploadCommand);

    // Generate public URL
    const fileUrl = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${uniqueFileName}`;

    console.log('[Upload Profile Picture] File uploaded successfully:', fileUrl);

    // Update user's avatar in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar: fileUrl })
      .eq('id', userId);

    if (updateError) {
      console.error('[Upload Profile Picture] Failed to update user avatar:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update profile picture in database',
      });
    }

    console.log('[Upload Profile Picture] User avatar updated in database');

    return res.status(200).json({
      success: true,
      url: fileUrl,
      fileName: uniqueFileName,
    });
  } catch (error: any) {
    console.error('[Upload Profile Picture] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload profile picture',
    });
  }
}
