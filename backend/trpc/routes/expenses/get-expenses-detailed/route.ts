import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const inputSchema = z.object({
  projectId: z.string().optional(),
  type: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  employeeId: z.string().optional(),
});

export const getExpensesDetailedProcedure = publicProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    let query = supabase.from('expenses').select('*');

    if (input.projectId) {
      query = query.eq('project_id', input.projectId);
    }

    if (input.type) {
      query = query.ilike('type', `%${input.type}%`);
    }

    if (input.date) {
      query = query.gte('date', input.date).lt('date', input.date + 'T99:99:99');
    }

    if (input.startDate && input.endDate) {
      query = query.gte('date', input.startDate).lte('date', input.endDate);
    }

    const { data: expenses, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch expenses: ${error.message}`);
    }

    const filteredExpenses = expenses || [];
    const totalAmount = filteredExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);

    const byCategory = filteredExpenses.reduce((acc: Record<string, number>, e: any) => {
      acc[e.type] = (acc[e.type] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const byProject = filteredExpenses.reduce((acc: Record<string, number>, e: any) => {
      acc[e.project_id] = (acc[e.project_id] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      expenses: filteredExpenses,
      total: totalAmount,
      count: filteredExpenses.length,
      byCategory,
      byProject,
    };
  });
