const { createClient } = require('@supabase/supabase-js');

/**
 * Extract and verify user from JWT token in Authorization header
 */
async function extractUserFromRequest(req) {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log('[Auth Helper] No Authorization header found');
      return null;
    }

    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      console.log('[Auth Helper] Empty token');
      return null;
    }

    console.log('[Auth Helper] Verifying JWT token...');

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Auth Helper] Missing Supabase credentials');
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.warn('[Auth Helper] JWT verification failed:', error.message);
      return null;
    }

    if (!data.user) {
      console.warn('[Auth Helper] No user in JWT response');
      return null;
    }

    console.log('[Auth Helper] JWT valid for user:', data.user.email);

    // Fetch user profile from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name, role, company_id, is_active')
      .eq('id', data.user.id)
      .single();

    if (userError) {
      console.error('[Auth Helper] Failed to fetch user profile:', userError.message);
      return null;
    }

    if (!userData) {
      console.warn('[Auth Helper] User not found in database');
      return null;
    }

    // Check if user is active
    if (!userData.is_active) {
      console.warn('[Auth Helper] User account is inactive:', userData.email);
      return null;
    }

    // Successfully extracted user
    const authUser = {
      id: userData.id,
      email: userData.email,
      companyId: userData.company_id,
      role: userData.role,
      name: userData.name,
    };

    console.log('[Auth Helper] ✅ User authenticated:', {
      id: authUser.id,
      email: authUser.email,
      companyId: authUser.companyId,
      role: authUser.role,
    });

    return authUser;
  } catch (error) {
    console.error('[Auth Helper] Unexpected error:', error.message);
    return null;
  }
}

/**
 * Require authenticated user - throws error if not authenticated
 */
async function requireAuth(req) {
  const user = await extractUserFromRequest(req);

  if (!user) {
    const error = new Error('UNAUTHORIZED: You must be logged in to perform this action');
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  return user;
}

/**
 * Require admin user - throws error if not authenticated or not admin
 */
async function requireAdmin(req) {
  const user = await requireAuth(req);

  if (!['admin', 'super-admin'].includes(user.role)) {
    const error = new Error('FORBIDDEN: You do not have permission to perform this action');
    error.code = 'FORBIDDEN';
    throw error;
  }

  return user;
}

module.exports = {
  extractUserFromRequest,
  requireAuth,
  requireAdmin,
};
