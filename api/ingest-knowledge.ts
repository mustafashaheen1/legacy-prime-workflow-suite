import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

export const config = {
  maxDuration: 30,
  api: { bodyParser: { sizeLimit: '2mb' } },
};

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length > 50) chunks.push(chunk);
    if (end === normalized.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { companyId, sourceName, sourceType = 'manual', text, createdBy } = req.body;

  if (!companyId || !sourceName || !text) {
    return res.status(400).json({ error: 'Missing required fields: companyId, sourceName, text' });
  }
  if (typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ error: 'Text must be a non-empty string' });
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !openaiKey) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      return res.status(400).json({ error: 'No valid content found after chunking' });
    }

    console.log(`[IngestKnowledge] Embedding ${chunks.length} chunks for "${sourceName}" (${companyId})`);

    // Embed all chunks in a single batched request (OpenAI supports up to 2048 inputs)
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunks,
    });

    const rows = chunks.map((chunk, i) => ({
      company_id: companyId,
      source_name: sourceName,
      source_type: sourceType,
      chunk_text: chunk,
      embedding: embeddingRes.data[i].embedding,
      created_by: createdBy || null,
    }));

    // Delete existing chunks for this source before re-ingesting (idempotent upsert)
    await supabase
      .from('knowledge_chunks')
      .delete()
      .eq('company_id', companyId)
      .eq('source_name', sourceName);

    const { error } = await supabase.from('knowledge_chunks').insert(rows);
    if (error) throw error;

    console.log(`[IngestKnowledge] Stored ${rows.length} chunks for "${sourceName}"`);
    return res.status(200).json({ success: true, sourceName, chunks: rows.length });
  } catch (err: any) {
    console.error('[IngestKnowledge] Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to ingest knowledge' });
  }
}
