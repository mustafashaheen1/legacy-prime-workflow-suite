import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const getBusinessFilesProcedure = publicProcedure
  .input(
    z.object({
      subcontractorId: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[BusinessFiles] Fetching files for subcontractor:', input.subcontractorId);
    return [];
  });
