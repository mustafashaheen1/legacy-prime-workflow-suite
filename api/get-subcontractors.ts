import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Direct API endpoint for fetching subcontractors
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Get Subcontractors] Starting request...');

  try {
    // Support both GET with query params and POST with body
    const companyId = req.method === 'GET'
      ? req.query.companyId as string
      : req.body?.companyId;

    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Get Subcontractors] Supabase not configured');
      return res.status(500).json({
        error: 'Database not configured. Please add Supabase environment variables.',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Get Subcontractors] Fetching for company:', companyId);

    const { data, error } = await supabase
      .from('subcontractors')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Get Subcontractors] Error:', error);
      return res.status(500).json({
        error: `Failed to fetch subcontractors: ${error.message}`,
      });
    }

    console.log('[Get Subcontractors] Found', data?.length || 0, 'subcontractors');

    // Convert to camelCase
    const subcontractors = (data || []).map((sub: any) => ({
      id: sub.id,
      name: sub.name,
      companyName: sub.company_name,
      email: sub.email,
      phone: sub.phone,
      trade: sub.trade,
      rating: sub.rating || undefined,
      hourlyRate: sub.hourly_rate || undefined,
      availability: sub.availability,
      certifications: sub.certifications || [],
      address: sub.address || undefined,
      insuranceExpiry: sub.insurance_expiry || undefined,
      notes: sub.notes || undefined,
      avatar: sub.avatar || undefined,
      createdAt: sub.created_at,
      isActive: sub.is_active,
      approved: sub.approved,
      approvedBy: sub.approved_by || undefined,
      approvedDate: sub.approved_date || undefined,
      registrationToken: sub.registration_token || undefined,
      registrationCompleted: sub.registration_completed || false,
      businessFiles: [],
    }));

    return res.status(200).json({ subcontractors });
  } catch (error: any) {
    console.error('[Get Subcontractors] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch subcontractors',
    });
  }
}
