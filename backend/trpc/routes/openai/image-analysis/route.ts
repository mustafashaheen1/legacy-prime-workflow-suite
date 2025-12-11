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

export const imageAnalysisProcedure = publicProcedure
  .input(
    z.object({
      imageUrl: z.string().optional(),
      imageBase64: z.string().optional(),
      prompt: z.string().default("¿Qué hay en esta imagen? Describe detalladamente."),
      model: z.string().optional().default("gpt-4o"),
      maxTokens: z.number().optional().default(500),
    })
  )
  .mutation(async ({ input }) => {
    const startTime = Date.now();
    try {
      if (!input.imageUrl && !input.imageBase64) {
        throw new Error("Debes proporcionar imageUrl o imageBase64");
      }

      console.log("[OpenAI Vision] ========== START ==========");
      console.log("[OpenAI Vision] Model:", input.model);
      console.log("[OpenAI Vision] Max tokens:", input.maxTokens);
      console.log("[OpenAI Vision] Has URL:", !!input.imageUrl);
      console.log("[OpenAI Vision] Has Base64:", !!input.imageBase64);
      console.log("[OpenAI Vision] Prompt:", input.prompt.substring(0, 50) + "...");

      const openai = getOpenAI();
      const imageContent = input.imageUrl
        ? input.imageUrl
        : `data:image/jpeg;base64,${input.imageBase64}`;

      console.log("[OpenAI Vision] Making request to OpenAI...");
      const response = await openai.chat.completions.create({
        model: input.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: input.prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageContent,
                },
              },
            ],
          },
        ],
        max_tokens: input.maxTokens,
      });

      const elapsed = Date.now() - startTime;
      const analysis = response.choices[0]?.message?.content || "";
      
      console.log("[OpenAI Vision] Response received in", elapsed, "ms");
      console.log("[OpenAI Vision] Analysis length:", analysis.length, "chars");
      console.log("[OpenAI Vision] Usage:", JSON.stringify(response.usage));
      console.log("[OpenAI Vision] ========== SUCCESS ==========");

      return {
        success: true,
        analysis,
        usage: response.usage,
      };
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error("[OpenAI Vision] ========== ERROR ==========");
      console.error("[OpenAI Vision] Error after", elapsed, "ms");
      console.error("[OpenAI Vision] Error type:", error?.constructor?.name || typeof error);
      console.error("[OpenAI Vision] Error message:", error?.message);
      console.error("[OpenAI Vision] Error code:", error?.code);
      console.error("[OpenAI Vision] Full error:", JSON.stringify(error, null, 2));
      
      return {
        success: false,
        analysis: "",
        error: error?.message || "Error al analizar la imagen",
      };
    }
  });
