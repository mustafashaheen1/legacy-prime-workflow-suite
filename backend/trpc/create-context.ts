import { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { supabase } from "../lib/supabase.js";

/**
 * User context extracted from JWT token
 */
export interface AuthUser {
  id: string;
  email: string;
  companyId: string;
  role: string;
  name: string;
}

/**
 * Create tRPC context with automatic user extraction from JWT
 *
 * This fixes the architectural gap where auth was handled per-procedure.
 * Now user is automatically extracted from the Authorization header.
 */
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  // Extract Authorization header
  const authHeader = opts.req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  let user: AuthUser | null = null;

  // Extract user from JWT token if present
  if (token && supabase) {
    try {
      console.log('[tRPC Context] Extracting user from JWT token...');

      // Verify JWT token with Supabase
      const { data, error } = await supabase.auth.getUser(token);

      if (error) {
        console.warn('[tRPC Context] JWT verification failed:', error.message);
        // Don't throw - allow request to proceed for public procedures
      } else if (data.user) {
        console.log('[tRPC Context] JWT valid for user:', data.user.email);

        // Fetch user profile from database
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, email, name, role, company_id, is_active')
          .eq('id', data.user.id)
          .single();

        if (userError) {
          console.error('[tRPC Context] Failed to fetch user profile:', userError.message);
        } else if (userData) {
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
            console.warn('[tRPC Context] User account is inactive:', userRecord.email);
            // Don't set user - will be treated as unauthenticated
          } else {
            // Successfully extracted user
            user = {
              id: userRecord.id,
              email: userRecord.email,
              companyId: userRecord.company_id,
              role: userRecord.role,
              name: userRecord.name,
            };

            console.log('[tRPC Context] ✅ User authenticated:', {
              id: user.id,
              email: user.email,
              companyId: user.companyId,
              role: user.role,
            });
          }
        }
      }
    } catch (error: any) {
      console.error('[tRPC Context] Unexpected auth error:', error.message);
      // Don't throw - allow request to proceed for public procedures
    }
  }

  return {
    req: opts.req,
    user, // Now available in all procedures! 🎉
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;

/**
 * Public procedure - no authentication required
 * Use for: health checks, public data, etc.
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authenticated user
 * Use for: all mutations (create, update, delete) and sensitive queries
 *
 * Benefits:
 * - Automatic auth enforcement
 * - Type-safe ctx.user (TypeScript knows it's not null)
 * - Centralized auth logic
 * - Automatic user tracking for audit trails
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // TypeScript now knows user is not null
    },
  });
});

/**
 * Admin-only procedure - requires admin or super-admin role
 * Use for: user management, company settings, etc.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!['admin', 'super-admin'].includes(ctx.user.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action',
    });
  }

  return next({
    ctx,
  });
});
