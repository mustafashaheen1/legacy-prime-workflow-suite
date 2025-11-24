import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const textToSpeechProcedure = publicProcedure
  .input(
    z.object({
      text: z.string(),
      voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional().default("nova"),
      model: z.enum(["tts-1", "tts-1-hd"]).optional().default("tts-1"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("[OpenAI TTS] Generating speech for text:", input.text.substring(0, 50));

      const mp3 = await openai.audio.speech.create({
        model: input.model,
        voice: input.voice,
        input: input.text,
      });

      const buffer = Buffer.from(await mp3.arrayBuffer());
      const audioBase64 = buffer.toString("base64");

      console.log("[OpenAI TTS] Speech generated successfully");

      return {
        success: true,
        audioBase64,
        mimeType: "audio/mpeg",
      };
    } catch (error: any) {
      console.error("[OpenAI TTS] Error:", error);
      return {
        success: false,
        audioBase64: "",
        mimeType: "",
        error: error.message || "Error al generar el audio",
      };
    }
  });
