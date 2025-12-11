import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const uploadBusinessFileProcedure = publicProcedure
  .input(
    z.object({
      subcontractorId: z.string(),
      type: z.enum(['license', 'insurance', 'w9', 'certificate', 'other']),
      name: z.string(),
      fileType: z.string(),
      fileSize: z.number(),
      uri: z.string(),
      expiryDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const businessFile = {
      id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      subcontractorId: input.subcontractorId,
      type: input.type,
      name: input.name,
      fileType: input.fileType,
      fileSize: input.fileSize,
      uri: input.uri,
      uploadDate: new Date().toISOString(),
      expiryDate: input.expiryDate,
      verified: false,
      notes: input.notes,
    };

    console.log('[BusinessFile] Uploaded file:', businessFile.name, 'for subcontractor:', input.subcontractorId);
    return businessFile;
  });
