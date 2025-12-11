import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';

export const addPaymentProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string(),
      amount: z.number().positive(),
      date: z.string(),
      clientId: z.string().optional(),
      clientName: z.string(),
      method: z.enum(['cash', 'check', 'credit-card', 'wire-transfer', 'other']),
      notes: z.string().optional(),
      receiptUrl: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const payment = {
      id: `payment-${Date.now()}`,
      ...input,
      createdAt: new Date().toISOString(),
    };

    console.log('[Backend] Payment created:', payment);
    
    return { success: true, payment };
  });
