import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID,
  process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN
);

export const sendSmsProcedure = publicProcedure
  .input(
    z.object({
      to: z.string().describe("Phone number to send SMS to"),
      body: z.string().describe("Message body"),
    })
  )
  .mutation(async ({ input }) => {
    try {
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
