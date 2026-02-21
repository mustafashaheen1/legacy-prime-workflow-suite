import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

export const addPaymentProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().uuid(),
      companyId: z.string().uuid(),
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
    console.log('[Payments] Recording payment for project:', input.projectId, 'amount:', input.amount);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('payments')
      .insert({
        project_id: input.projectId,
        company_id: input.companyId,
        amount: input.amount,
        date: input.date,
        client_id: input.clientId ?? null,
        client_name: input.clientName,
        method: input.method,
        notes: input.notes ?? null,
        receipt_url: input.receiptUrl ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Payments] Supabase error adding payment:', error);
      throw new Error(`Failed to record payment: ${error.message}`);
    }

    const payment = {
      id: data.id,
      projectId: data.project_id,
      amount: Number(data.amount),
      date: data.date,
      clientId: data.client_id ?? undefined,
      clientName: data.client_name,
      method: data.method as 'cash' | 'check' | 'credit-card' | 'wire-transfer' | 'other',
      notes: data.notes ?? undefined,
      receiptUrl: data.receipt_url ?? undefined,
      createdAt: data.created_at,
    };

    console.log('[Payments] Payment recorded successfully:', payment.id);
    return { success: true, payment };
  });
