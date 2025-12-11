import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import twilio from "twilio";

const getTwilioAccountSid = () => {
  return process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID || process.env['twilio sid'];
};

const getTwilioAuthToken = () => {
  return process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN || process.env['twilio autoken'];
};

const getTwilioPhoneNumber = () => {
  return process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER || process.env['twilio number'];
};

let twilioClient: ReturnType<typeof twilio> | null = null;

try {
  const accountSid = getTwilioAccountSid();
  const authToken = getTwilioAuthToken();
  
  console.log('[CRM] Checking Twilio credentials:', { 
    accountSid: accountSid ? '✓ Set' : '✗ Missing',
    authToken: authToken ? '✓ Set' : '✗ Missing',
    phoneNumber: getTwilioPhoneNumber() ? '✓ Set' : '✗ Missing'
  });
  
  if (accountSid && authToken) {
    twilioClient = twilio(accountSid, authToken);
    console.log('[CRM] Twilio client initialized successfully');
  } else {
    console.warn('[CRM] Twilio credentials not configured');
  }
} catch (error) {
  console.error('[CRM] Failed to initialize Twilio client:', error);
}

export const sendInspectionLinkProcedure = publicProcedure
  .input(
    z.object({
      clientName: z.string().describe("Client's name"),
      clientPhone: z.string().describe("Client's phone number"),
      projectId: z.string().optional().describe("Optional project ID for tracking"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("[CRM] Sending inspection link to:", input.clientName, input.clientPhone);

      if (!twilioClient) {
        console.error('[CRM] Twilio client not initialized - missing credentials');
        const accountSid = getTwilioAccountSid();
        const authToken = getTwilioAuthToken();
        
        throw new Error(`Twilio not configured properly. Status: Account SID: ${accountSid ? 'Set' : 'Missing'}, Auth Token: ${authToken ? 'Set' : 'Missing'}. Please configure your Twilio credentials.`);
      }

      const twilioPhoneNumber = getTwilioPhoneNumber();
      if (!twilioPhoneNumber) {
        throw new Error('Twilio phone number not configured. Please set your Twilio phone number in environment variables.');
      }

      const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://rork.app';
      const token = `client=${encodeURIComponent(input.clientName)}&project=${input.projectId || 'new'}`;
      const inspectionUrl = `${baseUrl}/inspection/${encodeURIComponent(token)}`;

      const messageBody = `Hi ${input.clientName.split(' ')[0]},

Legacy Prime Construction here! 

We'd like to gather some details about your project. Please use this link to record a quick video walkthrough, take photos, and provide measurements:

${inspectionUrl}

This helps us create an accurate estimate for you. The process takes about 5-10 minutes.

Thank you!
- Legacy Prime Construction Team`;

      console.log('[CRM] Sending SMS:', {
        from: twilioPhoneNumber,
        to: input.clientPhone,
        messageLength: messageBody.length
      });

      const message = await twilioClient.messages.create({
        body: messageBody,
        from: twilioPhoneNumber,
        to: input.clientPhone,
      });

      console.log("[CRM] Inspection link sent successfully:", message.sid);

      return {
        success: true,
        messageSid: message.sid,
        status: message.status,
        inspectionUrl,
      };
    } catch (error: any) {
      console.error("[CRM] Failed to send inspection link:", error);
      throw new Error(error.message || "Failed to send inspection link");
    }
  });
