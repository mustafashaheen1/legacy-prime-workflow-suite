import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const requestRateChangeProcedure = publicProcedure
  .input(
    z.object({
      userId: z.string(),
      newRate: z.number().positive(),
      reason: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Users] Rate change requested:', input.userId);
    console.log('[Users] New rate:', input.newRate);
    console.log('[Users] Reason:', input.reason || 'Not provided');

    const rateChangeRequest = {
      newRate: input.newRate,
      requestDate: new Date().toISOString(),
      reason: input.reason,
      status: 'pending' as const,
    };

    return {
      success: true,
      message: 'Rate change request submitted successfully',
      rateChangeRequest,
    };
  });
