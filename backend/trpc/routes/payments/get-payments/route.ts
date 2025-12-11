import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';

export const getPaymentsProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Backend] Fetching payments for project:', input.projectId);
    
    return { payments: [] };
  });
