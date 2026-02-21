import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

export const getPaymentsProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Payments] Fetching payments for project:', input.projectId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('[Payments] Supabase not configured — returning empty list');
      return { payments: [] };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('payments')
      .select('*')
      .order('date', { ascending: false });

    if (input.projectId) {
      query = query.eq('project_id', input.projectId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Payments] Supabase error fetching payments:', error);
      throw new Error(`Failed to fetch payments: ${error.message}`);
    }

    const payments = (data || []).map((row: any) => ({
      id: row.id,
      projectId: row.project_id,
      amount: Number(row.amount),
      date: row.date,
      clientId: row.client_id ?? undefined,
      clientName: row.client_name,
      method: row.method as 'cash' | 'check' | 'credit-card' | 'wire-transfer' | 'other',
      notes: row.notes ?? undefined,
      receiptUrl: row.receipt_url ?? undefined,
      createdAt: row.created_at,
    }));

    console.log('[Payments] Fetched', payments.length, 'payments');
    return { payments };
  });
