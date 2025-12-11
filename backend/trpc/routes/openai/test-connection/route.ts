import { publicProcedure } from "../../../create-context.js";
import OpenAI from "openai";

export const testConnectionProcedure = publicProcedure.query(async () => {
  try {
    console.log("[OpenAI Test] Testing OpenAI connection...");
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[OpenAI Test] OPENAI_API_KEY not found");
      return {
        success: false,
        error: "OPENAI_API_KEY is not configured",
      };
    }
    
    console.log("[OpenAI Test] API key found:", apiKey.substring(0, 10) + "...");
    
    const openai = new OpenAI({ apiKey });
    
    console.log("[OpenAI Test] Making test request...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Say 'OpenAI is connected!'" }],
      max_tokens: 10,
    });
    
    const message = response.choices[0]?.message?.content || "";
    console.log("[OpenAI Test] Test successful, response:", message);
    
    return {
      success: true,
      message,
      model: response.model,
    };
  } catch (error: any) {
    console.error("[OpenAI Test] Error:", error?.message);
    console.error("[OpenAI Test] Error code:", error?.code);
    return {
      success: false,
      error: error?.message || "Failed to connect to OpenAI",
    };
  }
});
