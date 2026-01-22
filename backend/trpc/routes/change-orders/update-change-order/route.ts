import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { changeOrdersStore } from '../get-change-orders/route.js';
import { createClient } from '@supabase/supabase-js';

export const updateChangeOrderProcedure = publicProcedure
  .input(
    z.object({
      id: z.string(),
      status: z.enum(['pending', 'approved', 'rejected']).optional(),
      approvedBy: z.string().optional(),
      approvedDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Backend] Updating change order:', input.id);

    // Update in-memory store
    const changeOrder = changeOrdersStore.find(co => co.id === input.id);
    if (changeOrder) {
      if (input.status !== undefined) changeOrder.status = input.status;
      if (input.approvedBy !== undefined) changeOrder.approvedBy = input.approvedBy;
      if (input.approvedDate !== undefined) changeOrder.approvedDate = input.approvedDate;
      if (input.notes !== undefined) changeOrder.notes = input.notes;
      console.log('[Backend] Updated change order in memory store');
    }

    // Update in Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get current status before update for history tracking
        const { data: currentData } = await supabase
          .from('change_orders')
          .select('status')
          .eq('id', input.id)
          .single();

        const updateData: any = {};
        if (input.status !== undefined) updateData.status = input.status;
        if (input.approvedBy !== undefined) updateData.approved_by = input.approvedBy;
        if (input.approvedDate !== undefined) updateData.approved_date = input.approvedDate;
        if (input.notes !== undefined) updateData.notes = input.notes;

        const { data, error } = await supabase
          .from('change_orders')
          .update(updateData)
          .eq('id', input.id)
          .select()
          .single();

        if (error) {
          console.error('[Backend] Supabase error updating change order:', error);
          throw new Error(`Failed to update in database: ${error.message}`);
        }

        console.log('[Backend] Change order updated in Supabase:', data);

        // Create history entry if status changed
        if (input.status && currentData && currentData.status !== input.status) {
          try {
            const action = input.status === 'approved' ? 'approved' :
                          input.status === 'rejected' ? 'rejected' : 'updated';

            await supabase.from('change_order_history').insert({
              change_order_id: input.id,
              action,
              previous_status: currentData.status,
              new_status: input.status,
              user_id: input.approvedBy || 'system',
              user_name: 'User', // Should be passed from frontend
              timestamp: new Date().toISOString(),
              notes: input.notes,
            });
            console.log('[Backend] Change order history entry created for status change');
          } catch (historyError) {
            console.error('[Backend] Failed to create history entry:', historyError);
            // Don't fail the main operation if history fails
          }
        }

        // Convert snake_case to camelCase for return
        const updatedChangeOrder = {
          id: data.id,
          projectId: data.project_id,
          description: data.description,
          amount: data.amount,
          date: data.date,
          status: data.status,
          approvedBy: data.approved_by,
          approvedDate: data.approved_date,
          notes: data.notes,
          createdAt: data.created_at,
        };

        return { success: true, changeOrder: updatedChangeOrder };
      } catch (error) {
        console.error('[Backend] Error updating in Supabase:', error);
        throw error;
      }
    }

    console.warn('[Backend] Supabase not configured - updated memory store only');
    return { success: true, changeOrder };
  });
