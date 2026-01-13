import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Direct API endpoint for updating company profile - bypasses tRPC for better performance
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Update Company] Starting request...');

  try {
    const { companyId, updates } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Update Company] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Convert camelCase to snake_case for database
    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.logo !== undefined) dbUpdates.logo = updates.logo || null;
    if (updates.brandColor !== undefined) dbUpdates.brand_color = updates.brandColor;
    if (updates.licenseNumber !== undefined) dbUpdates.license_number = updates.licenseNumber || null;
    if (updates.officePhone !== undefined) dbUpdates.office_phone = updates.officePhone || null;
    if (updates.cellPhone !== undefined) dbUpdates.cell_phone = updates.cellPhone || null;
    if (updates.address !== undefined) dbUpdates.address = updates.address || null;
    if (updates.email !== undefined) dbUpdates.email = updates.email || null;
    if (updates.website !== undefined) dbUpdates.website = updates.website || null;
    if (updates.slogan !== undefined) dbUpdates.slogan = updates.slogan || null;
    if (updates.estimateTemplate !== undefined) dbUpdates.estimate_template = updates.estimateTemplate || null;

    console.log('[Update Company] Updating company:', companyId);

    const { data, error } = await supabase
      .from('companies')
      .update(dbUpdates)
      .eq('id', companyId)
      .select()
      .single();

    console.log('[Update Company] Database update completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Update Company] Database error:', error);
      return res.status(500).json({ error: `Failed to update company: ${error.message}` });
    }

    console.log('[Update Company] Success. Total time:', Date.now() - startTime, 'ms');

    // Convert snake_case back to camelCase for response
    const company = {
      id: data.id,
      name: data.name,
      logo: data.logo || undefined,
      brandColor: data.brand_color,
      licenseNumber: data.license_number || undefined,
      officePhone: data.office_phone || undefined,
      cellPhone: data.cell_phone || undefined,
      address: data.address || undefined,
      email: data.email || undefined,
      website: data.website || undefined,
      slogan: data.slogan || undefined,
      estimateTemplate: data.estimate_template || undefined,
      subscriptionStatus: data.subscription_status,
      subscriptionPlan: data.subscription_plan,
      subscriptionStartDate: data.subscription_start_date,
      subscriptionEndDate: data.subscription_end_date || undefined,
      employeeCount: data.employee_count || undefined,
      companyCode: data.company_code || undefined,
      stripeCustomerId: data.stripe_customer_id || undefined,
      stripeSubscriptionId: data.stripe_subscription_id || undefined,
      settings: data.settings,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return res.status(200).json({
      success: true,
      company,
    });
  } catch (error: any) {
    console.error('[Update Company] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update company',
    });
  }
}
