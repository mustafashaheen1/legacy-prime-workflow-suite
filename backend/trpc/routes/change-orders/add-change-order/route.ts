import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { changeOrdersStore } from '../get-change-orders/route.js';

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
    try {
      console.log('[Backend] Adding change order with input:', input);
      
      const changeOrder = {
        id: `change-order-${Date.now()}`,
        ...input,
        createdAt: new Date().toISOString(),
      };

      changeOrdersStore.push(changeOrder);
      console.log('[Backend] Change order created and stored:', changeOrder);
      console.log('[Backend] Total change orders in store:', changeOrdersStore.length);
      
      return { success: true, changeOrder };
    } catch (error) {
      console.error('[Backend] Error adding change order:', error);
      throw new Error('Failed to add change order: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });
