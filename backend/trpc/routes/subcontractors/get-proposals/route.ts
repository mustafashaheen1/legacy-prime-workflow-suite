import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const getProposalsProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().optional(),
      subcontractorId: z.string().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    console.log('[Proposals] Fetching proposals with filters:', input);
    return [];
  });
