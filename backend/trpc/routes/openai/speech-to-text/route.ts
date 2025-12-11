import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import OpenAI from "openai";

const getOpenAI = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured in environment variables");
  }
  return new OpenAI({ apiKey });
};

export const speechToTextProcedure = publicProcedure
  .input(
    z.object({
      audioBase64: z.string(),
      language: z.string().optional(),
      prompt: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("[OpenAI Whisper] Transcribing audio");

      const openai = getOpenAI();
      const audioBuffer = Buffer.from(input.audioBase64, "base64");
      const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
      const audioFile = new File([audioBlob], "audio.wav", { type: "audio/wav" });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: input.language,
        prompt: input.prompt,
      });

      console.log("[OpenAI Whisper] Transcription completed:", transcription.text);

      return {
        success: true,
        text: transcription.text,
      };
    } catch (error: any) {
      console.error("[OpenAI Whisper] Error:", error);
      return {
        success: false,
        text: "",
        error: error.message || "Error al transcribir el audio",
      };
    }
  });
