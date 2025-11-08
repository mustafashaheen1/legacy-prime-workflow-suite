import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID,
  process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN
);

export const makeCallProcedure = publicProcedure
  .input(
    z.object({
      to: z.string().describe("Phone number to call"),
      message: z.string().optional().describe("Text-to-speech message"),
      twimlUrl: z.string().optional().describe("TwiML URL for call flow"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const twilioPhoneNumber = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;
      
      if (!twilioPhoneNumber) {
        throw new Error("Twilio phone number not configured");
      }

      const twiml = new twilio.twiml.VoiceResponse();
      
      if (input.message) {
        twiml.say({ voice: "alice" }, input.message);
      }

      const call = await twilioClient.calls.create({
        twiml: input.twimlUrl ? undefined : twiml.toString(),
        url: input.twimlUrl,
        to: input.to,
        from: twilioPhoneNumber,
      });

      return {
        success: true,
        callSid: call.sid,
        status: call.status,
      };
    } catch (error: any) {
      console.error("Twilio call error:", error);
      throw new Error(error.message || "Failed to make call");
    }
  });
