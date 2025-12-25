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

    const prompt = `You are analyzing an IMAGE of a construction document/blueprint. This is a PNG image, not a PDF.

CRITICAL INSTRUCTIONS:
- This is an IMAGE file that you can see with your vision capabilities
- Look at the image carefully and extract ALL visible text, numbers, measurements, and quantities
- Even if the image quality is not perfect, extract whatever you can read
- If you can see ANY construction-related information, extract it

${priceListCategories ? `Focus on these categories: ${priceListCategories.join(', ')}` : 'Include all relevant construction categories.'}

For each item you can identify in the image, provide:
1. Item name (be specific, e.g., "2x4x8 Lumber" not just "Lumber")
2. Category (e.g., Framing, Electrical, Plumbing, Drywall, Flooring, etc.)
3. Quantity (numerical value you see)
4. Unit (SF, LF, EA, CY, SY, etc.)
5. Estimated unit price in USD (if visible, otherwise use construction industry standard pricing)
6. Any notes or specifications visible

RESPONSE FORMAT - CRITICAL:
Respond ONLY with a valid JSON array. NO explanations, NO markdown, NO other text.
Even if you can only extract partial information, provide it in this format:

[
  {
    "name": "Item name from image",
    "category": "Category",
    "quantity": 100,
    "unit": "SF",
    "unitPrice": 2.50,
    "notes": "Description or specs from image"
  }
]

If you cannot read any construction information from the image at all, respond with an empty array: []

Start your response with [ and end with ].`;

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
      console.error('[AI Takeoff] Response is not an array:', typeof items);
      throw new Error('AI response is not an array');
    }

    console.log('[AI Takeoff] Successfully parsed', items.length, 'items');

    if (items.length === 0) {
      console.warn('[AI Takeoff] No items extracted from document');
      return res.status(400).json({
        error: 'No Items Found',
        message: 'The AI could not extract any construction items from this document. The image may be unclear, too low quality, or not contain a standard construction takeoff/estimate format.',
        success: false,
        items: [],
      });
    }

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
