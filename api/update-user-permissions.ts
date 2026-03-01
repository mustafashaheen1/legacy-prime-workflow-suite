import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './lib/auth-helper.js';

export const config = {
  maxDuration: 15,
};

/**
 * POST /api/update-user-permissions
 * Headers: Authorization: Bearer <supabase-session-token>
 * Body: { userId: string, customPermissions: Record<string, boolean> }
 *
 * Persists per-user feature overrides to the custom_permissions JSONB column.
 *
 * Enforcements:
 *  1. Caller must be authenticated as admin or super-admin (JWT verified).
 *  2. Target user must belong to the same company as the caller.
 *  3. Cannot modify permissions of another admin or super-admin.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  // ── 1. Verify the caller is an admin or super-admin ─────────────────────
  let requestor;
  try {
    requestor = await requireAdmin(req);
  } catch (err: any) {
    const isForbidden = err.message?.startsWith('FORBIDDEN');
    return res.status(isForbidden ? 403 : 401).json({ error: err.message });
  }

  // ── 2. Validate request body ─────────────────────────────────────────────
  const { userId, customPermissions } = req.body;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (!customPermissions || typeof customPermissions !== 'object' || Array.isArray(customPermissions)) {
    return res.status(400).json({ error: 'customPermissions must be a key-value object' });
  }
  for (const [key, value] of Object.entries(customPermissions)) {
    if (typeof value !== 'boolean') {
      return res.status(400).json({ error: `customPermissions["${key}"] must be a boolean` });
    }
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 3. Look up the target user ───────────────────────────────────────────
    const { data: targetUser, error: lookupError } = await supabase
      .from('users')
      .select('id, role, company_id')
      .eq('id', userId)
      .single();

    if (lookupError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // ── 4. Same-company check (prevents cross-company privilege escalation) ──
    if (targetUser.company_id !== requestor.companyId) {
      console.warn('[Update Permissions] Cross-company attempt blocked:', {
        requestorId: requestor.id,
        requestorCompany: requestor.companyId,
        targetId: userId,
        targetCompany: targetUser.company_id,
      });
      return res.status(403).json({ error: 'You can only manage users within your own company' });
    }

    // ── 5. Prevent modifying other admins' permissions ───────────────────────
    if (targetUser.role === 'admin' || targetUser.role === 'super-admin') {
      return res.status(403).json({ error: 'Cannot modify permissions for admin users' });
    }

    // ── 6. Persist ───────────────────────────────────────────────────────────
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

    console.log(
      '[Update Permissions] Admin', requestor.email,
      'updated permissions for user:', userId,
      'overrides:', customPermissions
    );

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
