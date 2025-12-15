import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";
import { uploadToS3, generateS3Key, deleteFromS3 } from "../../../../lib/s3.js";
import { validateImageFile, base64ToBuffer, getFileExtension } from "../../../../lib/file-validation.js";

export const addPhotoProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      projectId: z.string().uuid(),
      category: z.string().min(1),
      notes: z.string().optional(),
      fileData: z.string().min(1), // Base64 encoded image data
      fileName: z.string().min(1),
      mimeType: z.string().min(1),
      fileSize: z.number().positive(),
      date: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Photos] Adding photo for project:', input.projectId);

    try {
      // 1. Validate file type and size
      const validation = validateImageFile({
        mimeType: input.mimeType,
        size: input.fileSize,
      });

      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 2. Convert base64 to Buffer
      const fileBuffer = base64ToBuffer(input.fileData);

      // 3. Generate S3 key
      const s3Key = generateS3Key({
        companyId: input.companyId,
        projectId: input.projectId,
        type: 'photos',
        fileName: input.fileName,
      });

      console.log('[Photos] Uploading to S3:', {
        key: s3Key,
        size: fileBuffer.length,
        mimeType: input.mimeType,
      });

      // 4. Upload to S3
      const { url: s3Url, key } = await uploadToS3({
        buffer: fileBuffer,
        key: s3Key,
        contentType: input.mimeType,
      });

      console.log('[Photos] S3 upload successful:', s3Url);

      // 5. Save to database with S3 metadata
      const { data, error } = await supabase
        .from('photos')
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          category: input.category,
          notes: input.notes,
          url: s3Url,
          s3_key: key,
          file_size: input.fileSize,
          file_type: input.mimeType,
          compressed: false, // Will be true when compression is implemented
          date: input.date,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[Photos] Error saving to database:', error);

        // Delete from S3 if database save fails (prevent orphaned files)
        try {
          await deleteFromS3(key);
          console.log('[Photos] Cleaned up S3 file after database error');
        } catch (cleanupError) {
          console.error('[Photos] Failed to cleanup S3 file:', cleanupError);
        }

        throw new Error(`Failed to save photo: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Photos] Photo added successfully:', data.id);

      return {
        success: true,
        photo: {
          id: data.id,
          projectId: data.project_id,
          category: data.category,
          notes: data.notes || undefined,
          url: data.url,
          date: data.date,
          fileSize: data.file_size,
          fileType: data.file_type,
          s3Key: data.s3_key,
          compressed: data.compressed,
        },
      };
    } catch (error: any) {
      console.error('[Photos] Unexpected error adding photo:', error);
      throw new Error(error.message || 'Failed to add photo');
    }
  });
