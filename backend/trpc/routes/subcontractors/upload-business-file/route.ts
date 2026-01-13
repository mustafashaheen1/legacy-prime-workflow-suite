import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';

export const uploadBusinessFileProcedure = publicProcedure
  .input(
    z.object({
      subcontractorId: z.string(),
      type: z.enum(['license', 'insurance', 'w9', 'certificate', 'other']),
      name: z.string(),
      fileType: z.string(),
      fileSize: z.number(),
      expiryDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[BusinessFile] Starting upload for:', input.name, 'subcontractor:', input.subcontractorId);

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
      throw new Error('S3 bucket not configured');
    }

    // Generate unique S3 key
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = input.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `subcontractors/${input.subcontractorId}/business-files/${timestamp}-${random}-${sanitizedFileName}`;

    // Generate presigned upload URL
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: s3Key,
      ContentType: input.fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 }); // 10 minutes

    // Construct the final S3 URL (after upload)
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Database not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save file metadata to database
    const { data, error } = await supabase
      .from('business_files')
      .insert({
        subcontractor_id: input.subcontractorId,
        type: input.type,
        name: input.name,
        file_type: input.fileType,
        file_size: input.fileSize,
        uri: fileUrl,
        expiry_date: input.expiryDate || null,
        notes: input.notes || null,
        verified: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[BusinessFile] Database error:', error);
      throw new Error(`Failed to save file metadata: ${error.message}`);
    }

    console.log('[BusinessFile] File record created:', data.id, 'Upload URL generated');

    // Return the upload URL and file metadata
    return {
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
    };
  });
