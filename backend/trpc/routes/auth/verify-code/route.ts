import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      
      const storedData = await AsyncStorage.getItem(`verification:${input.phoneNumber}`);
      
      if (!storedData) {
        throw new Error('Código de verificación no encontrado o expirado');
      }
      
      const verificationData = JSON.parse(storedData);
      
      if (new Date(verificationData.expiresAt) < new Date()) {
        await AsyncStorage.removeItem(`verification:${input.phoneNumber}`);
        throw new Error('El código de verificación ha expirado');
      }
      
      if (verificationData.attempts >= MAX_ATTEMPTS) {
        await AsyncStorage.removeItem(`verification:${input.phoneNumber}`);
        throw new Error('Demasiados intentos fallidos. Solicita un nuevo código');
      }
      
      if (verificationData.code !== input.code) {
        verificationData.attempts += 1;
        await AsyncStorage.setItem(
          `verification:${input.phoneNumber}`,
          JSON.stringify(verificationData)
        );
        throw new Error(
          `Código incorrecto. Intentos restantes: ${MAX_ATTEMPTS - verificationData.attempts}`
        );
      }
      
      await AsyncStorage.removeItem(`verification:${input.phoneNumber}`);
      
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
