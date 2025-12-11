import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { fixtureClockEntries } from '../../../../../mocks/fixtures.js';

const inputSchema = z.object({
  employeeId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  period: z.enum(['daily', 'weekly', 'bi-weekly']).optional(),
});

export const getTimecardProcedure = publicProcedure
  .input(inputSchema)
  .query(({ input }) => {
    console.log('[Timecard] Generating timecard for employee:', input.employeeId);
    console.log('[Timecard] Period:', input.startDate, 'to', input.endDate);

    const filteredEntries = fixtureClockEntries.filter(e => {
      const entryDate = new Date(e.clockIn);
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      
      return e.employeeId === input.employeeId && 
             entryDate >= start && 
             entryDate <= end &&
             e.clockOut;
    });

    const calculateHours = (entry: typeof fixtureClockEntries[0]) => {
      if (!entry.clockOut) return 0;
      const start = new Date(entry.clockIn).getTime();
      const end = new Date(entry.clockOut).getTime();
      let totalMs = end - start;

      if (entry.lunchBreaks) {
        entry.lunchBreaks.forEach(lunch => {
          if (lunch.endTime) {
            const lunchStart = new Date(lunch.startTime).getTime();
            const lunchEnd = new Date(lunch.endTime).getTime();
            totalMs -= (lunchEnd - lunchStart);
          }
        });
      }

      return totalMs / (1000 * 60 * 60);
    };

    const groupedByDate = filteredEntries.reduce((acc, entry) => {
      const date = new Date(entry.clockIn).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push({
        ...entry,
        hours: calculateHours(entry),
      });
      return acc;
    }, {} as Record<string, any[]>);

    const totalHours = filteredEntries.reduce((sum, entry) => sum + calculateHours(entry), 0);
    const regularHours = Math.min(totalHours, input.period === 'weekly' ? 40 : input.period === 'bi-weekly' ? 80 : totalHours);
    const overtimeHours = Math.max(0, totalHours - regularHours);

    const uniqueDays = new Set(
      filteredEntries.map(entry => new Date(entry.clockIn).toDateString())
    ).size;

    return {
      employeeId: input.employeeId,
      startDate: input.startDate,
      endDate: input.endDate,
      period: input.period || 'custom',
      entries: groupedByDate,
      summary: {
        totalHours: totalHours,
        regularHours: regularHours,
        overtimeHours: overtimeHours,
        totalDays: uniqueDays,
        averageHoursPerDay: uniqueDays > 0 ? totalHours / uniqueDays : 0,
        totalEntries: filteredEntries.length,
      },
    };
  });
