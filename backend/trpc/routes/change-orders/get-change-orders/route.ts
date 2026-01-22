import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { ChangeOrder } from '../../../../../types/index';
import { createClient } from '@supabase/supabase-js';

const changeOrdersStore: ChangeOrder[] = [];

export const getChangeOrdersProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Backend] Fetching change orders for project:', input.projectId);

    // Try to fetch from Supabase first
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        let query = supabase
          .from('change_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (input.projectId) {
          query = query.eq('project_id', input.projectId);
        }

        const { data, error } = await query;

        if (error) {
          console.error('[Backend] Supabase error fetching change orders:', error);
          throw new Error(`Failed to fetch from database: ${error.message}`);
        }

        // Fetch history for all change orders
        const changeOrderIds = (data || []).map((row: any) => row.id);
        let historyMap: Record<string, any[]> = {};

        if (changeOrderIds.length > 0) {
          const { data: historyData } = await supabase
            .from('change_order_history')
            .select('*')
            .in('change_order_id', changeOrderIds)
            .order('timestamp', { ascending: false });

          // Group history by change order ID
          (historyData || []).forEach((entry: any) => {
            if (!historyMap[entry.change_order_id]) {
              historyMap[entry.change_order_id] = [];
            }
            historyMap[entry.change_order_id].push({
              id: entry.id,
              changeOrderId: entry.change_order_id,
              action: entry.action,
              previousStatus: entry.previous_status,
              newStatus: entry.new_status,
              userId: entry.user_id,
              userName: entry.user_name,
              timestamp: entry.timestamp,
              notes: entry.notes,
            });
          });
        }

        // Convert snake_case to camelCase
        const changeOrders: ChangeOrder[] = (data || []).map((row: any) => ({
          id: row.id,
          projectId: row.project_id,
          description: row.description,
          amount: row.amount,
          date: row.date,
          status: row.status,
          approvedBy: row.approved_by,
          approvedDate: row.approved_date,
          notes: row.notes,
          createdAt: row.created_at,
          history: historyMap[row.id] || [],
        }));

        console.log('[Backend] Fetched', changeOrders.length, 'change orders from Supabase');
        return { changeOrders };
      } catch (error) {
        console.error('[Backend] Error querying Supabase:', error);
        // Fall back to in-memory store on error
      }
    }

    // Fallback to in-memory store
    console.warn('[Backend] Using in-memory store for change orders');
    const filteredChangeOrders = input.projectId
      ? changeOrdersStore.filter(co => co.projectId === input.projectId)
      : changeOrdersStore;

    return { changeOrders: filteredChangeOrders };
  });

export { changeOrdersStore };
