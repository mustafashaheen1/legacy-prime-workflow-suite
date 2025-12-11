import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { fixtureExpenses, fixtureClockEntries, fixtureUsers } from '../../../../../mocks/fixtures.js';

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
  .query(({ input }): CostBreakdown => {
    console.log('[Project Costs] Calculating costs for project:', input.projectId);

    const projectExpenses = fixtureExpenses.filter(e => e.projectId === input.projectId);
    
    const projectClockEntries = fixtureClockEntries.filter(e => e.projectId === input.projectId);

    const totalExpenses = projectExpenses.reduce((sum, e) => sum + e.amount, 0);

    const expensesByCategory = projectExpenses.reduce((acc, e) => {
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

    projectClockEntries.forEach(entry => {
      if (entry.clockOut) {
        const user = fixtureUsers.find(u => u.id === entry.employeeId);
        const hourlyRate = user?.hourlyRate || 0;
        
        const hoursWorked = (new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / (1000 * 60 * 60);
        
        let netHours = hoursWorked;
        if (entry.lunchBreaks) {
          entry.lunchBreaks.forEach(lunch => {
            if (lunch.endTime) {
              const lunchHours = (new Date(lunch.endTime).getTime() - new Date(lunch.startTime).getTime()) / (1000 * 60 * 60);
              netHours -= lunchHours;
            }
          });
        }

        const existing = laborByEmployeeMap.get(entry.employeeId);
        if (existing) {
          existing.totalHours += netHours;
          existing.totalCost = existing.totalHours * existing.hourlyRate;
        } else {
          laborByEmployeeMap.set(entry.employeeId, {
            employeeId: entry.employeeId,
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

    const subcontractorExpenses = projectExpenses.filter(e => 
      e.type.toLowerCase() === 'subcontractor' || 
      e.subcategory?.toLowerCase().includes('subcontractor')
    );
    const totalSubcontractorCost = subcontractorExpenses.reduce((sum, e) => sum + e.amount, 0);

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
      expensesBreakdown: projectExpenses.map(e => ({
        id: e.id,
        type: e.type,
        subcategory: e.subcategory,
        amount: e.amount,
        store: e.store,
        date: e.date,
      })),
    };
  });
