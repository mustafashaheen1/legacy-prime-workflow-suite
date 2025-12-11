import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const getExpensesProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Expenses] Fetching expenses for company:', input.companyId);

    try {
      let query = supabase
        .from('expenses')
        .select('*')
        .eq('company_id', input.companyId);

      if (input.projectId) {
        query = query.eq('project_id', input.projectId);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) {
        console.error('[Expenses] Error fetching expenses:', error);
        throw new Error(`Failed to fetch expenses: ${error.message}`);
      }

      console.log('[Expenses] Found', data?.length || 0, 'expenses');

      const expenses = (data || []).map((expense: any) => ({
        id: expense.id,
        projectId: expense.project_id,
        type: expense.type,
        subcategory: expense.subcategory,
        amount: Number(expense.amount),
        store: expense.store,
        date: expense.date,
        receiptUrl: expense.receipt_url || undefined,
      }));

      return {
        success: true,
        expenses,
      };
    } catch (error: any) {
      console.error('[Expenses] Unexpected error fetching expenses:', error);
      throw new Error(error.message || 'Failed to fetch expenses');
    }
  });
