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
    const { name, email, phone, trade, companyId, invitedBy } = req.body;

    // Validate required fields
    if (!email || !companyId || !invitedBy) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'email, companyId, and invitedBy are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if email already exists
    const { data: existingSubcontractor } = await supabase
      .from('subcontractors')
      .select('id, email, registration_completed')
      .eq('email', email)
      .eq('company_id', companyId)
      .single();

    if (existingSubcontractor && existingSubcontractor.registration_completed) {
      return res.status(400).json({
        error: 'A subcontractor with this email already exists and has completed registration'
      });
    }

    // Generate unique registration token
    const timestamp = Date.now();
    const randomString = randomBytes(16).toString('hex');
    const registrationToken = `sub_reg_${timestamp}_${randomString}`;

    // Set token expiry to 7 days from now
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 7);

    // Get company name for email
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    const companyName = company?.name || 'Legacy Prime Construction';

    // Create or update draft subcontractor
    const subcontractorData = {
      company_id: companyId,
      name: name || '',
      email: email,
      phone: phone || '',
      trade: trade || '',
      registration_token: registrationToken,
      registration_token_expiry: tokenExpiry.toISOString(),
      registration_completed: false,
      approved: false,
      is_active: false,
      invited_by: invitedBy,
      invited_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    let subcontractorId: string;

    if (existingSubcontractor) {
      // Update existing draft
      const { data, error } = await supabase
        .from('subcontractors')
        .update(subcontractorData)
        .eq('id', existingSubcontractor.id)
        .select()
        .single();

      if (error) {
        console.error('[API] Database error updating subcontractor:', error);
        return res.status(500).json({
          error: 'Failed to update subcontractor invitation',
          details: error.message
        });
      }

      subcontractorId = data.id;
      console.log('[API] Updated existing draft subcontractor:', subcontractorId);
    } else {
      // Create new draft
      const { data, error } = await supabase
        .from('subcontractors')
        .insert(subcontractorData)
        .select()
        .single();

      if (error) {
        console.error('[API] Database error creating subcontractor:', error);
        return res.status(500).json({
          error: 'Failed to create subcontractor invitation',
          details: error.message
        });
      }

      subcontractorId = data.id;
      console.log('[API] Created new draft subcontractor:', subcontractorId);
    }

    // Generate registration URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://legacyprime.com';
    const registrationUrl = `${baseUrl}/register-subcontractor/${registrationToken}`;

    // Generate email template
    const emailSubject = `Complete Your Subcontractor Profile for ${companyName}`;
    const emailBody = `Hi ${name || 'there'},

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
      subcontractorId,
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
