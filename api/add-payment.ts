import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './lib/auth-helper.js';
import { getActorName, notifyCompanyAdmins } from '../backend/lib/notifyAdmins.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let authUser;
    try {
      authUser = await requireAuth(req);
      console.log('[add-payment] ✅ Authenticated user:', authUser.email);
    } catch (authError: any) {
      console.error('[add-payment] Authentication failed:', authError.message);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to record payments',
      });
    }

    const body = req.body ?? {};
    const {
      projectId,
      amount,
      date,
      clientId,
      clientName,
      method,
      notes,
      receiptUrl,
    } = body;

    // 🎯 SECURITY: Use company ID from authenticated user, not from request body
    const companyId = authUser.companyId;

    if (!projectId || amount == null || !clientName || !method) {
      return res.status(400).json({ error: 'projectId, amount, clientName, and method are required' });
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

    // Notify admins — must complete BEFORE responding (Vercel freezes after res.json)
    try {
      const name = await getActorName(supabase, authUser.id);
      await notifyCompanyAdmins(supabase, {
        companyId,
        actorId: authUser.id,
        type: 'payment-received',
        title: 'Payment Recorded',
        message: `${name} recorded a $${Number(amount).toLocaleString()} payment from ${clientName}`,
        data: { paymentId: data.id, projectId },
      });
    } catch (e) {
      console.warn('[add-payment] Admin notify failed (non-fatal):', e);
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
  } catch (error: any) {
    console.error('[add-payment] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
