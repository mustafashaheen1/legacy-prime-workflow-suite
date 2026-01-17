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

    const prompt = `You are a construction estimator analyzing a construction document/blueprint/estimate/invoice.

YOUR TASK:
1. Carefully analyze ALL pages of the document to understand what construction work is described
2. Extract ALL line items, materials, labor, and costs mentioned in the document
3. Match each item to the most appropriate item from the PRICE LIST DATABASE below
4. If you find items that don't match the price list exactly, still include them with your best category match

AVAILABLE PRICE LIST ITEMS:
${priceListText}

INSTRUCTIONS:
- Read every page carefully - documents often have itemized lists, schedules, or specifications
- Look for: material lists, line items, quantities, costs, labor hours, equipment
- For each item you find, match it to the CLOSEST item in the price list above
- Use the item ID from the price list (shown in brackets [ID: ...])
- If an item doesn't match exactly, pick the most similar category item
- Extract quantities from the document when available
- If no quantity is specified, estimate 1 as default

WHAT TO LOOK FOR:
- Material schedules and lists
- Labor and work descriptions
- Cost breakdowns
- Specifications sections
- Bill of materials
- Scope of work descriptions
- Any itemized content

RESPONSE FORMAT - Return ONLY a valid JSON array:
[
  {
    "priceListItemId": "item-id-from-database",
    "quantity": 100,
    "notes": "Description from document - any relevant details"
  }
]

IMPORTANT:
- If the document has ANY construction-related content, try to match it to price list items
- Be liberal with matching - pick the closest category even if not exact
- Include notes about what you found in the document
- Only return empty array [] if the document contains NO construction/building content at all

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

      // Instead of returning an error, return success with empty items and let the frontend handle it
      // This allows the user to see the AI's raw response and understand why no items were found
      return res.status(200).json({
        success: true,
        items: [],
        message: 'The AI analyzed the document but could not identify construction items that match your price list. This may happen if the document is not construction-related, or if the content is in a format the AI cannot parse (like scanned handwriting).',
        rawResponse: content,
        suggestion: 'Try uploading a clearer document, or manually add items to your estimate.',
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
