import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, tools, toolResults } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('[AI Chat] Processing chat request with', messages.length, 'messages');

    // Convert messages to OpenAI format
    const openaiMessages: any[] = messages.map((msg: any) => {
      if (msg.role === 'user' && msg.files && msg.files.length > 0) {
        // Handle messages with images
        const content: any[] = [{ type: 'text', text: msg.text || 'Analyze these images' }];

        msg.files.forEach((file: any) => {
          if (file.mimeType?.startsWith('image/')) {
            content.push({
              type: 'image_url',
              image_url: { url: file.uri },
            });
          }
        });

        return {
          role: msg.role,
          content,
        };
      }

      return {
        role: msg.role,
        content: msg.text || msg.content,
      };
    });

    // Add tool results if present
    if (toolResults && toolResults.length > 0) {
      toolResults.forEach((result: any) => {
        openaiMessages.push({
          role: 'tool',
          tool_call_id: result.id,
          content: JSON.stringify(result.result),
        });
      });
    }

    // Convert tools to OpenAI function format if provided
    const openaiTools = tools
      ? Object.entries(tools).map(([name, tool]: [string, any]) => ({
          type: 'function',
          function: {
            name,
            description: tool.description,
            parameters: tool.zodSchema ? zodToJsonSchema(tool.zodSchema) : {},
          },
        }))
      : undefined;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: openaiMessages,
      tools: openaiTools,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message;

    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Check if AI wants to call tools
    if (response.tool_calls && response.tool_calls.length > 0) {
      return res.status(200).json({
        type: 'tool_calls',
        tool_calls: response.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
        })),
      });
    }

    // Regular text response
    return res.status(200).json({
      type: 'text',
      content: response.content,
    });
  } catch (error: any) {
    console.error('[AI Chat] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to process chat',
    });
  }
}

// Helper to convert Zod schema to JSON Schema (simplified)
function zodToJsonSchema(zodSchema: any): any {
  // This is a simplified version - you may need a proper zod-to-json-schema library
  // For now, return a basic schema
  return {
    type: 'object',
    properties: {},
  };
}
