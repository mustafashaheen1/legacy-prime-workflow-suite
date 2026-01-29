import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import twilio from 'twilio';

// Helper functions to get Twilio credentials from multiple possible env var names
const getTwilioAccountSid = () => {
  return process.env.TWILIO_ACCOUNT_SID ||
         process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
};

const getTwilioAuthToken = () => {
  return process.env.TWILIO_AUTH_TOKEN ||
         process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
};

const getTwilioPhoneNumber = () => {
  return process.env.TWILIO_PHONE_NUMBER ||
         process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;
};

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

    // Log environment variable status for debugging
    console.log('[API] Environment check:', {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ? 'SET' : 'NOT SET',
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET',
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER ? 'SET' : 'NOT SET',
      EXPO_PUBLIC_TWILIO_ACCOUNT_SID: process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID ? 'SET' : 'NOT SET',
      EXPO_PUBLIC_TWILIO_AUTH_TOKEN: process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN ? 'SET' : 'NOT SET',
      EXPO_PUBLIC_TWILIO_PHONE_NUMBER: process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER ? 'SET' : 'NOT SET',
    });

    // Get Twilio credentials using helper functions
    const twilioAccountSid = getTwilioAccountSid();
    const twilioAuthToken = getTwilioAuthToken();
    const twilioPhoneNumber = getTwilioPhoneNumber();

    console.log('[API] Resolved Twilio credentials:', {
      accountSid: twilioAccountSid ? `${twilioAccountSid.substring(0, 10)}...` : 'MISSING',
      authToken: twilioAuthToken ? 'SET' : 'MISSING',
      phoneNumber: twilioPhoneNumber || 'MISSING',
    });

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('[API] Twilio credentials missing after checking all env vars');
      return res.status(500).json({
        error: 'SMS service not configured',
        details: 'Twilio credentials are missing. Please configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in Vercel environment variables.'
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
    let companyName = 'Legacy Prime Construction';
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();

      if (company?.name) {
        companyName = company.name;
      }
    } catch (companyError) {
      console.log('[API] Could not fetch company name, using default');
    }

    // Store token in database (optional - token is in URL anyway)
    try {
      await supabase
        .from('registration_tokens')
        .insert({
          token: registrationToken,
          company_id: companyId,
          invited_by: invitedBy,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
    } catch (tokenError) {
      console.log('[API] Could not store registration token (table may not exist), continuing anyway');
    }

    // Generate registration URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://legacy-prime-workflow-suite.vercel.app';
    const registrationUrl = `${baseUrl}/register-subcontractor/${registrationToken}`;

    // Create SMS message
    const smsMessage = `${companyName} has invited you to join as a subcontractor. Complete your profile here: ${registrationUrl} (Link expires in 7 days)`;

    console.log('[API] About to initialize Twilio client...');
    console.log('[API] Twilio Account SID present:', !!twilioAccountSid);
    console.log('[API] Twilio Auth Token present:', !!twilioAuthToken);
    console.log('[API] Twilio Phone Number:', twilioPhoneNumber);

    // Initialize Twilio client and send SMS
    let twilioClient;
    try {
      twilioClient = twilio(twilioAccountSid, twilioAuthToken);
      console.log('[API] Twilio client initialized successfully');
    } catch (initError: any) {
      console.error('[API] Failed to initialize Twilio client:', initError);
      throw new Error(`Twilio initialization failed: ${initError.message}`);
    }

    console.log('[API] Sending SMS to:', phoneNumber);
    console.log('[API] SMS message length:', smsMessage.length);

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
    console.error('[API] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

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

    // Return detailed error for debugging
    return res.status(500).json({
      error: 'Failed to send SMS',
      message: error.message,
      details: error.toString(),
      code: error.code || 'UNKNOWN'
    });
  }
}
