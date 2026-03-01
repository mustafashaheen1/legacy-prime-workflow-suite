import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { notifyCompanyAdmins } from '../backend/lib/notifyAdmins.js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Database not configured' });
  }

  try {
    const { estimateId, status, paidDate, paymentId } = req.body;

    if (!estimateId || !status) {
      return res.status(400).json({ error: 'estimateId and status are required' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update estimate status
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (paidDate) {
      updateData.paid_date = paidDate;
    }

    if (paymentId) {
      updateData.payment_id = paymentId;
    }

    const { data, error } = await supabase
      .from('estimates')
      .update(updateData)
      .eq('id', estimateId)
      .select()
      .single();

    if (error) {
      console.error('[Update Estimate] Database error:', error);
      throw new Error(error.message);
    }

    console.log('[Update Estimate] Successfully updated estimate:', estimateId, 'to status:', status);

    // Notify admins of meaningful status changes — must complete BEFORE responding
    const notifiableStatuses: Record<string, string> = {
      accepted: 'Estimate Accepted',
      rejected: 'Estimate Rejected',
      paid:     'Estimate Paid',
      sent:     'Estimate Sent',
    };

    if (notifiableStatuses[status] && data.company_id) {
      try {
        const projectRes = await supabase
          .from('projects').select('name').eq('id', data.project_id).single();
        const projectName = projectRes.data?.name ?? 'a project';
        const clientName  = data.client_name ?? 'a client';
        const messages: Record<string, string> = {
          accepted: `Estimate for ${projectName} was accepted by ${clientName}`,
          rejected: `Estimate for ${projectName} was rejected by ${clientName}`,
          paid:     `Estimate for ${projectName} has been marked as paid`,
          sent:     `Estimate for ${projectName} was sent to ${clientName}`,
        };
        await notifyCompanyAdmins(supabase, {
          companyId: data.company_id,
          actorId:   '00000000-0000-0000-0000-000000000000', // no actor to exclude
          type:      'general',
          title:     notifiableStatuses[status],
          message:   messages[status],
          data:      { estimateId, projectId: data.project_id },
        });
      } catch (e) {
        console.warn('[Update Estimate] Admin notify failed (non-fatal):', e);
      }
    }

    return res.status(200).json({
      success: true,
      estimate: data,
    });
  } catch (error: any) {
    console.error('[Update Estimate] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update estimate',
    });
  }
}
