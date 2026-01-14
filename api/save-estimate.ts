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

    // Insert estimate directly
    const { data, error } = await supabase
      .from('estimates')
      .insert({
        id: estimate.id,
        client_id: estimate.clientId,
        company_id: companyId,
        name: estimate.name,
        items: estimate.items,
        subtotal: estimate.subtotal,
        tax_rate: estimate.taxRate,
        tax_amount: estimate.taxAmount,
        total: estimate.total,
        status: estimate.status,
        created_date: estimate.createdDate,
      })
      .select()
      .single();

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
