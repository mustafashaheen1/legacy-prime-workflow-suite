import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const testEstimateProcedure = publicProcedure
  .input(
    z.object({
      test: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Test Estimate] Test endpoint called with:', input.test);

    return {
      success: true,
      message: 'Test endpoint is working!',
      timestamp: new Date().toISOString(),
    };
  });
