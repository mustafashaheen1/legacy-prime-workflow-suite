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
 * Lightweight context — just passes the raw token through.
 * Auth verification (2 DB calls) only happens in protectedProcedure,
 * so publicProcedure routes pay zero auth overhead.
 */
export const createContext = async (opts: FetchCreateContextFnOptions) => {
  const authHeader = opts.req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;

  return {
    req: opts.req,
    token,
    user: null as AuthUser | null,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;

/**
 * Public procedure — no authentication required.
 * createContext adds zero DB overhead for these routes.
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure — verifies JWT and fetches user profile.
 * Two DB calls happen here, only when auth is actually needed.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const { token } = ctx;

  if (!token || !supabase) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action',
    });
  }

  let user: AuthUser | null = null;

  try {
    console.log('[tRPC Auth] Verifying JWT token...');

    const { data, error } = await supabase.auth.getUser(token);

    if (error) {
      console.warn('[tRPC Auth] JWT verification failed:', error.message);
      throw new TRPCError({ code: 'UNAUTHORIZED', message: error.message });
    }

    if (data.user) {
      console.log('[tRPC Auth] JWT valid for user:', data.user.email);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name, role, company_id, is_active')
        .eq('id', data.user.id)
        .single();

      if (userError) {
        console.error('[tRPC Auth] Failed to fetch user profile:', userError.message);
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User profile not found' });
      }

      if (userData) {
        const userRecord = userData as {
          id: string;
          email: string;
          name: string;
          role: string;
          company_id: string;
          is_active: boolean;
        };

        if (!userRecord.is_active) {
          console.warn('[tRPC Auth] User account is inactive:', userRecord.email);
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Account is inactive' });
        }

        user = {
          id: userRecord.id,
          email: userRecord.email,
          companyId: userRecord.company_id,
          role: userRecord.role,
          name: userRecord.name,
        };

        console.log('[tRPC Auth] ✅ User authenticated:', {
          id: user.id,
          email: user.email,
          role: user.role,
        });
      }
    }
  } catch (error: any) {
    if (error instanceof TRPCError) throw error;
    console.error('[tRPC Auth] Unexpected auth error:', error.message);
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
  }

  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'You must be logged in to perform this action' });
  }

  return next({
    ctx: {
      ...ctx,
      user,
    },
  });
});

/**
 * Admin-only procedure — requires admin or super-admin role.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!['admin', 'super-admin'].includes(ctx.user!.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to perform this action',
    });
  }

  return next({ ctx });
});
