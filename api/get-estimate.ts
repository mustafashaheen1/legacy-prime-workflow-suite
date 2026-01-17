import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { estimateId } = req.query;

    if (!estimateId || typeof estimateId !== 'string') {
      return res.status(400).json({ error: 'estimateId is required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch estimate
    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .single();

    if (estimateError) {
      console.error('[Get Estimate] Database error:', estimateError);
      throw new Error(estimateError.message);
    }

    if (!estimate) {
      return res.status(404).json({
        success: false,
        error: 'Estimate not found',
      });
    }

    // Fetch estimate items - handle both storage formats
    let estimateItems: any[] = [];

    // Check if estimate has items stored as JSON column (from save-estimate.ts / takeoff)
    if (estimate.items && Array.isArray(estimate.items)) {
      console.log('[Get Estimate] Using items from JSON column (takeoff estimate)');
      estimateItems = estimate.items;
    } else {
      // Otherwise, fetch from estimate_items table (from create-estimate.ts / regular estimates)
      console.log('[Get Estimate] Fetching items from estimate_items table');
      const { data: items, error: itemsError } = await supabase
        .from('estimate_items')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('created_at', { ascending: true });

      if (itemsError) {
        console.error('[Get Estimate] Error fetching items:', itemsError);
        // Don't fail if items can't be loaded, just return empty array
      }

      estimateItems = (items || []).map((item: any) => ({
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
        imageUrl: item.image_url,
      }));
    }

    // Transform to match frontend format
    const transformedEstimate = {
      id: estimate.id,
      clientId: estimate.client_id,
      name: estimate.name,
      subtotal: estimate.subtotal,
      taxRate: estimate.tax_rate,
      taxAmount: estimate.tax_amount,
      total: estimate.total,
      status: estimate.status,
      createdDate: estimate.created_date,
      paidDate: estimate.paid_date,
      paymentId: estimate.payment_id,
      items: estimateItems,
    };

    console.log('[Get Estimate] Successfully loaded estimate:', estimateId, 'with', transformedEstimate.items.length, 'items');

    return res.status(200).json({
      success: true,
      estimate: transformedEstimate,
    });
  } catch (error: any) {
    console.error('[Get Estimate] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get estimate',
    });
  }
}
