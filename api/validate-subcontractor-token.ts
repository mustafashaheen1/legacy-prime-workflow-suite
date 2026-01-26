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

    console.log('[API] Looking up token in registration_tokens table:', token);

    // Look up token in registration_tokens table
    const { data: tokenData, error: tokenError } = await supabase
      .from('registration_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError) {
      console.error('[API] Database error:', tokenError);

      // Check if it's a "table doesn't exist" error
      if (tokenError.message && (tokenError.message.includes('does not exist') || tokenError.message.includes('relation'))) {
        return res.status(500).json({
          error: 'Database not configured. Please run migrations. See MIGRATION_INSTRUCTIONS.md',
          details: tokenError.message
        });
      }

      console.log('[API] Token not found or other error:', token);
      return res.status(200).json({
        valid: false,
        expired: false,
        alreadyCompleted: false,
      });
    }

    if (!tokenData) {
      console.log('[API] Token not found in database:', token);
      return res.status(200).json({
        valid: false,
        expired: false,
        alreadyCompleted: false,
      });
    }

    // Check if token has already been used
    if (tokenData.used) {
      console.log('[API] Token already used:', token);
      return res.status(200).json({
        valid: false,
        expired: false,
        alreadyCompleted: true,
      });
    }

    // Check if token has expired
    const expiryDate = new Date(tokenData.expires_at);
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

    // Return valid token
    return res.status(200).json({
      valid: true,
      expired: false,
      alreadyCompleted: false,
      token: tokenData.token,
      companyId: tokenData.company_id,
    });
  } catch (error: any) {
    console.error('[API] Error validating subcontractor token:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
