import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { companyId } = req.query;
  if (!companyId || typeof companyId !== 'string') {
    return res.status(400).json({ error: 'Missing companyId' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('knowledge_chunks')
    .select('source_name, source_type, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  // Group by source_name — one entry per source with chunk count
  const sourceMap: Record<string, { name: string; type: string; chunkCount: number; createdAt: string }> = {};
  for (const row of data || []) {
    if (!sourceMap[row.source_name]) {
      sourceMap[row.source_name] = {
        name: row.source_name,
        type: row.source_type,
        chunkCount: 0,
        createdAt: row.created_at,
      };
    }
    sourceMap[row.source_name].chunkCount++;
  }

  return res.status(200).json({ success: true, sources: Object.values(sourceMap) });
}
