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
    console.warn('[Twilio Bulk SMS] Credentials not configured');
  }
} catch (error) {
  console.error('[Twilio Bulk SMS] Failed to initialize client:', error);
}

export const sendBulkSmsProcedure = publicProcedure
  .input(
    z.object({
      recipients: z.array(
        z.object({
          phone: z.string(),
          name: z.string(),
        })
      ),
      body: z.string().describe("Message body with {name} placeholder"),
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

      const results = await Promise.allSettled(
        input.recipients.map(async (recipient) => {
          const personalizedBody = input.body.replace(
            "{name}",
            recipient.name.split(" ")[0]
          );

          const message = await twilioClient!.messages.create({
            body: personalizedBody,
            from: process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER,
            to: recipient.phone,
          });

          return {
            phone: recipient.phone,
            name: recipient.name,
            success: true,
            messageSid: message.sid,
            status: message.status,
          };
        })
      );

      const successful = results.filter(
        (r) => r.status === "fulfilled"
      ).length;
      const failed = results.filter((r) => r.status === "rejected").length;

      return {
        success: true,
        totalSent: successful,
        totalFailed: failed,
        results: results.map((r) =>
          r.status === "fulfilled"
            ? r.value
            : { success: false, error: (r.reason as Error).message }
        ),
      };
    } catch (error: any) {
      console.error("Bulk SMS error:", error);
      throw new Error(error.message || "Failed to send bulk SMS");
    }
  });
