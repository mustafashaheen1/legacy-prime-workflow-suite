import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      subcontractorId,
      projectId,
      startDate,
      notes,
      companyId
    } = req.body;

    if (!subcontractorId || !projectId || !companyId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create assignment record
    const { error } = await supabase
      .from('subcontractor_assignments')
      .insert({
        subcontractor_id: subcontractorId,
        project_id: projectId,
        company_id: companyId,
        start_date: startDate || null,
        notes: notes || '',
        status: 'active',
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[assign-subcontractor] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('[assign-subcontractor] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
