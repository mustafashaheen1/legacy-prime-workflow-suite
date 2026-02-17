import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Update User] Starting request...');

  try {
    const { userId, updates } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid updates object' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Update User] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Update User] Updating user:', userId);

    // Convert camelCase to snake_case for database
    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar || null;
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone || null;
    if (updates.address !== undefined) dbUpdates.address = updates.address || null;
    if (updates.hourlyRate !== undefined) dbUpdates.hourly_rate = updates.hourlyRate;
    if (updates.rateChangeRequest !== undefined) dbUpdates.rate_change_request = updates.rateChangeRequest;

    const { data, error } = await supabase
      .from('users')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

    console.log('[Update User] Database update completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Update User] Database error:', error);
      return res.status(500).json({ error: `Failed to update user: ${error.message}` });
    }

    console.log('[Update User] Success. Total time:', Date.now() - startTime, 'ms');

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
      user,
    });
  } catch (error: any) {
    console.error('[Update User] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update user',
    });
  }
}
