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
    const startTime = Date.now();
    console.log('[Estimates] Creating estimate:', input.name, 'for project:', input.projectId);
    console.log('[Estimates] ⚠️ TEMPORARY: Skipping database operations for testing');

    try {
      // TEMPORARY: Return mock data without database operations
      const mockEstimateId = `estimate-${Date.now()}`;
      console.log('[Estimates] Mock estimate created:', mockEstimateId);
      console.log('[Estimates] Total time:', Date.now() - startTime, 'ms');

      return {
        success: true,
        estimate: {
          id: mockEstimateId,
          projectId: input.projectId,
          name: input.name,
          subtotal: input.subtotal,
          taxRate: input.taxRate,
          taxAmount: input.taxAmount,
          total: input.total,
          status: input.status,
          createdDate: new Date().toISOString(),
          items: input.items || [],
        },
      };

      // ORIGINAL CODE COMMENTED OUT FOR TESTING:
      /*
      // 1. Insert the estimate record
      console.log('[Estimates] Step 1: Inserting estimate record...');
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
        .select('id, project_id, name, subtotal, tax_rate, tax_amount, total, status, created_date')
        .single();

      console.log('[Estimates] Step 1 completed in', Date.now() - startTime, 'ms');

      if (estimateError) {
        console.error('[Estimates] Error creating estimate:', estimateError);
        throw new Error(`Failed to create estimate: ${estimateError.message}`);
      }

      if (!estimate) {
        throw new Error('No data returned from estimate insert');
      }

      console.log('[Estimates] Estimate created successfully:', estimate.id);

      // 2. Insert the estimate items (if any)
      if (input.items && input.items.length > 0) {
        console.log('[Estimates] Step 2: Inserting', input.items.length, 'estimate items...');
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

        const { error: itemsError } = await supabase
          .from('estimate_items')
          .insert(itemsToInsert as any);

        console.log('[Estimates] Step 2 completed in', Date.now() - startTime, 'ms');

        if (itemsError) {
          console.error('[Estimates] Error creating estimate items:', itemsError);
          // Rollback: delete the estimate
          await supabase.from('estimates').delete().eq('id', estimate.id);
          throw new Error(`Failed to create estimate items: ${itemsError.message}`);
        }

        console.log('[Estimates] Estimate items created successfully');
      }

      console.log('[Estimates] Total time:', Date.now() - startTime, 'ms');

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
          items: input.items || [],
        },
      };
      */
    } catch (error: any) {
      console.error('[Estimates] Unexpected error creating estimate:', error);
      console.error('[Estimates] Error occurred after', Date.now() - startTime, 'ms');
      throw new Error(error.message || 'Failed to create estimate');
    }
  });
