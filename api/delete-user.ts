import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow DELETE or POST (for compatibility)
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Delete User] Starting request...');

  try {
    // Support both query param (DELETE) and body (POST)
    const userId = req.method === 'DELETE'
      ? req.query.userId as string
      : req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: 'Missing required field: userId' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Delete User] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Delete User] Deleting user:', userId);

    // First, verify the user exists and check permissions
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('[Delete User] User not found:', fetchError);
      return res.status(404).json({ error: 'User not found' });
    }

    // Security check: Don't allow deleting admin/super-admin users
    if (existingUser.role === 'admin' || existingUser.role === 'super-admin') {
      console.error('[Delete User] Cannot delete admin users via this endpoint');
      return res.status(403).json({
        error: 'Cannot delete admin users',
        message: 'Admin and super-admin users must be managed through the admin panel'
      });
    }

    // Delete the user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    console.log('[Delete User] Database delete completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Delete User] Database error:', error);
      return res.status(500).json({ error: `Failed to delete user: ${error.message}` });
    }

    console.log('[Delete User] Success. Total time:', Date.now() - startTime, 'ms');

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      deletedUserId: userId,
    });
  } catch (error: any) {
    console.error('[Delete User] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to delete user',
    });
  }
}
