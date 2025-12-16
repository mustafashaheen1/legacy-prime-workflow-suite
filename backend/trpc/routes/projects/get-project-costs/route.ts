import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const inputSchema = z.object({
  projectId: z.string(),
});

interface CostBreakdown {
  totalExpenses: number;
  totalLaborCost: number;
  totalSubcontractorCost: number;
  totalCost: number;
  expensesByCategory: Record<string, number>;
  laborByEmployee: {
    employeeId: string;
    employeeName: string;
    totalHours: number;
    hourlyRate: number;
    totalCost: number;
  }[];
  expensesBreakdown: {
    id: string;
    type: string;
    subcategory: string;
    amount: number;
    store: string;
    date: string;
  }[];
}

export const getProjectCostsProcedure = publicProcedure
  .input(inputSchema)
  .query(async ({ input }): Promise<CostBreakdown> => {
    console.log('[Project Costs] Calculating costs for project:', input.projectId);

    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    // Fetch expenses for this project
    const { data: projectExpenses, error: expensesError } = await supabase
      .from('expenses')
      .select('*')
      .eq('project_id', input.projectId);

    if (expensesError) {
      throw new Error(`Failed to fetch expenses: ${expensesError.message}`);
    }

    // Fetch clock entries for this project
    const { data: projectClockEntries, error: clockError } = await supabase
      .from('clock_entries')
      .select('*')
      .eq('project_id', input.projectId);

    if (clockError) {
      throw new Error(`Failed to fetch clock entries: ${clockError.message}`);
    }

    // Fetch all users for labor cost calculation
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*');

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    const totalExpenses = (projectExpenses || []).reduce((sum: number, e: any) => sum + e.amount, 0);

    const expensesByCategory = (projectExpenses || []).reduce((acc: Record<string, number>, e: any) => {
      const category = e.subcategory || e.type;
      acc[category] = (acc[category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const laborByEmployeeMap = new Map<string, {
      employeeId: string;
      employeeName: string;
      totalHours: number;
      hourlyRate: number;
      totalCost: number;
    }>();

    (projectClockEntries || []).forEach((entry: any) => {
      if (entry.clock_out) {
        const user = (users || []).find((u: any) => u.id === entry.employee_id);
        const hourlyRate = user?.hourly_rate || 0;

        const hoursWorked = (new Date(entry.clock_out).getTime() - new Date(entry.clock_in).getTime()) / (1000 * 60 * 60);

        let netHours = hoursWorked;
        if (entry.lunch_breaks) {
          entry.lunch_breaks.forEach((lunch: any) => {
            if (lunch.end_time) {
              const lunchHours = (new Date(lunch.end_time).getTime() - new Date(lunch.start_time).getTime()) / (1000 * 60 * 60);
              netHours -= lunchHours;
            }
          });
        }

        const existing = laborByEmployeeMap.get(entry.employee_id);
        if (existing) {
          existing.totalHours += netHours;
          existing.totalCost = existing.totalHours * existing.hourlyRate;
        } else {
          laborByEmployeeMap.set(entry.employee_id, {
            employeeId: entry.employee_id,
            employeeName: user?.name || 'Unknown Employee',
            totalHours: netHours,
            hourlyRate: hourlyRate,
            totalCost: netHours * hourlyRate,
          });
        }
      }
    });

    const laborByEmployee = Array.from(laborByEmployeeMap.values());
    const totalLaborCost = laborByEmployee.reduce((sum, emp) => sum + emp.totalCost, 0);

    const subcontractorExpenses = (projectExpenses || []).filter((e: any) =>
      e.type.toLowerCase() === 'subcontractor' ||
      e.subcategory?.toLowerCase().includes('subcontractor')
    );
    const totalSubcontractorCost = subcontractorExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);

    const totalCost = totalExpenses + totalLaborCost;

    console.log('[Project Costs] Summary:', {
      projectId: input.projectId,
      totalExpenses,
      totalLaborCost,
      totalSubcontractorCost,
      totalCost,
      employeeCount: laborByEmployee.length,
    });

    return {
      totalExpenses,
      totalLaborCost,
      totalSubcontractorCost,
      totalCost,
      expensesByCategory,
      laborByEmployee,
      expensesBreakdown: (projectExpenses || []).map((e: any) => ({
        id: e.id,
        type: e.type,
        subcategory: e.subcategory,
        amount: e.amount,
        store: e.store,
        date: e.date,
      })),
    };
  });
