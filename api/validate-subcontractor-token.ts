import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Validate subcontractor token request received');

  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Look up token in database
    const { data: subcontractor, error } = await supabase
      .from('subcontractors')
      .select('id, name, email, phone, trade, registration_token_expiry, registration_completed')
      .eq('registration_token', token)
      .single();

    if (error || !subcontractor) {
      console.log('[API] Token not found:', token);
      return res.status(200).json({
        valid: false,
        expired: false,
        alreadyCompleted: false,
      });
    }

    // Check if registration is already completed
    if (subcontractor.registration_completed) {
      console.log('[API] Registration already completed for token:', token);
      return res.status(200).json({
        valid: false,
        expired: false,
        alreadyCompleted: true,
      });
    }

    // Check if token has expired
    const expiryDate = new Date(subcontractor.registration_token_expiry);
    const now = new Date();

    if (now > expiryDate) {
      console.log('[API] Token expired:', token);
      return res.status(200).json({
        valid: false,
        expired: true,
        alreadyCompleted: false,
      });
    }

    console.log('[API] Token is valid:', token);

    // Return valid token with subcontractor draft data
    return res.status(200).json({
      valid: true,
      expired: false,
      alreadyCompleted: false,
      subcontractor: {
        id: subcontractor.id,
        name: subcontractor.name || '',
        email: subcontractor.email,
        phone: subcontractor.phone || '',
        trade: subcontractor.trade || '',
      },
    });
  } catch (error: any) {
    console.error('[API] Error validating subcontractor token:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
