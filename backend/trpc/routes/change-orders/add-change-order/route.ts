import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const addChangeOrderProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string(),
      description: z.string(),
      amount: z.number(),
      date: z.string(),
      status: z.enum(['pending', 'approved', 'rejected']),
      approvedBy: z.string().optional(),
      approvedDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const changeOrder = {
      id: `change-order-${Date.now()}`,
      ...input,
      createdAt: new Date().toISOString(),
    };

    console.log('[Backend] Change order created:', changeOrder);
    
    return { success: true, changeOrder };
  });
