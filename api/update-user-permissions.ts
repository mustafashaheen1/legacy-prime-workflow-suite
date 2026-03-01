import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 15,
};

/**
 * POST /api/update-user-permissions
 * Body: { userId: string, customPermissions: Record<string, boolean> }
 *
 * Persists per-user feature overrides to the custom_permissions JSONB column.
 * Called by the admin-only EditAccessModal in Settings.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const { userId, customPermissions } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (!customPermissions || typeof customPermissions !== 'object' || Array.isArray(customPermissions)) {
    return res.status(400).json({ error: 'customPermissions must be a key-value object' });
  }

  // Validate that all values are booleans to prevent injection of arbitrary data.
  for (const [key, value] of Object.entries(customPermissions)) {
    if (typeof value !== 'boolean') {
      return res.status(400).json({ error: `customPermissions["${key}"] must be a boolean` });
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('users')
      .update({
        custom_permissions: customPermissions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, custom_permissions')
      .single();

    if (error) {
      console.error('[Update Permissions] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[Update Permissions] Saved custom_permissions for user:', userId);

    return res.status(200).json({
      success: true,
      userId: data.id,
      customPermissions: data.custom_permissions,
    });
  } catch (err: any) {
    console.error('[Update Permissions] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update permissions' });
  }
}
