import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase.js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[Backend Supabase] ⚠️ CRITICAL: Missing environment variables!');
  console.error('[Backend Supabase]   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'MISSING');
  console.error('[Backend Supabase]   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'MISSING');
  console.error('[Backend Supabase] ⚠️ Please set these in Vercel environment variables');
  throw new Error('Supabase environment variables not configured. Please set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel.');
}

// Backend uses service role key for admin access
export const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-application': 'rork-backend',
    },
  },
});

console.log('[Backend Supabase] ✓ Client initialized successfully');
