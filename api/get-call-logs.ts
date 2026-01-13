import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// API endpoint to fetch call logs from the database
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, limit = '50' } = req.query;

    if (!companyId || typeof companyId !== 'string') {
      return res.status(400).json({ error: 'Missing required parameter: companyId' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[GetCallLogs] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const queryLimit = Math.min(parseInt(limit as string, 10) || 50, 100);

    console.log('[GetCallLogs] Fetching call logs for company:', companyId, 'limit:', queryLimit);

    const { data, error } = await supabase
      .from('call_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('call_date', { ascending: false })
      .limit(queryLimit);

    if (error) {
      console.error('[GetCallLogs] Database error:', error);
      return res.status(500).json({ error: `Failed to fetch call logs: ${error.message}` });
    }

    console.log('[GetCallLogs] Found', data?.length || 0, 'call logs');

    // Convert snake_case to camelCase for frontend
    const callLogs = (data || []).map((log: any) => ({
      id: log.id,
      clientId: log.client_id,
      callerName: log.caller_name || 'Unknown Caller',
      callerPhone: log.caller_phone || '',
      callerEmail: log.caller_email || undefined,
      callDate: log.call_date || log.created_at,
      callDuration: log.call_duration || log.duration || '0:00',
      callType: log.call_type || 'incoming',
      status: log.status || 'answered',
      isQualified: log.is_qualified || false,
      qualificationScore: log.qualification_score || undefined,
      notes: log.notes || '',
      transcript: log.transcript || undefined,
      projectType: log.project_type || undefined,
      budget: log.budget || undefined,
      startDate: log.start_date || undefined,
      propertyType: log.property_type || undefined,
      addedToCRM: log.added_to_crm || false,
      scheduledFollowUp: log.scheduled_follow_up || log.follow_up_date || undefined,
    }));

    return res.status(200).json({
      success: true,
      callLogs,
    });
  } catch (error: any) {
    console.error('[GetCallLogs] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch call logs' });
  }
}
