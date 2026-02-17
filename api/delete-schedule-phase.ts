import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow DELETE
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Delete schedule phase request received');

  try {
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Phase ID is required' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete from database (cascade will delete child phases and tasks)
    const { error } = await supabase
      .from('schedule_phases')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API] Database error:', error);
      return res.status(500).json({
        error: 'Failed to delete schedule phase',
        details: error.message
      });
    }

    console.log('[API] Schedule phase deleted successfully:', id);

    return res.status(200).json({
      success: true,
    });
  } catch (error: any) {
    console.error('[API] Error deleting schedule phase:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
