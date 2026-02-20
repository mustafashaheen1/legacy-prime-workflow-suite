import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { projectId, companyId, password, expiresAt } = req.body;

    if (!projectId || !companyId) {
      return res.status(400).json({ error: 'Missing required fields: projectId and companyId' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = `sch_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;

    const { data, error } = await supabase
      .from('schedule_share_links')
      .upsert(
        {
          project_id: projectId,
          company_id: companyId,
          token,
          enabled: true,
          password: password ?? null,
          expires_at: expiresAt ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'project_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[generate-schedule-share-link] DB error:', error);
      return res.status(500).json({ error: error.message });
    }

    const link = {
      id: data.id,
      projectId: data.project_id,
      companyId: data.company_id,
      token: data.token,
      enabled: data.enabled,
      password: data.password ?? undefined,
      expiresAt: data.expires_at ?? undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return res.status(200).json({ success: true, link });
  } catch (error: any) {
    console.error('[generate-schedule-share-link] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
