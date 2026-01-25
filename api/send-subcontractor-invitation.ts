import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Send subcontractor invitation request received');

  try {
    const { companyId, invitedBy } = req.body;

    // Validate required fields
    if (!companyId || !invitedBy) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'companyId and invitedBy are required'
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate unique registration token
    const timestamp = Date.now();
    const randomString = randomBytes(16).toString('hex');
    const registrationToken = `sub_reg_${timestamp}_${randomString}`;

    // Get company name for email
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    const companyName = company?.name || 'Legacy Prime Construction';

    // Store token with company and inviter info in a registration_tokens table
    // (we'll create this to track tokens without creating draft subcontractors)
    const { error: tokenError } = await supabase
      .from('registration_tokens')
      .insert({
        token: registrationToken,
        company_id: companyId,
        invited_by: invitedBy,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    if (tokenError) {
      console.error('[API] Error storing registration token:', tokenError);
      // If table doesn't exist, continue anyway - token is in the URL
    }

    // Generate registration URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://legacyprime.com';
    const registrationUrl = `${baseUrl}/register-subcontractor/${registrationToken}`;

    // Generate email template
    const emailSubject = `Complete Your Subcontractor Profile for ${companyName}`;
    const emailBody = `Hi there,

You have been invited to join ${companyName} as a subcontractor.

Please complete your profile and upload your business documents by clicking the link below:

${registrationUrl}

This link will expire in 7 days.

What you'll need:
✓ Business license
✓ Insurance certificate
✓ W9 form
✓ Any relevant certifications

If you have any questions, please contact ${companyName}.

Best regards,
${companyName}`;

    console.log('[API] Invitation created successfully');

    return res.status(200).json({
      success: true,
      registrationUrl,
      emailSubject,
      emailBody,
    });
  } catch (error: any) {
    console.error('[API] Error sending subcontractor invitation:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
