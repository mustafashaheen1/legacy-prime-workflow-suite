import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../../types/supabase.js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: SupabaseClient<Database> | null = null;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('[Backend Supabase] ⚠️ Missing environment variables - Supabase features will be disabled');
  console.error('[Backend Supabase]   EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.error('[Backend Supabase]   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');
  console.error('[Backend Supabase] ⚠️ Set these variables in Vercel project settings');
} else {
  // Backend uses service role key for admin access
  supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  console.log('[Backend Supabase] ✓ Client initialized with service role key');
}

export { supabase };
