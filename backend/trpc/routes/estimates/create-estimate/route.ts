import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { supabase } from "../../../../lib/supabase.js";

const estimateItemSchema = z.object({
  priceListItemId: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  customPrice: z.number().optional(),
  total: z.number(),
  budget: z.number().optional(),
  budgetUnitPrice: z.number().optional(),
  notes: z.string().optional(),
  customName: z.string().optional(),
  customUnit: z.string().optional(),
  customCategory: z.string().optional(),
  isSeparator: z.boolean().optional(),
  separatorLabel: z.string().optional(),
});

export const createEstimateProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      projectId: z.string().uuid(),
      name: z.string().min(1),
      items: z.array(estimateItemSchema),
      subtotal: z.number(),
      taxRate: z.number(),
      taxAmount: z.number(),
      total: z.number(),
      status: z.enum(['draft', 'sent', 'approved', 'rejected']).default('draft'),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Estimates] Creating estimate:', input.name, 'for project:', input.projectId);

    try {
      // 1. Insert the estimate record
      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .insert({
          company_id: input.companyId,
          project_id: input.projectId,
          name: input.name,
          subtotal: input.subtotal,
          tax_rate: input.taxRate,
          tax_amount: input.taxAmount,
          total: input.total,
          status: input.status,
        } as any)
        .select()
        .single();

      if (estimateError) {
        console.error('[Estimates] Error creating estimate:', estimateError);
        throw new Error(`Failed to create estimate: ${estimateError.message}`);
      }

      if (!estimate) {
        throw new Error('No data returned from estimate insert');
      }

      console.log('[Estimates] Estimate created successfully:', estimate.id);

      // 2. Insert the estimate items
      const itemsToInsert = input.items.map(item => ({
        estimate_id: estimate.id,
        price_list_item_id: item.priceListItemId,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        custom_price: item.customPrice,
        total: item.total,
        budget: item.budget,
        budget_unit_price: item.budgetUnitPrice,
        notes: item.notes,
        custom_name: item.customName,
        custom_unit: item.customUnit,
        custom_category: item.customCategory,
        is_separator: item.isSeparator || false,
        separator_label: item.separatorLabel,
      }));

      const { data: items, error: itemsError } = await supabase
        .from('estimate_items')
        .insert(itemsToInsert as any)
        .select();

      if (itemsError) {
        console.error('[Estimates] Error creating estimate items:', itemsError);
        // Rollback: delete the estimate
        await supabase.from('estimates').delete().eq('id', estimate.id);
        throw new Error(`Failed to create estimate items: ${itemsError.message}`);
      }

      console.log('[Estimates] Estimate items created successfully:', items?.length);

      return {
        success: true,
        estimate: {
          id: estimate.id,
          projectId: estimate.project_id,
          name: estimate.name,
          subtotal: estimate.subtotal,
          taxRate: estimate.tax_rate,
          taxAmount: estimate.tax_amount,
          total: estimate.total,
          status: estimate.status,
          createdDate: estimate.created_date,
          items: items?.map(item => ({
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
          })) || [],
        },
      };
    } catch (error: any) {
      console.error('[Estimates] Unexpected error creating estimate:', error);
      throw new Error(error.message || 'Failed to create estimate');
    }
  });
