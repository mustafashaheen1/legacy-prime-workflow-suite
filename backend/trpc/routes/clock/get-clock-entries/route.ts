import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

const inputSchema = z.object({
  companyId: z.string().uuid(),
  projectId: z.string().optional(),
  employeeId: z.string().optional(),
  date: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getClockEntriesProcedure = publicProcedure
  .input(inputSchema)
  .query(async ({ input }) => {
    console.log('[Clock] Getting clock entries for company:', input.companyId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Clock] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // Build query
      let query = supabase
        .from('clock_entries')
        .select('*')
        .eq('company_id', input.companyId);

      // Apply filters
      if (input.projectId) {
        query = query.eq('project_id', input.projectId);
      }

      if (input.employeeId) {
        query = query.eq('employee_id', input.employeeId);
      }

      if (input.date) {
        query = query.gte('clock_in', input.date).lt('clock_in', input.date + 'T23:59:59');
      }

      if (input.startDate && input.endDate) {
        query = query.gte('clock_in', input.startDate).lte('clock_in', input.endDate);
      }

      // Order by clock in time descending
      query = query.order('clock_in', { ascending: false });

      const { data: dbEntries, error } = await query;

      if (error) {
        console.error('[Clock] Error fetching clock entries:', error);
        throw new Error(`Failed to fetch clock entries: ${error.message}`);
      }

      // Transform to frontend format
      const filteredEntries = (dbEntries || []).map((entry: any) => ({
        id: entry.id,
        employeeId: entry.employee_id,
        projectId: entry.project_id,
        clockIn: entry.clock_in,
        clockOut: entry.clock_out || undefined,
        location: entry.location,
        workPerformed: entry.work_performed || '',
        lunchBreaks: entry.lunch_breaks || [],
      }));

      // Calculate total hours
      const totalHours = filteredEntries.reduce((sum, e) => {
        if (e.clockOut) {
          let hoursWorked = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);

          if (e.lunchBreaks) {
            e.lunchBreaks.forEach((lunch: any) => {
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

      // Get user hourly rates from database
      const userIds = [...new Set(filteredEntries.map(e => e.employeeId))];
      const { data: users } = await supabase
        .from('users')
        .select('id, hourly_rate')
        .in('id', userIds);

      const userRates = (users || []).reduce((acc: any, u: any) => {
        acc[u.id] = u.hourly_rate || 0;
        return acc;
      }, {});

      // Calculate by employee summary
      const byEmployee = filteredEntries.reduce((acc, e) => {
        const hourlyRate = userRates[e.employeeId] || 0;

        if (!acc[e.employeeId]) {
          acc[e.employeeId] = { count: 0, hours: 0, cost: 0, hourlyRate };
        }
        acc[e.employeeId].count++;
        if (e.clockOut) {
          let hoursWorked = (new Date(e.clockOut).getTime() - new Date(e.clockIn).getTime()) / (1000 * 60 * 60);

          if (e.lunchBreaks) {
            e.lunchBreaks.forEach((lunch: any) => {
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

      console.log('[Clock] Found', filteredEntries.length, 'clock entries');

      return {
        entries: filteredEntries,
        totalHours,
        count: filteredEntries.length,
        byEmployee,
      };
    } catch (error: any) {
      console.error('[Clock] Unexpected error:', error);
      throw new Error(error.message || 'Failed to fetch clock entries');
    }
  });
