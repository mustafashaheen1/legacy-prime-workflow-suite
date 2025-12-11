import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const getSubcontractorsProcedure = publicProcedure
  .input(
    z.object({
      trade: z.string().optional(),
      availability: z.enum(['available', 'busy', 'unavailable']).optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    console.log('[Subcontractors] Fetching subcontractors with filters:', input);
    return [];
  });
