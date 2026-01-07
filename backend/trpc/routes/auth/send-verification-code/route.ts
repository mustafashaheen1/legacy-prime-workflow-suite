import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import twilio from "twilio";
import { verificationStore } from "../../verification-store.js";

const twilioClient = twilio(
  process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID,
  process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN
);

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const sendVerificationCodeProcedure = publicProcedure
  .input(
    z.object({
      phoneNumber: z.string().describe("Phone number to send verification code to"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('[Auth] Sending verification code to:', input.phoneNumber);
      
      if (!process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID || 
          !process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN || 
          !process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER) {
        throw new Error('Twilio is not configured. Please contact the administrator.');
      }
      
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      
      const verificationData = {
        code,
        phoneNumber: input.phoneNumber,
        expiresAt,
        attempts: 0,
      };
      
      verificationStore.set(`verification:${input.phoneNumber}`, verificationData);
      
      console.log('[Auth] Attempting to send SMS via Twilio...');
      
      const message = await twilioClient.messages.create({
        body: `Your verification code is: ${code}. Valid for 10 minutes.`,
        from: process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER,
        to: input.phoneNumber,
      });

      console.log('[Auth] Verification code sent successfully:', message.sid);

      return {
        success: true,
        messageSid: message.sid,
        expiresAt,
      };
    } catch (error: any) {
      console.error("[Auth] Send verification code error:", error);

      if (error.code === 21608) {
        throw new Error('The phone number is invalid or cannot receive SMS.');
      }
      if (error.code === 21211) {
        throw new Error('The phone number is invalid.');
      }
      if (error.code === 21614) {
        throw new Error('The phone number is invalid for your country.');
      }

      throw new Error(error.message || "Could not send verification code");
    }
  });
