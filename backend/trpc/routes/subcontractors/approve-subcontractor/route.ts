import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const approveSubcontractorProcedure = publicProcedure
  .input(
    z.object({
      subcontractorId: z.string(),
      approved: z.boolean(),
      approvedBy: z.string(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Subcontractor] Approval status:', input.approved, 'for:', input.subcontractorId);
    
    return {
      id: input.subcontractorId,
      approved: input.approved,
      approvedBy: input.approvedBy,
      approvedDate: new Date().toISOString(),
    };
  });
