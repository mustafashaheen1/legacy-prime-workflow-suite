import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import twilio from 'twilio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Send subcontractor invitation via SMS request received');

  try {
    const { companyId, invitedBy, phoneNumber } = req.body;

    // Validate required fields
    if (!companyId || !invitedBy || !phoneNumber) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'companyId, invitedBy, and phoneNumber are required'
      });
    }

    // Validate phone number format (should be +1XXXXXXXXXX)
    const phoneRegex = /^\+1\d{10}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        error: 'Invalid phone number',
        details: 'Phone number must be a valid US number in format +1XXXXXXXXXX'
      });
    }

    // Check Twilio credentials
    const twilioAccountSid = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('[API] Twilio credentials missing');
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Twilio credentials are missing. Please configure EXPO_PUBLIC_TWILIO_ACCOUNT_SID, EXPO_PUBLIC_TWILIO_AUTH_TOKEN, and EXPO_PUBLIC_TWILIO_PHONE_NUMBER.'
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

    // Get company name for SMS
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', companyId)
      .single();

    const companyName = company?.name || 'Legacy Prime Construction';

    // Store token in database
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
      // Continue anyway - token is in the URL
    }

    // Generate registration URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://legacy-prime-workflow-suite.vercel.app';
    const registrationUrl = `${baseUrl}/register-subcontractor/${registrationToken}`;

    // Create SMS message
    const smsMessage = `${companyName} has invited you to join as a subcontractor. Complete your profile here: ${registrationUrl} (Link expires in 7 days)`;

    // Initialize Twilio client and send SMS
    const twilioClient = twilio(twilioAccountSid, twilioAuthToken);

    console.log('[API] Sending SMS to:', phoneNumber);

    const message = await twilioClient.messages.create({
      body: smsMessage,
      from: twilioPhoneNumber,
      to: phoneNumber,
    });

    console.log('[API] SMS sent successfully:', message.sid);

    return res.status(200).json({
      success: true,
      messageSid: message.sid,
      status: message.status,
      registrationUrl,
    });
  } catch (error: any) {
    console.error('[API] Error sending SMS invitation:', error);

    // Handle specific Twilio errors
    if (error.code === 21211) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }
    if (error.code === 21608) {
      return res.status(400).json({ error: 'The phone number cannot receive SMS messages' });
    }
    if (error.code === 21614) {
      return res.status(400).json({ error: 'Invalid phone number for this region' });
    }

    return res.status(500).json({
      error: 'Failed to send SMS',
      message: error.message
    });
  }
}
