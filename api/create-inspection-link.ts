import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[CreateInspectionLink] ===== API ROUTE STARTED =====');
  console.log('[CreateInspectionLink] Method:', req.method);
  console.log('[CreateInspectionLink] Headers:', req.headers);

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('[CreateInspectionLink] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, clientId, companyId, projectId, clientName, clientEmail, notes } = req.body;

    console.log('[CreateInspectionLink] Creating inspection link for:', clientName);
    console.log('[CreateInspectionLink] Token:', token);

    // Validate required fields
    if (!token || !clientId || !companyId || !clientName) {
      console.log('[CreateInspectionLink] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[CreateInspectionLink] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('[CreateInspectionLink] Initializing Supabase client...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    console.log('[CreateInspectionLink] Inserting into database...');
    const insertStart = Date.now();

    const { data, error } = await supabase
      .from('inspection_videos')
      .insert({
        token,
        client_id: clientId,
        company_id: companyId,
        project_id: projectId || null,
        client_name: clientName,
        client_email: clientEmail || null,
        status: 'pending',
        notes: notes || null,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    const insertDuration = Date.now() - insertStart;
    console.log(`[CreateInspectionLink] Database INSERT completed in ${insertDuration}ms`);

    if (error) {
      console.error('[CreateInspectionLink] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://legacy-prime-workflow-suite.vercel.app';
    const inspectionUrl = `${baseUrl}/inspection-video/${token}`;

    console.log('[CreateInspectionLink] ===== API ROUTE COMPLETED =====');
    console.log('[CreateInspectionLink] Inspection URL:', inspectionUrl);

    return res.status(200).json({
      success: true,
      token,
      inspectionUrl,
      expiresAt: expiresAt.toISOString(),
      insertDuration,
    });
  } catch (error: any) {
    console.error('[CreateInspectionLink] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
      stack: error.stack?.substring(0, 500),
    });
  }
}
