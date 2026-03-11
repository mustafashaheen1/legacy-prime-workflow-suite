import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 15,
};

/**
 * Persists lunch_breaks changes to the DB immediately when an employee
 * starts or ends a lunch break — without waiting for clock-out.
 * Body: { entryId: string, lunchBreaks: Array<{ startTime: string, endTime?: string }> }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { entryId, lunchBreaks } = req.body;

    if (!entryId || !Array.isArray(lunchBreaks)) {
      return res.status(400).json({ error: 'Missing required fields: entryId, lunchBreaks' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('clock_entries')
      .update({ lunch_breaks: lunchBreaks })
      .eq('id', entryId)
      .select('id, lunch_breaks')
      .single();

    if (error) {
      console.error('[UpdateLunchBreak] DB error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[UpdateLunchBreak] Saved lunch_breaks for entry:', entryId, JSON.stringify(lunchBreaks));

    return res.status(200).json({ success: true, lunchBreaks: data?.lunch_breaks });
  } catch (error: any) {
    console.error('[UpdateLunchBreak] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Unknown error' });
  }
}
