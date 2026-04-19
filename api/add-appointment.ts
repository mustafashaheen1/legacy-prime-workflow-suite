import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { companyId, createdBy, clientId, projectId, title, type, date, time, endTime, address, phone, email, notes } = req.body;

    if (!companyId) return res.status(400).json({ error: 'companyId is required' });
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
    if (!date) return res.status(400).json({ error: 'date is required' });

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Database not configured' });

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        company_id: companyId,
        created_by: createdBy || null,
        client_id: clientId || null,
        project_id: projectId || null,
        title: title.trim(),
        type: type || null,
        date,
        time: time || null,
        end_time: endTime || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({
      success: true,
      appointment: {
        id: data.id,
        companyId: data.company_id,
        createdBy: data.created_by,
        clientId: data.client_id,
        projectId: data.project_id,
        title: data.title,
        type: data.type,
        date: data.date,
        time: data.time,
        endTime: data.end_time,
        address: data.address,
        phone: data.phone,
        email: data.email,
        notes: data.notes,
        createdAt: data.created_at,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to add appointment' });
  }
}
