import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 10, // 10 second timeout
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[DirectAPI] Starting price list item insert');
  const startTime = Date.now();

  // Set CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, category, name, unit, unitPrice } = req.body;

    if (!companyId || !category || !name || !unit || unitPrice === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const itemId = `custom-${Date.now()}`;
    const now = new Date().toISOString();

    console.log('[DirectAPI] Using direct REST API to Supabase...');
    const restStartTime = Date.now();

    // Use Supabase REST API directly (bypassing JS client)
    const response = await fetch(`${supabaseUrl}/rest/v1/price_list_items`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal', // Don't return the inserted row
      },
      body: JSON.stringify({
        id: itemId,
        company_id: companyId,
        category,
        name,
        unit,
        unit_price: unitPrice,
        is_custom: true,
        created_at: now,
      }),
      signal: AbortSignal.timeout(5000), // 5 second hard timeout
    });

    console.log('[DirectAPI] REST API response received in', Date.now() - restStartTime, 'ms');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DirectAPI] REST API error:', response.status, errorText);
      return res.status(500).json({ error: `Database error: ${response.status}` });
    }

    const totalTime = Date.now() - startTime;
    console.log('[DirectAPI] Success! Total time:', totalTime, 'ms');

    return res.status(200).json({
      success: true,
      item: { id: itemId, category, name, unit, unitPrice, createdAt: now },
      timing: totalTime,
    });

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error('[DirectAPI] Error after', totalTime, 'ms:', error.message);

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return res.status(504).json({ error: 'Database timeout - connection too slow' });
    }

    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
