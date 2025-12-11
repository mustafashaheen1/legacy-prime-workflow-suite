import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import twilio from "twilio";

let twilioClient: ReturnType<typeof twilio> | null = null;

try {
  if (process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID && process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(
      process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID,
      process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN
    );
  } else {
    console.warn('[Twilio Call Logs] Credentials not configured');
  }
} catch (error) {
  console.error('[Twilio Call Logs] Failed to initialize client:', error);
}

export const getCallLogsProcedure = publicProcedure
  .input(
    z.object({
      limit: z.number().optional().default(20),
    })
  )
  .query(async ({ input }) => {
    try {
      if (!twilioClient) {
        throw new Error('Twilio not configured. Please add EXPO_PUBLIC_TWILIO_ACCOUNT_SID and EXPO_PUBLIC_TWILIO_AUTH_TOKEN.');
      }

      const calls = await twilioClient.calls.list({
        limit: input.limit,
      });

      return {
        success: true,
        calls: calls.map((call) => ({
          sid: call.sid,
          from: call.from,
          to: call.to,
          status: call.status,
          direction: call.direction,
          duration: call.duration,
          startTime: call.startTime,
          endTime: call.endTime,
          price: call.price,
          priceUnit: call.priceUnit,
        })),
      };
    } catch (error: any) {
      console.error("Twilio get call logs error:", error);
      throw new Error(error.message || "Failed to get call logs");
    }
  });
