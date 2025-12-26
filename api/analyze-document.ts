import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, imageUrl, imageUrls, documentType, priceListCategories, priceListItems } = req.body;

    if (!imageData && !imageUrl && (!imageUrls || imageUrls.length === 0)) {
      return res.status(400).json({ error: 'No image data or URL provided' });
    }

    if (!priceListItems || !Array.isArray(priceListItems) || priceListItems.length === 0) {
      return res.status(400).json({ error: 'Price list items are required' });
    }

    // Use multiple images if provided, otherwise single image
    const urls = imageUrls && imageUrls.length > 0 ? imageUrls : (imageUrl ? [imageUrl] : []);
    const hasMultiplePages = urls.length > 1;

    if (hasMultiplePages) {
      console.log(`[AI Takeoff] Analyzing ${urls.length} pages...`);
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    console.log('[AI Takeoff] Starting OpenAI analysis with', priceListItems.length, 'price list items...');

    // Format price list for AI with categories grouped
    const priceListByCategory: Record<string, any[]> = {};
    priceListItems.forEach((item: any) => {
      const category = item.category || 'Other';
      if (!priceListByCategory[category]) {
        priceListByCategory[category] = [];
      }
      priceListByCategory[category].push({
        id: item.id,
        name: item.name,
        unit: item.unit,
        unitPrice: item.unitPrice,
        description: item.description || '',
      });
    });

    // Create a concise price list string for the AI
    const priceListText = Object.entries(priceListByCategory)
      .map(([category, items]) => {
        const itemsList = items
          .map((item: any) => `  - ${item.name} (${item.unit}) - $${item.unitPrice} [ID: ${item.id}]`)
          .join('\n');
        return `${category}:\n${itemsList}`;
      })
      .join('\n\n');

    const prompt = `You are a construction estimator analyzing a construction document/blueprint IMAGE.

YOUR TASK:
1. Analyze the image to understand what construction work is proposed
2. Select appropriate items from the PRICE LIST DATABASE below
3. Estimate quantities based on the document
4. Return ONLY items that exist in the price list - NO custom items

AVAILABLE PRICE LIST ITEMS:
${priceListText}

CRITICAL INSTRUCTIONS:
- Look at the image carefully to understand the scope of work
- For each type of work you see, select the most appropriate item from the price list above
- Use the item ID from the price list (shown in brackets [ID: ...])
- Estimate realistic quantities based on what you see in the document
- If you see measurements, use them to calculate quantities
- ONLY use items from the price list above - do NOT invent new items
- If no suitable item exists in the price list for some work, skip it

RESPONSE FORMAT - CRITICAL:
Respond ONLY with a valid JSON array. NO explanations, NO markdown, NO other text.

[
  {
    "priceListItemId": "item-id-from-database",
    "quantity": 100,
    "notes": "Any relevant notes or specifications from the image"
  }
]

If you cannot identify any work that matches the price list, respond with an empty array: []

Start your response with [ and end with ].`;

    // Build content array with prompt and all images
    const messageContent: any[] = [{ type: 'text', text: prompt }];

    // Add all images to the content array
    if (urls.length > 0) {
      urls.forEach((url, index) => {
        messageContent.push({
          type: 'image_url',
          image_url: { url },
        });
      });
    } else if (imageData) {
      messageContent.push({
        type: 'image_url',
        image_url: { url: imageData },
      });
    }

    console.log(`[AI Takeoff] Sending ${messageContent.length - 1} image(s) to OpenAI...`);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: messageContent,
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
      console.warn('[AI Takeoff] OpenAI returned empty array. Raw response:', content);
      return res.status(400).json({
        error: 'No Items Found',
        message: 'The AI could not extract any construction items from this document. The image may be unclear, too low quality, or not contain a standard construction takeoff/estimate format.',
        success: false,
        items: [],
        rawResponse: content, // Include raw response for debugging
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
