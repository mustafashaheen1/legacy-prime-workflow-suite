import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const updateChangeOrderProcedure = publicProcedure
  .input(
    z.object({
      id: z.string(),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
      approvedBy: z.string().optional(),
      approvedDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Backend] Updating change order:', input.id);
    
    return { success: true };
  });
