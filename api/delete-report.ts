import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// API endpoint to delete a report from the database
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reportId, companyId } = req.method === 'DELETE' ? req.query : req.body;

    if (!reportId) {
      return res.status(400).json({ error: 'Missing required parameter: reportId' });
    }
    if (!companyId) {
      return res.status(400).json({ error: 'Missing required parameter: companyId' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Delete Report] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Delete Report] Deleting report:', reportId, 'for company:', companyId);

    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', reportId)
      .eq('company_id', companyId);

    if (error) {
      console.error('[Delete Report] Database error:', error);
      return res.status(500).json({ error: `Failed to delete report: ${error.message}` });
    }

    console.log('[Delete Report] Report deleted successfully');

    return res.status(200).json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (error: any) {
    console.error('[Delete Report] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete report' });
  }
}
