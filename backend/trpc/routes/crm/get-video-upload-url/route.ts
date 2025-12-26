import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from '@supabase/supabase-js';

export const getVideoUploadUrlProcedure = publicProcedure
  .input(
    z.object({
      token: z.string().uuid(),
      fileExtension: z.string().default('webm'),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[CRM] Generating video upload URL for token:', input.token);

    // Verify token exists and is valid
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if token is valid
    const { data: inspection, error: fetchError } = await supabase
      .from('inspection_videos')
      .select('*')
      .eq('token', input.token)
      .single();

    if (fetchError || !inspection) {
      console.error('[CRM] Invalid token:', input.token);
      throw new Error('Invalid or expired inspection link');
    }

    // Check if expired
    if (new Date(inspection.expires_at) < new Date()) {
      throw new Error('This inspection link has expired');
    }

    // Initialize S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucket = process.env.AWS_S3_BUCKET || 'legacy-prime-construction-media';
    const key = `inspections/${inspection.id}/video-${Date.now()}.${input.fileExtension}`;

    try {
      // Generate presigned URL for PUT request (15 minutes expiry)
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: `video/${input.fileExtension}`,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes

      console.log('[CRM] Generated upload URL for:', key);

      return {
        success: true,
        uploadUrl,
        key,
        bucket,
      };
    } catch (error: any) {
      console.error('[CRM] Error generating upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  });
