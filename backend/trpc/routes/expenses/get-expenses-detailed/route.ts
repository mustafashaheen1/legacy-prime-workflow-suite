import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';
import { mockExpenses } from '@/mocks/data';

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
  .query(({ input }) => {
    let filteredExpenses = [...mockExpenses];

    if (input.projectId) {
      filteredExpenses = filteredExpenses.filter(e => e.projectId === input.projectId);
    }

    if (input.type) {
      filteredExpenses = filteredExpenses.filter(e => 
        e.type.toLowerCase().includes(input.type!.toLowerCase())
      );
    }

    if (input.date) {
      filteredExpenses = filteredExpenses.filter(e => 
        e.date.startsWith(input.date!)
      );
    }

    if (input.startDate && input.endDate) {
      filteredExpenses = filteredExpenses.filter(e => 
        e.date >= input.startDate! && e.date <= input.endDate!
      );
    }

    const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

    const byCategory = filteredExpenses.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const byProject = filteredExpenses.reduce((acc, e) => {
      acc[e.projectId] = (acc[e.projectId] || 0) + e.amount;
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
