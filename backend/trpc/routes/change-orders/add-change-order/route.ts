import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { changeOrdersStore } from '../get-change-orders/route.js';
import { createClient } from '@supabase/supabase-js';

export const addChangeOrderProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string(),
      projectId: z.string(),
      description: z.string(),
      amount: z.number(),
      date: z.string(),
      status: z.enum(['pending', 'approved', 'rejected']),
      approvedBy: z.string().optional(),
      approvedDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('[Backend] Adding change order with input:', input);

      const changeOrder = {
        id: `change-order-${Date.now()}`,
        projectId: input.projectId,
        description: input.description,
        amount: input.amount,
        date: input.date,
        status: input.status,
        approvedBy: input.approvedBy,
        approvedDate: input.approvedDate,
        notes: input.notes,
        createdAt: new Date().toISOString(),
      };

      // Save to in-memory store for backward compatibility
      changeOrdersStore.push(changeOrder);

      // Save to Supabase database
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data, error } = await supabase
          .from('change_orders')
          .insert({
            id: changeOrder.id,
            company_id: input.companyId,
            project_id: input.projectId,
            description: input.description,
            amount: input.amount,
            date: input.date,
            status: input.status,
            approved_by: input.approvedBy,
            approved_date: input.approvedDate,
            notes: input.notes,
            created_at: changeOrder.createdAt,
          })
          .select()
          .single();

        if (error) {
          console.error('[Backend] Supabase error adding change order:', error);
          throw new Error(`Failed to save to database: ${error.message}`);
        }

        console.log('[Backend] Change order saved to Supabase:', data);

        // Create history entry for creation
        try {
          await supabase.from('change_order_history').insert({
            change_order_id: changeOrder.id,
            action: 'created',
            new_status: input.status,
            user_id: input.companyId, // Using companyId as user identifier for now
            user_name: 'System',
            timestamp: new Date().toISOString(),
          });
          console.log('[Backend] Change order history entry created');
        } catch (historyError) {
          console.error('[Backend] Failed to create history entry:', historyError);
          // Don't fail the main operation if history fails
        }
      } else {
        console.warn('[Backend] Supabase not configured - change order saved to memory only');
      }

      console.log('[Backend] Change order created:', changeOrder);
      console.log('[Backend] Total change orders in store:', changeOrdersStore.length);

      return { success: true, changeOrder };
    } catch (error) {
      console.error('[Backend] Error adding change order:', error);
      throw new Error('Failed to add change order: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  });
