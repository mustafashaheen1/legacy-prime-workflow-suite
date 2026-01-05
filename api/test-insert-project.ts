import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  console.log('[Test Insert] ==================== START ====================');
  console.log('[Test Insert] Request method:', req.method);
  console.log('[Test Insert] Request body:', JSON.stringify(req.body, null, 2));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[Test Insert] Step 1: Checking environment variables...');
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Test Insert] Supabase not configured');
      return res.status(500).json({
        error: 'Database not configured',
        supabaseUrl: supabaseUrl ? 'set' : 'missing',
        supabaseKey: supabaseKey ? 'set' : 'missing',
      });
    }
    console.log('[Test Insert] Environment variables OK');

    console.log('[Test Insert] Step 2: Creating Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('[Test Insert] Supabase client created');

    console.log('[Test Insert] Step 3: Preparing test data...');
    const testData = {
      company_id: req.body.companyId || '3fd6f909-5c10-45eb-98af-83eb26879eec',
      name: req.body.name || 'Test Project ' + new Date().toISOString(),
      budget: req.body.budget || 10000,
      expenses: 0,
      progress: 0,
      status: 'active',
      image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400',
      hours_worked: 0,
      start_date: new Date().toISOString(),
    };
    console.log('[Test Insert] Test data:', JSON.stringify(testData, null, 2));

    console.log('[Test Insert] Step 4: Executing insert with 30s timeout...');
    const insertStart = Date.now();

    const result = await Promise.race([
      supabase
        .from('projects')
        .insert(testData)
        .select()
        .single(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Insert timeout after 30 seconds')), 30000)
      ),
    ]);

    const insertDuration = Date.now() - insertStart;
    console.log('[Test Insert] Insert completed in', insertDuration, 'ms');

    const { data, error } = result as any;

    if (error) {
      console.error('[Test Insert] Insert error:', error);
      return res.status(500).json({
        error: 'Insert failed',
        message: error.message,
        details: error,
        duration_ms: insertDuration,
      });
    }

    console.log('[Test Insert] Success! Project ID:', data.id);
    console.log('[Test Insert] ==================== END ====================');

    return res.status(200).json({
      success: true,
      message: 'Project inserted successfully',
      project: data,
      duration_ms: insertDuration,
    });
  } catch (error: any) {
    console.error('[Test Insert] ==================== ERROR ====================');
    console.error('[Test Insert] Error:', error);
    console.error('[Test Insert] Error message:', error.message);
    console.error('[Test Insert] Error stack:', error.stack);
    return res.status(500).json({
      error: 'Unexpected error',
      message: error.message,
      stack: error.stack?.substring(0, 500),
    });
  }
}

export const config = {
  maxDuration: 60,
};
