import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

// NOTE: Email functionality temporarily disabled due to build issues
// Will re-enable after fixing serverless compatibility

export const requestEstimateProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string(),
      subcontractorId: z.string(),
      description: z.string(),
      requiredBy: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const estimateRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      requestedBy: 'user_current',
      requestDate: new Date().toISOString(),
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };

    console.log('[EstimateRequest] Created estimate request:', estimateRequest.id);

    // TODO: Add database persistence
    // TODO: Add email notifications (currently disabled)
    // TODO: Add SMS notifications

    return estimateRequest;
  });
