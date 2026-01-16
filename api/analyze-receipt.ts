import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[AnalyzeReceipt] ===== API ROUTE STARTED =====');
  console.log('[AnalyzeReceipt] Method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, imageUrl, categories } = req.body;

    if (!imageData && !imageUrl) {
      console.log('[AnalyzeReceipt] Missing image data');
      return res.status(400).json({ error: 'No image data or URL provided' });
    }

    // Initialize OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[AnalyzeReceipt] Missing OpenAI API key');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const openai = new OpenAI({ apiKey });

    // Categories for expense classification
    const expenseCategories = categories || [
      'PRE-CONSTRUCTION',
      'DEMOLITION',
      'CONCRETE & MASONRY',
      'FRAMING & ROUGH CARPENTRY',
      'ROOFING',
      'EXTERIOR FINISHES',
      'WINDOWS & DOORS',
      'PLUMBING',
      'ELECTRICAL',
      'HVAC',
      'INSULATION',
      'DRYWALL',
      'INTERIOR FINISHES',
      'FLOORING',
      'PAINTING',
      'CABINETRY & MILLWORK',
      'LANDSCAPING',
      'CLEANUP & FINAL',
    ];

    const prompt = `You are an expert at analyzing receipts and invoices for construction expense tracking.

Analyze this receipt/invoice image and extract the following information:

1. Store/Vendor Name: The name of the store or vendor
2. Total Amount: The total amount on the receipt (look for "Total", "Grand Total", "Amount Due", etc.)
3. Date: The date of the transaction (in ISO format YYYY-MM-DD if possible)
4. Category: Based on the items purchased, classify into one of these construction categories:
${expenseCategories.map(c => `   - ${c}`).join('\n')}

5. Items: Brief description of the main items purchased (if visible)
6. Confidence: Your confidence level in the extraction (0-100)

IMPORTANT:
- Look carefully at the receipt for the total amount
- If multiple totals are shown, use the final/grand total
- For the category, consider what the items are used for in construction
- Hardware store receipts should be categorized by the primary items purchased

Respond ONLY with valid JSON in this exact format:
{
  "store": "Store Name",
  "amount": 123.45,
  "date": "2024-01-15",
  "category": "CATEGORY_NAME",
  "items": "Brief description of items",
  "confidence": 85
}

If you cannot read the receipt clearly, still provide your best estimate with a lower confidence score.
Start your response with { and end with }.`;

    console.log('[AnalyzeReceipt] Sending to OpenAI...');
    const startTime = Date.now();

    // Build image content
    const imageContent = imageUrl || imageData;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: imageContent },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.2,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[AnalyzeReceipt] OpenAI response received in ${elapsed}ms`);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    console.log('[AnalyzeReceipt] Raw response:', content.substring(0, 200));

    // Extract JSON from the response
    let jsonContent = content.trim();

    // Remove markdown code blocks if present
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```\n?/, '').replace(/\n?```$/, '');
    }

    // Parse the JSON
    let result;
    try {
      result = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('[AnalyzeReceipt] Failed to parse JSON:', parseError);
      console.error('[AnalyzeReceipt] Content:', content);

      // Return a default response if parsing fails
      return res.status(200).json({
        success: true,
        data: {
          store: '',
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          category: 'PRE-CONSTRUCTION',
          items: '',
          confidence: 0,
        },
        error: 'Could not parse receipt automatically. Please enter details manually.',
        rawResponse: content,
      });
    }

    console.log('[AnalyzeReceipt] ===== API ROUTE COMPLETED =====');
    console.log('[AnalyzeReceipt] Extracted:', {
      store: result.store,
      amount: result.amount,
      category: result.category,
      confidence: result.confidence,
    });

    return res.status(200).json({
      success: true,
      data: {
        store: result.store || '',
        amount: typeof result.amount === 'number' ? result.amount : parseFloat(result.amount) || 0,
        date: result.date || new Date().toISOString().split('T')[0],
        category: result.category || 'PRE-CONSTRUCTION',
        items: result.items || '',
        confidence: result.confidence || 0,
      },
      usage: response.usage,
    });
  } catch (error: any) {
    console.error('[AnalyzeReceipt] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to analyze receipt',
    });
  }
}
