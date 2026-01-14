import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[GetEstimates] ===== API ROUTE STARTED =====');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId } = req.query;

    console.log('[GetEstimates] Fetching estimates for company:', companyId);

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[GetEstimates] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all estimates (we'll filter by company on the client side if needed)
    let query = supabase
      .from('estimates')
      .select('*')
      .order('created_date', { ascending: false });

    // Optionally filter by company_id if provided
    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[GetEstimates] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[GetEstimates] Found', data?.length || 0, 'estimates');

    // Transform database format to app format
    const estimates = (data || []).map((row: any) => ({
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      items: row.items || [],
      subtotal: parseFloat(row.subtotal),
      taxRate: parseFloat(row.tax_rate),
      taxAmount: parseFloat(row.tax_amount),
      total: parseFloat(row.total),
      status: row.status,
      createdDate: row.created_date,
    }));

    return res.status(200).json({
      success: true,
      estimates,
    });
  } catch (error: any) {
    console.error('[GetEstimates] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
