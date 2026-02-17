import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Approve User] Starting request...');

  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Approve User] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Approve User] Approving user:', userId);

    // First, verify the user exists and is pending
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, name, email, is_active, role')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('[Approve User] User not found:', fetchError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is already active
    if (existingUser.is_active) {
      console.log('[Approve User] User already active');
      return res.status(400).json({ error: 'User is already approved' });
    }

    // Security check: Don't allow approving admin users without proper authorization
    if (existingUser.role === 'admin' || existingUser.role === 'super-admin') {
      console.error('[Approve User] Cannot approve admin users via this endpoint');
      return res.status(403).json({ error: 'Cannot approve admin users' });
    }

    // Update user to active
    const { data, error } = await supabase
      .from('users')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    console.log('[Approve User] Database update completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Approve User] Database error:', error);
      return res.status(500).json({ error: `Failed to approve user: ${error.message}` });
    }

    console.log('[Approve User] Success. Total time:', Date.now() - startTime, 'ms');

    // Convert snake_case back to camelCase for response
    const user = {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      companyId: data.company_id,
      isActive: data.is_active,
      avatar: data.avatar || undefined,
      phone: data.phone || undefined,
      address: data.address || undefined,
      hourlyRate: data.hourly_rate || undefined,
      rateChangeRequest: data.rate_change_request || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return res.status(200).json({
      success: true,
      message: 'User approved successfully',
      user,
    });
  } catch (error: any) {
    console.error('[Approve User] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to approve user',
    });
  }
}
