import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const approveRateChangeProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
      approved: z.boolean(),
      reviewedBy: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Users] Rate change reviewed:', input.userId);
    console.log('[Users] Approved:', input.approved);
    console.log('[Users] Reviewed by:', input.reviewedBy);

    return {
      success: true,
      message: input.approved ? 'Rate change approved' : 'Rate change rejected',
      status: input.approved ? 'approved' : 'rejected',
      reviewedBy: input.reviewedBy,
      reviewedDate: new Date().toISOString(),
    };
  });
