import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const addExpenseProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      projectId: z.string().uuid(),
      type: z.string().min(1),
      subcategory: z.string().min(1),
      amount: z.number().positive(),
      store: z.string().min(1),
      date: z.string().optional(),
      receiptUrl: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Expenses] Adding expense:', input.amount, 'for project:', input.projectId);

    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          type: input.type,
          subcategory: input.subcategory,
          amount: input.amount,
          store: input.store,
          date: input.date,
          receipt_url: input.receiptUrl,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[Expenses] Error adding expense:', error);
        throw new Error(`Failed to add expense: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Expenses] Expense added successfully:', data.id);

      return {
        success: true,
        expense: {
          id: data.id,
          projectId: data.project_id,
          type: data.type,
          subcategory: data.subcategory,
          amount: Number(data.amount),
          store: data.store,
          date: data.date,
          receiptUrl: data.receipt_url || undefined,
        },
      };
    } catch (error: any) {
      console.error('[Expenses] Unexpected error adding expense:', error);
      throw new Error(error.message || 'Failed to add expense');
    }
  });
