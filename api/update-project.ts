import { createClient } from '@supabase/supabase-js';

// Plain Vercel serverless function — no Hono, no tRPC.
// Vercel's Node.js runtime auto-parses JSON bodies so POST bodies are always available.
// This bypasses the known @hono/node-server/vercel POST body parsing bug that causes
// tRPC mutations routed through /api/index.ts to time out.
export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const body = req.body ?? {};
  const {
    id,
    name,
    budget,
    contractAmount,
    expenses,
    progress,
    status,
    image,
    hoursWorked,
    startDate,
    endDate,
  } = body;

  if (!id) {
    return res.status(400).json({ error: 'Project id is required' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined)           updateData.name           = name;
  if (budget !== undefined)         updateData.budget         = Number(budget);
  if (contractAmount !== undefined) updateData.contract_amount = Number(contractAmount);
  if (expenses !== undefined)       updateData.expenses       = Number(expenses);
  if (progress !== undefined)       updateData.progress       = Number(progress);
  if (status !== undefined)         updateData.status         = status;
  if (image !== undefined)          updateData.image          = image;
  if (hoursWorked !== undefined)    updateData.hours_worked   = Number(hoursWorked);
  if (startDate !== undefined)      updateData.start_date     = startDate;
  if (endDate !== undefined)        updateData.end_date       = endDate;

  const { data, error } = await supabase
    .from('projects')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[update-project] Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    success: true,
    project: {
      id: data.id,
      name: data.name,
      budget: Number(data.budget) || 0,
      contractAmount: data.contract_amount != null ? Number(data.contract_amount) : undefined,
      expenses: Number(data.expenses) || 0,
      progress: data.progress || 0,
      status: data.status,
      image: data.image || '',
      hoursWorked: Number(data.hours_worked) || 0,
      startDate: data.start_date,
      endDate: data.end_date || undefined,
    },
  });
}
