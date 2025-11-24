import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export const chatCompletionProcedure = publicProcedure
  .input(
    z.object({
      messages: z.array(messageSchema),
      model: z.string().optional().default("gpt-4o"),
      temperature: z.number().optional().default(0.7),
      maxTokens: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("[OpenAI Chat] Creating completion with model:", input.model);
      console.log("[OpenAI Chat] Messages count:", input.messages.length);

      const completion = await openai.chat.completions.create({
        model: input.model,
        messages: input.messages as any,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
      });

      const responseMessage = completion.choices[0]?.message?.content || "";
      console.log("[OpenAI Chat] Response length:", responseMessage.length);

      const result = {
        success: true,
        message: responseMessage,
        usage: completion.usage,
        model: completion.model,
      };

      console.log("[OpenAI Chat] Returning result:", JSON.stringify(result).substring(0, 200));
      return result;
    } catch (error: any) {
      console.error("[OpenAI Chat] Error:", error);
      const errorResult = {
        success: false,
        message: "",
        error: error.message || "Error al procesar la solicitud",
      };
      console.log("[OpenAI Chat] Returning error:", JSON.stringify(errorResult));
      return errorResult;
    }
  });
