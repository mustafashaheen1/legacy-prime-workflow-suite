import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const verifyBusinessFileProcedure = publicProcedure
  .input(
    z.object({
      fileId: z.string(),
      verified: z.boolean(),
      verifiedBy: z.string(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[BusinessFile] Verifying file:', input.fileId, 'Status:', input.verified);
    
    return {
      id: input.fileId,
      verified: input.verified,
      verifiedBy: input.verifiedBy,
      verifiedDate: new Date().toISOString(),
      notes: input.notes,
    };
  });
