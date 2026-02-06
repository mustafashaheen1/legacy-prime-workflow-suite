import { createClient } from '@supabase/supabase-js';

export default async function handler(req: Request) {
  console.log('[Test Direct] ===== FUNCTION STARTED =====');
  console.log('[Test Direct] Method:', req.method);

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('[Test Direct] Parsing request body...');
    const body = await req.json();
    console.log('[Test Direct] Body:', JSON.stringify(body));

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Test Direct] Supabase not configured');
      return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[Test Direct] Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('[Test Direct] Inserting to database...');
    const startTime = Date.now();

    const { data, error } = await supabase
      .from('custom_folders')
      .insert({
        project_id: body.projectId || 'test-direct',
        folder_type: (body.name || 'test').toLowerCase().replace(/\s+/g, '-'),
        name: body.name || 'Test Direct',
        color: body.color || '#6B7280',
        description: body.description || 'Direct test',
      })
      .select()
      .single();

    const duration = Date.now() - startTime;
    console.log('[Test Direct] Insert completed in', duration, 'ms');

    if (error) {
      console.error('[Test Direct] Insert error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        duration_ms: duration,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[Test Direct] ===== SUCCESS =====');
    return new Response(JSON.stringify({
      success: true,
      folder: data,
      duration_ms: duration,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[Test Direct] Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  maxDuration: 10,
};
