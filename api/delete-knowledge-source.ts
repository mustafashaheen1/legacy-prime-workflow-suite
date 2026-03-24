import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { companyId, sourceName } = req.body;
  if (!companyId || !sourceName) {
    return res.status(400).json({ error: 'Missing required fields: companyId, sourceName' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('knowledge_chunks')
    .delete()
    .eq('company_id', companyId)
    .eq('source_name', sourceName);

  if (error) return res.status(500).json({ error: error.message });

  console.log(`[DeleteKnowledge] Deleted all chunks for "${sourceName}" (${companyId})`);
  return res.status(200).json({ success: true });
}
