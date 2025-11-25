import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import twilio from "twilio";

let twilioClient: ReturnType<typeof twilio> | null = null;

try {
  if (process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID && process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(
      process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID,
      process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN
    );
  } else {
    console.warn('[Twilio SMS] Credentials not configured');
  }
} catch (error) {
  console.error('[Twilio SMS] Failed to initialize client:', error);
}

export const sendSmsProcedure = publicProcedure
  .input(
    z.object({
      to: z.string().describe("Phone number to send SMS to"),
      body: z.string().describe("Message body"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      if (!twilioClient) {
        throw new Error('Twilio not configured. Please add EXPO_PUBLIC_TWILIO_ACCOUNT_SID and EXPO_PUBLIC_TWILIO_AUTH_TOKEN.');
      }

      if (!process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER) {
        throw new Error('EXPO_PUBLIC_TWILIO_PHONE_NUMBER not configured');
      }

      const message = await twilioClient.messages.create({
        body: input.body,
        from: process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER,
        to: input.to,
      });

      return {
        success: true,
        messageSid: message.sid,
        status: message.status,
      };
    } catch (error: any) {
      console.error("Twilio SMS error:", error);
      throw new Error(error.message || "Failed to send SMS");
    }
  });
