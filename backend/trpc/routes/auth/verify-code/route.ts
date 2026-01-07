import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import { verificationStore } from "../../verification-store.js";

const MAX_ATTEMPTS = 3;

export const verifyCodeProcedure = publicProcedure
  .input(
    z.object({
      phoneNumber: z.string(),
      code: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('[Auth] Verifying code for:', input.phoneNumber);
      
      const storedData = verificationStore.get(`verification:${input.phoneNumber}`);
      
      if (!storedData) {
        throw new Error('Verification code not found or expired');
      }

      const verificationData = storedData;

      if (new Date(verificationData.expiresAt) < new Date()) {
        verificationStore.delete(`verification:${input.phoneNumber}`);
        throw new Error('Verification code has expired');
      }

      if (verificationData.attempts >= MAX_ATTEMPTS) {
        verificationStore.delete(`verification:${input.phoneNumber}`);
        throw new Error('Too many failed attempts. Please request a new code');
      }

      if (verificationData.code !== input.code) {
        verificationData.attempts += 1;
        verificationStore.set(`verification:${input.phoneNumber}`, verificationData);
        throw new Error(
          `Incorrect code. Attempts remaining: ${MAX_ATTEMPTS - verificationData.attempts}`
        );
      }
      
      verificationStore.delete(`verification:${input.phoneNumber}`);
      
      console.log('[Auth] Phone number verified successfully:', input.phoneNumber);
      
      return {
        success: true,
        phoneNumber: input.phoneNumber,
        verified: true,
      };
    } catch (error: any) {
      console.error("[Auth] Verify code error:", error);
      throw new Error(error.message || "Failed to verify code");
    }
  });
