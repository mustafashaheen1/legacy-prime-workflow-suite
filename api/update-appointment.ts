import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { id, title, type, date, time, endTime, clientId, projectId, address, phone, email, notes } = req.body;

    if (!id) return res.status(400).json({ error: 'id is required' });
    if (title !== undefined && !title?.trim()) return res.status(400).json({ error: 'title cannot be empty' });

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Database not configured' });

    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: Record<string, unknown> = {};
    if (title !== undefined) payload.title = title.trim();
    if (type !== undefined) payload.type = type || null;
    if (date !== undefined) payload.date = date;
    if (time !== undefined) payload.time = time || null;
    if (endTime !== undefined) payload.end_time = endTime || null;
    if (clientId !== undefined) payload.client_id = clientId || null;
    if (projectId !== undefined) payload.project_id = projectId || null;
    if (address !== undefined) payload.address = address || null;
    if (phone !== undefined) payload.phone = phone || null;
    if (email !== undefined) payload.email = email || null;
    if (notes !== undefined) payload.notes = notes || null;

    const { error } = await supabase.from('appointments').update(payload).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update appointment' });
  }
}
