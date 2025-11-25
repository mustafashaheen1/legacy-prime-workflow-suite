import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';
import { fixtureClockEntries } from '@/mocks/fixtures';

const inputSchema = z.object({
  projectId: z.string().optional(),
  employeeId: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getClockEntriesProcedure = publicProcedure
  .input(inputSchema)
  .query(({ input }) => {
    let filteredEntries = [...fixtureClockEntries];

    if (input.projectId) {
      filteredEntries = filteredEntries.filter(e => e.projectId === input.projectId);
    }

    if (input.employeeId) {
      filteredEntries = filteredEntries.filter(e => e.employeeId === input.employeeId);
    }

    if (input.date) {
      filteredEntries = filteredEntries.filter(e => 
        e.clockIn.startsWith(input.date!)
      );
    }

    if (input.startDate && input.endDate) {
      filteredEntries = filteredEntries.filter(e => 
        e.clockIn >= input.startDate! && e.clockIn <= input.endDate!
      );
    }

    const totalHours = filteredEntries.reduce((sum, e) => {
      if (e.clockOut) {
        const hoursWorked = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);
        return sum + hoursWorked;
      }
      return sum;
    }, 0);

    const byEmployee = filteredEntries.reduce((acc, e) => {
      if (!acc[e.employeeId]) {
        acc[e.employeeId] = { count: 0, hours: 0 };
      }
      acc[e.employeeId].count++;
      if (e.clockOut) {
        const hoursWorked = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);
        acc[e.employeeId].hours += hoursWorked;
      }
      return acc;
    }, {} as Record<string, { count: number; hours: number }>);

    return {
      entries: filteredEntries,
      totalHours,
      count: filteredEntries.length,
      byEmployee,
    };
  });
