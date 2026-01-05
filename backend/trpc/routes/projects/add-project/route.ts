import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const addProjectProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      name: z.string().min(1),
      budget: z.number().default(0),
      expenses: z.number().default(0),
      progress: z.number().min(0).max(100).default(0),
      status: z.enum(['active', 'completed', 'on-hold', 'archived']).default('active'),
      image: z.string().optional(),
      hoursWorked: z.number().default(0),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Projects] ==================== START ====================');
    console.log('[Projects] Procedure called at:', new Date().toISOString());
    console.log('[Projects] Input:', JSON.stringify(input, null, 2));

    try {
      console.log('[Projects] Step 1: Checking environment variables...');
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.error('[Projects] Supabase not configured');
        throw new Error('Database not configured. Please add Supabase environment variables.');
      }
      console.log('[Projects] Environment variables OK');

      console.log('[Projects] Step 2: Creating Supabase client...');
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      console.log('[Projects] Supabase client created');

      console.log('[Projects] Step 3: Preparing insert data...');
      const insertData = {
        company_id: input.companyId,
        name: input.name,
        budget: input.budget,
        expenses: input.expenses,
        progress: input.progress,
        status: input.status,
        image: input.image,
        hours_worked: input.hoursWorked,
        start_date: input.startDate,
        end_date: input.endDate,
      };
      console.log('[Projects] Insert data:', JSON.stringify(insertData, null, 2));

      console.log('[Projects] Step 4: Executing insert query...');
      const insertStart = Date.now();

      const { data, error } = await Promise.race([
        supabase
          .from('projects')
          .insert(insertData as any)
          .select()
          .single(),
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Insert query timeout after 30 seconds')), 30000)
        )
      ]);

      const insertDuration = Date.now() - insertStart;
      console.log('[Projects] Insert completed in', insertDuration, 'ms');

      if (error) {
        console.error('[Projects] Error adding project:', error);
        throw new Error(`Failed to add project: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Projects] Project added successfully:', data.id);

      const result = {
        success: true,
        project: {
          id: data.id,
          name: data.name,
          budget: Number(data.budget) || 0,
          expenses: Number(data.expenses) || 0,
          progress: data.progress || 0,
          status: data.status as 'active' | 'completed' | 'on-hold' | 'archived',
          image: data.image || '',
          hoursWorked: Number(data.hours_worked) || 0,
          startDate: data.start_date,
          endDate: data.end_date || undefined,
        },
      };

      console.log('[Projects] Step 5: Returning result');
      console.log('[Projects] ==================== END ====================');
      return result;
    } catch (error: any) {
      console.error('[Projects] ==================== ERROR ====================');
      console.error('[Projects] Error type:', error.constructor.name);
      console.error('[Projects] Error message:', error.message);
      console.error('[Projects] Error stack:', error.stack?.substring(0, 500));
      console.error('[Projects] ==================== ERROR END ====================');
      throw new Error(error.message || 'Failed to add project');
    }
  });
