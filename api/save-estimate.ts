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

    // Use raw SQL to bypass schema cache issues
    const { data, error } = await supabase.rpc('insert_estimate', {
      p_id: estimate.id,
      p_project_id: estimate.projectId,
      p_name: estimate.name,
      p_items: JSON.stringify(estimate.items),
      p_subtotal: estimate.subtotal,
      p_tax_rate: estimate.taxRate,
      p_tax_amount: estimate.taxAmount,
      p_total: estimate.total,
      p_status: estimate.status,
      p_created_date: estimate.createdDate,
    });

    if (error) {
      console.error('[SaveEstimate] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[SaveEstimate] ===== ESTIMATE SAVED SUCCESSFULLY =====');

    return res.status(200).json({
      success: true,
      estimate: data,
    });
  } catch (error: any) {
    console.error('[SaveEstimate] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
