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
    const startTime = Date.now();
    try {
      console.log("[OpenAI Chat] ========== START ==========");
      console.log("[OpenAI Chat] Model:", input.model);
      console.log("[OpenAI Chat] Messages count:", input.messages.length);
      console.log("[OpenAI Chat] Temperature:", input.temperature);
      console.log("[OpenAI Chat] Max tokens:", input.maxTokens || "auto");
      
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        console.error("[OpenAI Chat] OPENAI_API_KEY not found in environment");
        throw new Error("OpenAI API key is not configured");
      }
      console.log("[OpenAI Chat] API key found:", apiKey.substring(0, 10) + "...");

      const openai = getOpenAI();
      console.log("[OpenAI Chat] Making request to OpenAI...");
      
      const completion = await openai.chat.completions.create({
        model: input.model,
        messages: input.messages as any,
        temperature: input.temperature,
        max_tokens: input.maxTokens,
      });

      const responseMessage = completion.choices[0]?.message?.content || "";
      const elapsed = Date.now() - startTime;
      
      console.log("[OpenAI Chat] Response received in", elapsed, "ms");
      console.log("[OpenAI Chat] Response length:", responseMessage.length, "chars");
      console.log("[OpenAI Chat] Usage:", JSON.stringify(completion.usage));

      const result = {
        success: true,
        message: responseMessage,
        usage: completion.usage,
        model: completion.model,
      };

      console.log("[OpenAI Chat] ========== SUCCESS ==========");
      return result;
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.error("[OpenAI Chat] ========== ERROR ==========");
      console.error("[OpenAI Chat] Error after", elapsed, "ms");
      console.error("[OpenAI Chat] Error type:", error?.constructor?.name || typeof error);
      console.error("[OpenAI Chat] Error message:", error?.message);
      console.error("[OpenAI Chat] Error code:", error?.code);
      console.error("[OpenAI Chat] Full error:", JSON.stringify(error, null, 2));
      
      const errorResult = {
        success: false,
        message: "",
        error: error?.message || "Error al procesar la solicitud",
      };
      
      return errorResult;
    }
  });
