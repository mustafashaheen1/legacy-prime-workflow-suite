import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Get Users] Starting request...');

  try {
    const { companyId } = req.query;

    if (!companyId || typeof companyId !== 'string') {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Get Users] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Get Users] Fetching users for company:', companyId);

    // Query users for the company
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: true });

    console.log('[Get Users] Query completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Get Users] Database error:', error);
      return res.status(500).json({ error: `Failed to fetch users: ${error.message}` });
    }

    console.log('[Get Users] Found', data?.length || 0, 'users');
    console.log('[Get Users] Success. Total time:', Date.now() - startTime, 'ms');

    // Convert snake_case to camelCase for response
    const users = (data || []).map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      companyId: row.company_id,
      isActive: row.is_active,
      avatar: row.avatar || undefined,
      phone: row.phone || undefined,
      address: row.address || undefined,
      hourlyRate: row.hourly_rate || undefined,
      rateChangeRequest: row.rate_change_request || undefined,
      customPermissions: row.custom_permissions || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error: any) {
    console.error('[Get Users] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to fetch users',
    });
  }
}
