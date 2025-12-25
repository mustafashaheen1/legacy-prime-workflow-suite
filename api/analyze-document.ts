import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, imageUrl, documentType, priceListCategories } = req.body;

    if (!imageData && !imageUrl) {
      return res.status(400).json({ error: 'No image data or URL provided' });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('[AI Takeoff] Starting OpenAI analysis...');

    const prompt = `You are a construction estimator AI. Analyze this ${documentType || 'construction document'} and extract a detailed material takeoff and cost estimate.

${priceListCategories ? `Focus on these categories: ${priceListCategories.join(', ')}` : 'Include all relevant construction categories.'}

For each item you identify, provide:
1. Item name (be specific, e.g., "2x4x8 Lumber" not just "Lumber")
2. Category (e.g., Framing, Electrical, Plumbing, Drywall, etc.)
3. Quantity (numerical value)
4. Unit (SF, LF, EA, CY, etc.)
5. Estimated unit price in USD (if visible, otherwise provide a reasonable estimate)
6. Any notes or specifications

IMPORTANT: Respond ONLY with a valid JSON array in this exact format:
[
  {
    "name": "Item name",
    "category": "Category name",
    "quantity": 100,
    "unit": "SF",
    "unitPrice": 2.50,
    "notes": "Any relevant notes"
  }
]

Do not include any markdown, explanations, or text outside the JSON array. Start your response with [ and end with ].`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageUrl || imageData, // Use S3 URL if provided, otherwise base64
              },
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.3, // Lower temperature for more consistent formatting
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('[AI Takeoff] Raw response:', content.substring(0, 200));

    // Check if OpenAI couldn't read the document
    if (content.toLowerCase().includes("unable to analyze") ||
        content.toLowerCase().includes("cannot analyze") ||
        content.toLowerCase().includes("can't analyze")) {
      console.error('[AI Takeoff] OpenAI could not read the document');
      return res.status(400).json({
        error: 'Document Not Readable',
        message: 'The AI could not extract text from this document. This usually means the PDF is a scanned image or has poor quality. Try uploading a text-based PDF or a clearer image.',
        aiResponse: content,
      });
    }

    // Extract JSON from the response (in case there's markdown or extra text)
    let jsonContent = content.trim();

    // Remove markdown code blocks if present
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse the JSON
    let items;
    try {
      items = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('[AI Takeoff] Failed to parse JSON:', parseError);
      console.error('[AI Takeoff] Raw content length:', content.length);
      console.error('[AI Takeoff] First 500 chars:', content.substring(0, 500));
      console.error('[AI Takeoff] Last 500 chars:', content.substring(Math.max(0, content.length - 500)));

      // Return the error with more context
      return res.status(500).json({
        error: 'Failed to parse AI response as JSON',
        rawResponse: content.substring(0, 1000), // First 1000 chars for debugging
        parseError: (parseError as Error).message,
      });
    }

    if (!Array.isArray(items)) {
      throw new Error('AI response is not an array');
    }

    console.log('[AI Takeoff] Successfully parsed', items.length, 'items');

    return res.status(200).json({
      success: true,
      items,
      rawResponse: content,
    });
  } catch (error: any) {
    console.error('[AI Takeoff] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to analyze document',
    });
  }
}
