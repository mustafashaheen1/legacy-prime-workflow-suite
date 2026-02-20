import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { token, projectId, companyId } = req.query;

    if (!token && !projectId && !companyId) {
      return res.status(400).json({ error: 'Provide token, projectId, or companyId' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const toLink = (row: any) => ({
      id: row.id,
      projectId: row.project_id,
      companyId: row.company_id,
      token: row.token,
      enabled: row.enabled,
      password: row.password ?? undefined,
      expiresAt: row.expires_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });

    // Return all links for a company (for AppContext bulk load)
    if (companyId && typeof companyId === 'string') {
      const { data, error } = await supabase
        .from('schedule_share_links')
        .select('*')
        .eq('company_id', companyId);

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, links: (data ?? []).map(toLink) });
    }

    // Lookup by token
    if (token && typeof token === 'string') {
      const { data, error } = await supabase
        .from('schedule_share_links')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) return res.status(404).json({ error: 'Link not found' });
      return res.status(200).json({ success: true, link: toLink(data) });
    }

    // Lookup by projectId
    if (projectId && typeof projectId === 'string') {
      const { data, error } = await supabase
        .from('schedule_share_links')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error || !data) return res.status(404).json({ error: 'Link not found' });
      return res.status(200).json({ success: true, link: toLink(data) });
    }

    return res.status(400).json({ error: 'Invalid query parameters' });
  } catch (error: any) {
    console.error('[get-schedule-share-link] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
