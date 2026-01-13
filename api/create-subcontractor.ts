import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Direct API endpoint for creating subcontractors - bypasses tRPC
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Create Subcontractor] Starting request...');

  try {
    const {
      companyId,
      name,
      companyName,
      email,
      phone,
      trade,
      rating,
      hourlyRate,
      availability = 'available',
      certifications = [],
      address,
      insuranceExpiry,
      notes,
      avatar,
    } = req.body;

    // Validate required fields
    if (!companyId || !name || !companyName || !email || !phone || !trade) {
      return res.status(400).json({
        error: 'Missing required fields: companyId, name, companyName, email, phone, trade',
      });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Create Subcontractor] Supabase not configured');
      return res.status(500).json({
        error: 'Database not configured. Please add Supabase environment variables.',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Create Subcontractor] Inserting subcontractor:', name, 'for company:', companyId);

    const { data, error } = await supabase
      .from('subcontractors')
      .insert({
        company_id: companyId,
        name,
        company_name: companyName,
        email,
        phone,
        trade,
        rating: rating || null,
        hourly_rate: hourlyRate || null,
        availability,
        certifications,
        address: address || null,
        insurance_expiry: insuranceExpiry || null,
        notes: notes || null,
        avatar: avatar || null,
        is_active: true,
        approved: false,
      })
      .select()
      .single();

    console.log('[Create Subcontractor] Insert completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Create Subcontractor] Error:', error);
      return res.status(500).json({
        error: `Failed to create subcontractor: ${error.message}`,
      });
    }

    if (!data) {
      return res.status(500).json({
        error: 'No data returned from insert',
      });
    }

    console.log('[Create Subcontractor] Success:', data.id);

    // Return success with camelCase response
    return res.status(200).json({
      success: true,
      subcontractor: {
        id: data.id,
        name: data.name,
        companyName: data.company_name,
        email: data.email,
        phone: data.phone,
        trade: data.trade,
        rating: data.rating || undefined,
        hourlyRate: data.hourly_rate || undefined,
        availability: data.availability,
        certifications: data.certifications || [],
        address: data.address || undefined,
        insuranceExpiry: data.insurance_expiry || undefined,
        notes: data.notes || undefined,
        avatar: data.avatar || undefined,
        createdAt: data.created_at,
        isActive: data.is_active,
        approved: data.approved,
        businessFiles: [],
      },
    });
  } catch (error: any) {
    console.error('[Create Subcontractor] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to create subcontractor',
    });
  }
}
