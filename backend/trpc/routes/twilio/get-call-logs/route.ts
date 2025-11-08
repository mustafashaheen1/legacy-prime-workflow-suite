import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID,
  process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN
);

export const getCallLogsProcedure = publicProcedure
  .input(
    z.object({
      limit: z.number().optional().default(20),
    })
  )
  .query(async ({ input }) => {
    try {
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
