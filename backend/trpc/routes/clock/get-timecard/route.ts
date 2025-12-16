import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const inputSchema = z.object({
  employeeId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  period: z.enum(['daily', 'weekly', 'bi-weekly']).optional(),
});

export const getTimecardProcedure = publicProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    console.log('[Timecard] Generating timecard for employee:', input.employeeId);
    console.log('[Timecard] Period:', input.startDate, 'to', input.endDate);

    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );

    const { data: clockEntries, error } = await supabase
      .from('clock_entries')
      .select('*')
      .eq('employee_id', input.employeeId)
      .gte('clock_in', input.startDate)
      .lte('clock_in', input.endDate)
      .not('clock_out', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch clock entries: ${error.message}`);
    }

    const filteredEntries = clockEntries || [];

    const calculateHours = (entry: any) => {
      if (!entry.clock_out) return 0;
      const start = new Date(entry.clock_in).getTime();
      const end = new Date(entry.clock_out).getTime();
      let totalMs = end - start;

      if (entry.lunch_breaks) {
        entry.lunch_breaks.forEach((lunch: any) => {
          if (lunch.end_time) {
            const lunchStart = new Date(lunch.start_time).getTime();
            const lunchEnd = new Date(lunch.end_time).getTime();
            totalMs -= (lunchEnd - lunchStart);
          }
        });
      }

      return totalMs / (1000 * 60 * 60);
    };

    const groupedByDate = filteredEntries.reduce((acc: Record<string, any[]>, entry: any) => {
      const date = new Date(entry.clock_in).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push({
        ...entry,
        hours: calculateHours(entry),
      });
      return acc;
    }, {} as Record<string, any[]>);

    const totalHours = filteredEntries.reduce((sum: number, entry: any) => sum + calculateHours(entry), 0);
    const regularHours = Math.min(totalHours, input.period === 'weekly' ? 40 : input.period === 'bi-weekly' ? 80 : totalHours);
    const overtimeHours = Math.max(0, totalHours - regularHours);

    const uniqueDays = new Set(
      filteredEntries.map((entry: any) => new Date(entry.clock_in).toDateString())
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
