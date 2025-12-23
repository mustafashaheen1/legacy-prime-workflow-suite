import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

export const getEstimatesProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().uuid(),
      companyId: z.string().uuid(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Estimates] Getting estimates for project:', input.projectId);

    try {
      // 1. Get estimates for the project
      const { data: estimates, error: estimatesError } = await supabase
        .from('estimates')
        .select('*')
        .eq('project_id', input.projectId)
        .eq('company_id', input.companyId)
        .order('created_date', { ascending: false });

      if (estimatesError) {
        console.error('[Estimates] Error getting estimates:', estimatesError);
        throw new Error(`Failed to get estimates: ${estimatesError.message}`);
      }

      if (!estimates || estimates.length === 0) {
        console.log('[Estimates] No estimates found for project:', input.projectId);
        return {
          success: true,
          estimates: [],
        };
      }

      // 2. Get items for all estimates
      const estimateIds = estimates.map(e => e.id);
      const { data: allItems, error: itemsError } = await supabase
        .from('estimate_items')
        .select('*')
        .in('estimate_id', estimateIds)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('[Estimates] Error getting estimate items:', itemsError);
        throw new Error(`Failed to get estimate items: ${itemsError.message}`);
      }

      // 3. Map items to their estimates
      const estimatesWithItems = estimates.map(estimate => ({
        id: estimate.id,
        projectId: estimate.project_id,
        name: estimate.name,
        subtotal: estimate.subtotal,
        taxRate: estimate.tax_rate,
        taxAmount: estimate.tax_amount,
        total: estimate.total,
        status: estimate.status,
        createdDate: estimate.created_date,
        items: (allItems || [])
          .filter(item => item.estimate_id === estimate.id)
          .map(item => ({
            id: item.id,
            priceListItemId: item.price_list_item_id,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            customPrice: item.custom_price,
            total: item.total,
            budget: item.budget,
            budgetUnitPrice: item.budget_unit_price,
            notes: item.notes,
            customName: item.custom_name,
            customUnit: item.custom_unit,
            customCategory: item.custom_category,
            isSeparator: item.is_separator,
            separatorLabel: item.separator_label,
          })),
      }));

      console.log('[Estimates] Retrieved', estimatesWithItems.length, 'estimates with items');

      return {
        success: true,
        estimates: estimatesWithItems,
      };
    } catch (error: any) {
      console.error('[Estimates] Unexpected error getting estimates:', error);
      throw new Error(error.message || 'Failed to get estimates');
    }
  });
