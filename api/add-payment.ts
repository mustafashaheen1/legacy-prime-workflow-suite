import { createClient } from '@supabase/supabase-js';
import { getActorName, notifyCompanyAdmins } from '../backend/lib/notifyAdmins.js';

// Plain Vercel serverless function — no Hono, no tRPC.
// Vercel's Node.js runtime auto-parses JSON bodies so req.body is always available.
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
    projectId,
    companyId,
    amount,
    date,
    clientId,
    clientName,
    method,
    notes,
    receiptUrl,
    recordedBy,
  } = body;

  if (!projectId || !companyId || amount == null || !clientName || !method) {
    return res.status(400).json({ error: 'projectId, companyId, amount, clientName, and method are required' });
  }

  const validMethods = ['cash', 'check', 'credit-card', 'wire-transfer', 'other'];
  if (!validMethods.includes(method)) {
    return res.status(400).json({ error: `method must be one of: ${validMethods.join(', ')}` });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase
    .from('payments')
    .insert({
      project_id: projectId,
      company_id: companyId,
      amount: Number(amount),
      date,
      client_id: clientId ?? null,
      client_name: clientName,
      method,
      notes: notes ?? null,
      receipt_url: receiptUrl ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('[add-payment] Supabase error:', error);
    return res.status(500).json({ error: error.message });
  }

  // Notify admins — fire-and-forget
  if (recordedBy) {
    void (async () => {
      try {
        const name = await getActorName(supabase, recordedBy);
        await notifyCompanyAdmins(supabase, {
          companyId,
          actorId: recordedBy,
          type: 'payment-received',
          title: 'Payment Recorded',
          message: `${name} recorded a $${Number(amount).toLocaleString()} payment from ${clientName}`,
          data: { paymentId: data.id, projectId },
        });
      } catch (e) {
        console.warn('[add-payment] Admin notify failed (non-fatal):', e);
      }
    })();
  }

  return res.status(200).json({
    success: true,
    payment: {
      id: data.id,
      projectId: data.project_id,
      companyId: data.company_id,
      amount: Number(data.amount),
      date: data.date,
      clientId: data.client_id ?? undefined,
      clientName: data.client_name,
      method: data.method,
      notes: data.notes ?? undefined,
      receiptUrl: data.receipt_url ?? undefined,
      createdAt: data.created_at,
    },
  });
}
