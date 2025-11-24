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

      const completion = await openai.chat.completions.create({
        model: input.model,
        messages: input.messages as any,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
      });

      console.log("[OpenAI Chat] Completion created successfully");

      return {
        success: true,
        message: completion.choices[0]?.message?.content || "",
        usage: completion.usage,
        model: completion.model,
      };
    } catch (error: any) {
      console.error("[OpenAI Chat] Error:", error);
      return {
        success: false,
        message: "",
        error: error.message || "Error al procesar la solicitud",
      };
    }
  });
