import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import twilio from "twilio";

export const createVirtualAssistantProcedure = publicProcedure
  .input(
    z.object({
      businessName: z.string(),
      greeting: z.string(),
      webhookUrl: z.string().describe("URL for handling AI assistant responses"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const twiml = new twilio.twiml.VoiceResponse();
      
      twiml.say({ voice: "alice" }, input.greeting);
      
      const gather = twiml.gather({
        input: ["speech"],
        action: input.webhookUrl,
        method: "POST",
        speechTimeout: "auto",
      });
      
      gather.say({ voice: "alice" }, "Please tell me how I can help you today.");

      return {
        success: true,
        twiml: twiml.toString(),
      };
    } catch (error: any) {
      console.error("Virtual assistant creation error:", error);
      throw new Error(error.message || "Failed to create virtual assistant");
    }
  });
