import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

/**
 * Get Team Members API
 * Fetches team members based on role-based access control:
 * - Admin: Can see all team members (admins + employees)
 * - Employee: Can see admin + other employees
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, userRole } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId is required' });
    }

    if (!userRole || typeof userRole !== 'string') {
      return res.status(400).json({ error: 'userRole is required' });
    }

    // Initialize Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch team members based on role
    let query = supabase
      .from('team_users')
      .select('id, email, name, role, avatar_url, phone, is_active')
      .eq('is_active', true)
      .neq('id', userId); // Exclude current user

    // Role-based filtering
    if (userRole === 'employee') {
      // Employees can only see admins and other employees
      query = query.in('role', ['admin', 'employee']);
    }
    // Admins can see everyone (no additional filter needed)

    const { data: members, error } = await query.order('name', { ascending: true });

    if (error) {
      console.error('[Get Team Members] Database error:', error);
      throw new Error(error.message);
    }

    console.log('[Get Team Members] Fetched', members?.length || 0, 'team members for', userRole);

    return res.status(200).json({
      success: true,
      members: members || [],
    });
  } catch (error: any) {
    console.error('[Get Team Members] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch team members',
    });
  }
}
