import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Authenticated user extracted from JWT
 */
export interface AuthUser {
  id: string;
  email: string;
  companyId: string;
  role: string;
  name: string;
}

/**
 * Extract and verify user from JWT token in Authorization header
 *
 * This is used by standalone API endpoints (not tRPC) to get user context.
 * Matches the same logic as backend/trpc/create-context.ts
 *
 * @param req - Vercel request object
 * @returns AuthUser if authenticated, null otherwise
 */
export async function extractUserFromRequest(req: VercelRequest): Promise<AuthUser | null> {
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

    // Type assertion for Supabase response
    const userRecord = userData as {
      id: string;
      email: string;
      name: string;
      role: string;
      company_id: string;
      is_active: boolean;
    };

    // Check if user is active
    if (!userRecord.is_active) {
      console.warn('[Auth Helper] User account is inactive:', userRecord.email);
      return null;
    }

    // Successfully extracted user
    const authUser: AuthUser = {
      id: userRecord.id,
      email: userRecord.email,
      companyId: userRecord.company_id,
      role: userRecord.role,
      name: userRecord.name,
    };

    console.log('[Auth Helper] ✅ User authenticated:', {
      id: authUser.id,
      email: authUser.email,
      companyId: authUser.companyId,
      role: authUser.role,
    });

    return authUser;
  } catch (error: any) {
    console.error('[Auth Helper] Unexpected error:', error.message);
    return null;
  }
}

/**
 * Require authenticated user - throws 401 if not authenticated
 *
 * @param req - Vercel request object
 * @returns AuthUser (guaranteed not null)
 * @throws Error if not authenticated
 */
export async function requireAuth(req: VercelRequest): Promise<AuthUser> {
  const user = await extractUserFromRequest(req);

  if (!user) {
    throw new Error('UNAUTHORIZED: You must be logged in to perform this action');
  }

  return user;
}

/**
 * Require admin user - throws 401/403 if not admin
 *
 * @param req - Vercel request object
 * @returns AuthUser (guaranteed admin)
 * @throws Error if not authenticated or not admin
 */
export async function requireAdmin(req: VercelRequest): Promise<AuthUser> {
  const user = await requireAuth(req);

  if (!['admin', 'super-admin'].includes(user.role)) {
    throw new Error('FORBIDDEN: You do not have permission to perform this action');
  }

  return user;
}
