import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import twilio from "twilio";
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      
      const verificationData = {
        code,
        phoneNumber: input.phoneNumber,
        expiresAt,
        attempts: 0,
      };
      
      await AsyncStorage.setItem(
        `verification:${input.phoneNumber}`,
        JSON.stringify(verificationData)
      );
      
      const message = await twilioClient.messages.create({
        body: `Tu código de verificación es: ${code}. Válido por 10 minutos.`,
        from: process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER,
        to: input.phoneNumber,
      });

      console.log('[Auth] Verification code sent:', message.sid);

      return {
        success: true,
        messageSid: message.sid,
        expiresAt,
      };
    } catch (error: any) {
      console.error("[Auth] Send verification code error:", error);
      throw new Error(error.message || "Failed to send verification code");
    }
  });
