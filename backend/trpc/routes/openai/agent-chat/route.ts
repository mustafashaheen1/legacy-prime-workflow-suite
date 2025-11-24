import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const messagePartSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("file"),
    mimeType: z.string(),
    name: z.string(),
    data: z.string().optional(),
    uri: z.string().optional(),
  }),
]);

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  parts: z.array(messagePartSchema),
  timestamp: z.number().optional(),
});

const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.any(),
});

export const agentChatProcedure = publicProcedure
  .input(
    z.object({
      messages: z.array(messageSchema),
      systemInstructions: z.string().optional(),
      tools: z.array(toolSchema).optional(),
      model: z.string().optional().default("gpt-4o"),
      temperature: z.number().optional().default(0.7),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("[OpenAI Agent] Starting chat with", input.messages.length, "messages");

      const openaiMessages: any[] = [];

      if (input.systemInstructions) {
        openaiMessages.push({
          role: "system",
          content: input.systemInstructions,
        });
      }

      for (const message of input.messages) {
        const content: any[] = [];

        for (const part of message.parts) {
          if (part.type === "text") {
            content.push({
              type: "text",
              text: part.text,
            });
          } else if (part.type === "file") {
            if (part.mimeType.startsWith("image/")) {
              const imageUrl = part.uri || `data:${part.mimeType};base64,${part.data}`;
              content.push({
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              });
            }
          }
        }

        openaiMessages.push({
          role: message.role === "user" ? "user" : "assistant",
          content: content.length === 1 && content[0].type === "text" 
            ? content[0].text 
            : content,
        });
      }

      const openaiTools = input.tools?.map(tool => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));

      console.log("[OpenAI Agent] Sending request with", openaiMessages.length, "messages");
      console.log("[OpenAI Agent] Tools:", openaiTools?.length || 0);

      const completion = await openai.chat.completions.create({
        model: input.model,
        messages: openaiMessages,
        temperature: input.temperature,
        tools: openaiTools,
        tool_choice: openaiTools && openaiTools.length > 0 ? "auto" : undefined,
      });

      const choice = completion.choices[0];
      console.log("[OpenAI Agent] Response received");

      const responseParts: any[] = [];

      if (choice.message.content) {
        responseParts.push({
          type: "text",
          text: choice.message.content,
        });
      }

      if (choice.message.tool_calls) {
        for (const toolCall of choice.message.tool_calls) {
          if (toolCall.type === "function") {
            console.log("[OpenAI Agent] Tool call:", toolCall.function.name);
            responseParts.push({
              type: "tool",
              toolName: toolCall.function.name,
              toolCallId: toolCall.id,
              input: JSON.parse(toolCall.function.arguments),
              state: "input-available",
            });
          }
        }
      }

      return {
        success: true,
        parts: responseParts,
        usage: completion.usage,
      };
    } catch (error: any) {
      console.error("[OpenAI Agent] Error:", error);
      return {
        success: false,
        parts: [],
        error: error.message || "Error al procesar la solicitud",
      };
    }
  });

export const agentToolResultProcedure = publicProcedure
  .input(
    z.object({
      messages: z.array(messageSchema),
      systemInstructions: z.string().optional(),
      toolCallId: z.string(),
      toolName: z.string(),
      toolResult: z.string(),
      model: z.string().optional().default("gpt-4o"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("[OpenAI Agent Tool] Processing tool result for:", input.toolName);

      const openaiMessages: any[] = [];

      if (input.systemInstructions) {
        openaiMessages.push({
          role: "system",
          content: input.systemInstructions,
        });
      }

      for (const message of input.messages) {
        const content: any[] = [];

        for (const part of message.parts) {
          if (part.type === "text") {
            content.push({
              type: "text",
              text: part.text,
            });
          }
        }

        openaiMessages.push({
          role: message.role === "user" ? "user" : "assistant",
          content: content.length === 1 && content[0].type === "text" 
            ? content[0].text 
            : content,
        });
      }

      openaiMessages.push({
        role: "tool",
        tool_call_id: input.toolCallId,
        name: input.toolName,
        content: input.toolResult,
      });

      const completion = await openai.chat.completions.create({
        model: input.model,
        messages: openaiMessages,
      });

      const choice = completion.choices[0];

      return {
        success: true,
        content: choice.message.content || "",
        usage: completion.usage,
      };
    } catch (error: any) {
      console.error("[OpenAI Agent Tool] Error:", error);
      return {
        success: false,
        content: "",
        error: error.message || "Error al procesar el resultado de la herramienta",
      };
    }
  });
