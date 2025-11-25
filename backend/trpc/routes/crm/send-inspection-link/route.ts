import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import twilio from "twilio";

const twilioClient = twilio(
  process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID,
  process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN
);

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

      const inspectionUrl = `https://inspection.legacyprime.com/start?client=${encodeURIComponent(input.clientName)}&project=${input.projectId || 'new'}`;

      const messageBody = `Hi ${input.clientName.split(' ')[0]},

Legacy Prime Construction here! 

We'd like to gather some details about your project. Please use this link to record a quick video walkthrough, take photos, and provide measurements:

${inspectionUrl}

This helps us create an accurate estimate for you. The process takes about 5-10 minutes.

Thank you!
- Legacy Prime Construction Team`;

      const message = await twilioClient.messages.create({
        body: messageBody,
        from: process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER,
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
