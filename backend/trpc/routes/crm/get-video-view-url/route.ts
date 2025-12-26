import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const getVideoViewUrlProcedure = publicProcedure
  .input(
    z.object({
      videoKey: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[CRM] Generating video view URL for:', input.videoKey);

    // Initialize S3 client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    const bucket = process.env.AWS_S3_BUCKET || 'legacy-prime-construction-media';

    try {
      // Generate presigned URL for GET request (1 hour expiry)
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: input.videoKey,
      });

      const viewUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour

      console.log('[CRM] Generated view URL');

      return {
        success: true,
        viewUrl,
      };
    } catch (error: any) {
      console.error('[CRM] Error generating view URL:', error);
      throw new Error('Failed to generate view URL');
    }
  });
