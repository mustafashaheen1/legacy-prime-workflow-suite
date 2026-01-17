import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

// API endpoint to update an existing estimate and its items
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[UpdateEstimate] ===== API ROUTE STARTED =====');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const {
      estimateId,
      companyId,
      clientId,
      name,
      items,
      subtotal,
      taxRate,
      taxAmount,
      total,
      status,
    } = req.body;

    // Validate required fields
    if (!estimateId) {
      return res.status(400).json({ error: 'Missing required field: estimateId' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[UpdateEstimate] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[UpdateEstimate] Updating estimate:', estimateId);

    // Step 1: Update the estimate record
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (subtotal !== undefined) updateData.subtotal = subtotal;
    if (taxRate !== undefined) updateData.tax_rate = taxRate;
    if (taxAmount !== undefined) updateData.tax_amount = taxAmount;
    if (total !== undefined) updateData.total = total;
    if (status !== undefined) updateData.status = status;
    if (clientId !== undefined) updateData.client_id = clientId;

    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .update(updateData)
      .eq('id', estimateId)
      .select()
      .single();

    if (estimateError) {
      console.error('[UpdateEstimate] Error updating estimate:', estimateError);
      return res.status(500).json({ error: `Failed to update estimate: ${estimateError.message}` });
    }

    console.log('[UpdateEstimate] Estimate record updated in', Date.now() - startTime, 'ms');

    // Step 2: Update items (delete existing and insert new)
    if (items && Array.isArray(items)) {
      console.log('[UpdateEstimate] Updating', items.length, 'items...');

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('estimate_items')
        .delete()
        .eq('estimate_id', estimateId);

      if (deleteError) {
        console.error('[UpdateEstimate] Error deleting old items:', deleteError);
        return res.status(500).json({ error: `Failed to update estimate items: ${deleteError.message}` });
      }

      // Insert new items
      if (items.length > 0) {
        const itemsToInsert = items.map((item: any) => ({
          estimate_id: estimateId,
          price_list_item_id: item.priceListItemId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          custom_price: item.customPrice || null,
          total: item.total,
          budget: item.budget || null,
          budget_unit_price: item.budgetUnitPrice || null,
          notes: item.notes || null,
          custom_name: item.customName || null,
          custom_unit: item.customUnit || null,
          custom_category: item.customCategory || null,
          is_separator: item.isSeparator || false,
          separator_label: item.separatorLabel || null,
          image_url: item.imageUrl || null,
        }));

        const { error: insertError } = await supabase
          .from('estimate_items')
          .insert(itemsToInsert);

        if (insertError) {
          console.error('[UpdateEstimate] Error inserting new items:', insertError);
          return res.status(500).json({ error: `Failed to insert estimate items: ${insertError.message}` });
        }
      }

      console.log('[UpdateEstimate] Items updated successfully');
    }

    console.log('[UpdateEstimate] ===== ESTIMATE UPDATED SUCCESSFULLY =====');
    console.log('[UpdateEstimate] Total time:', Date.now() - startTime, 'ms');

    return res.status(200).json({
      success: true,
      estimate: {
        id: estimate.id,
        clientId: estimate.client_id,
        name: estimate.name,
        subtotal: estimate.subtotal,
        taxRate: estimate.tax_rate,
        taxAmount: estimate.tax_amount,
        total: estimate.total,
        status: estimate.status,
        createdDate: estimate.created_date,
      },
    });
  } catch (error: any) {
    console.error('[UpdateEstimate] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update estimate',
    });
  }
}
