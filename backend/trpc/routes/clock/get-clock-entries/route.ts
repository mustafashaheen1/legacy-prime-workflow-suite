import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';
import { fixtureClockEntries, fixtureUsers } from '@/mocks/fixtures';

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
        let hoursWorked = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);
        
        if (e.lunchBreaks) {
          e.lunchBreaks.forEach(lunch => {
            if (lunch.endTime) {
              const lunchHours = (new Date(lunch.endTime).getTime() - new Date(lunch.startTime).getTime()) / (1000 * 60 * 60);
              hoursWorked -= lunchHours;
            }
          });
        }
        
        return sum + hoursWorked;
      }
      return sum;
    }, 0);

    const byEmployee = filteredEntries.reduce((acc, e) => {
      const user = fixtureUsers.find(u => u.id === e.employeeId);
      const hourlyRate = user?.hourlyRate || 0;
      
      if (!acc[e.employeeId]) {
        acc[e.employeeId] = { count: 0, hours: 0, cost: 0, hourlyRate };
      }
      acc[e.employeeId].count++;
      if (e.clockOut) {
        let hoursWorked = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);
        
        if (e.lunchBreaks) {
          e.lunchBreaks.forEach(lunch => {
            if (lunch.endTime) {
              const lunchHours = (new Date(lunch.endTime).getTime() - new Date(lunch.startTime).getTime()) / (1000 * 60 * 60);
              hoursWorked -= lunchHours;
            }
          });
        }
        
        acc[e.employeeId].hours += hoursWorked;
        acc[e.employeeId].cost = acc[e.employeeId].hours * hourlyRate;
      }
      return acc;
    }, {} as Record<string, { count: number; hours: number; cost: number; hourlyRate: number }>);

    return {
      entries: filteredEntries,
      totalHours,
      count: filteredEntries.length,
      byEmployee,
    };
  });
