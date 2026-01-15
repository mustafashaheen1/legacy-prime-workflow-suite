import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 15,
};

// Direct API endpoint for adding a client - bypasses tRPC for better performance
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Add Client] Starting request...');

  try {
    const { companyId, name, address, email, phone, source, status, lastContacted, lastContactDate, nextFollowUpDate } = req.body;

    // Validate required fields
    if (!companyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }
    if (!email) {
      return res.status(400).json({ error: 'Missing required field: email' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Missing required field: phone' });
    }
    if (!source) {
      return res.status(400).json({ error: 'Missing required field: source' });
    }

    // Validate source value
    const validSources = ['Google', 'Referral', 'Ad', 'Phone Call'];
    if (!validSources.includes(source)) {
      return res.status(400).json({ error: `Invalid source. Must be one of: ${validSources.join(', ')}` });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Add Client] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Add Client] Adding client:', name, 'for company:', companyId);

    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_id: companyId,
        name: name,
        address: address || null,
        email: email,
        phone: phone,
        source: source,
        status: status || 'Lead',
        last_contacted: lastContacted || null,
        last_contact_date: lastContactDate || new Date().toISOString(),
        next_follow_up_date: nextFollowUpDate || null,
      })
      .select()
      .single();

    console.log('[Add Client] Database insert completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Add Client] Database error:', error);
      return res.status(500).json({ error: `Failed to add client: ${error.message}` });
    }

    console.log('[Add Client] Success. Total time:', Date.now() - startTime, 'ms');

    // Convert snake_case back to camelCase for response
    const client = {
      id: data.id,
      name: data.name,
      address: data.address || undefined,
      email: data.email,
      phone: data.phone,
      source: data.source,
      status: data.status,
      lastContacted: data.last_contacted || undefined,
      lastContactDate: data.last_contact_date || undefined,
      nextFollowUpDate: data.next_follow_up_date || undefined,
      createdAt: data.created_at,
    };

    return res.status(200).json({
      success: true,
      client,
    });
  } catch (error: any) {
    console.error('[Add Client] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to add client',
    });
  }
}
