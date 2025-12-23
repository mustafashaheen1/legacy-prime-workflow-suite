import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Don't throw at module level - let individual routes handle missing env vars
let supabase: SupabaseClient<Database> | null = null;

if (supabaseUrl && supabaseServiceKey) {
  // Backend uses service role key for admin access
  supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
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
} else {
  console.warn('[Backend Supabase] ⚠️ WARNING: Supabase environment variables not set');
  console.warn('[Backend Supabase]   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'MISSING');
  console.warn('[Backend Supabase]   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'MISSING');
}

export { supabase };
