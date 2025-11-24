import { publicProcedure } from "../../../create-context";
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
    try {
      if (!input.imageUrl && !input.imageBase64) {
        throw new Error("Debes proporcionar imageUrl o imageBase64");
      }

      console.log("[OpenAI Vision] Analyzing image");

      const openai = getOpenAI();
      const imageContent = input.imageUrl
        ? input.imageUrl
        : `data:image/jpeg;base64,${input.imageBase64}`;

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

      console.log("[OpenAI Vision] Image analyzed successfully");

      return {
        success: true,
        analysis: response.choices[0]?.message?.content || "",
        usage: response.usage,
      };
    } catch (error: any) {
      console.error("[OpenAI Vision] Error:", error);
      return {
        success: false,
        analysis: "",
        error: error.message || "Error al analizar la imagen",
      };
    }
  });
