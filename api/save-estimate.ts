import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[SaveEstimate] ===== API ROUTE STARTED =====');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { estimate } = req.body;

    if (!estimate) {
      return res.status(400).json({ error: 'Estimate data required' });
    }

    console.log('[SaveEstimate] Saving estimate:', estimate.id);

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[SaveEstimate] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to get company_id from client
    let companyId = null;
    if (estimate.clientId) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('company_id')
        .eq('id', estimate.clientId)
        .single();

      if (clientData) {
        companyId = clientData.company_id;
      } else {
        console.log('[SaveEstimate] Client not found in DB, using null for company_id');
      }
    }

    // Step 1: Insert estimate record (without items column)
    const { data: estimateData, error: estimateError } = await supabase
      .from('estimates')
      .insert({
        id: estimate.id,
        client_id: estimate.clientId,
        company_id: companyId,
        name: estimate.name,
        subtotal: estimate.subtotal,
        tax_rate: estimate.taxRate,
        tax_amount: estimate.taxAmount,
        total: estimate.total,
        status: estimate.status,
        created_date: estimate.createdDate,
      })
      .select()
      .single();

    if (estimateError) {
      console.error('[SaveEstimate] Database error:', estimateError);
      return res.status(500).json({ error: estimateError.message });
    }

    // Step 2: Insert items into estimate_items table (same as create-estimate.ts)
    if (estimate.items && estimate.items.length > 0) {
      console.log('[SaveEstimate] Inserting', estimate.items.length, 'items into estimate_items table');
      const itemsToInsert = estimate.items.map((item: any) => ({
        estimate_id: estimate.id,
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

      const { error: itemsError } = await supabase
        .from('estimate_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('[SaveEstimate] Error inserting items:', itemsError);
        // Rollback: delete the estimate
        await supabase.from('estimates').delete().eq('id', estimate.id);
        return res.status(500).json({ error: `Failed to save estimate items: ${itemsError.message}` });
      }

      console.log('[SaveEstimate] Items inserted successfully');
    }

    console.log('[SaveEstimate] ===== ESTIMATE SAVED SUCCESSFULLY =====');

    return res.status(200).json({
      success: true,
      estimate: estimateData,
    });
  } catch (error: any) {
    console.error('[SaveEstimate] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
