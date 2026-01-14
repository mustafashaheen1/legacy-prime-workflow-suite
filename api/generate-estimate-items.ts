import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[GenerateEstimateItems] ===== API ROUTE STARTED =====');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, userPrompt, priceList, budget } = req.body;

    if (!systemPrompt || !userPrompt) {
      return res.status(400).json({ error: 'System prompt and user prompt are required' });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error('[GenerateEstimateItems] Missing OpenAI API key');
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('[GenerateEstimateItems] Calling OpenAI API...');
    console.log('[GenerateEstimateItems] User prompt:', userPrompt.substring(0, 100));

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2048,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GenerateEstimateItems] OpenAI API error:', errorText);
      return res.status(500).json({ error: `OpenAI API error: ${response.status}` });
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    console.log('[GenerateEstimateItems] OpenAI response:', content.substring(0, 200));

    // Parse the JSON response
    let items = [];
    try {
      // Try to parse as JSON object with items array
      const objectMatch = content.match(/\{\s*"items"[\s\S]*\}/);
      if (objectMatch) {
        const parsed = JSON.parse(objectMatch[0]);
        items = parsed.items || [];
      } else {
        // Fallback to array format
        const arrayMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (arrayMatch) {
          items = JSON.parse(arrayMatch[0]);
        }
      }
    } catch (parseError) {
      console.error('[GenerateEstimateItems] Failed to parse response:', parseError);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    // Validate and filter items to only include those from the price list
    const validItems = items.filter((item: any) => {
      if (!item.priceListItemId) return false;
      const exists = priceList?.some((pl: any) => pl.id === item.priceListItemId);
      return exists;
    });

    console.log('[GenerateEstimateItems] Generated', validItems.length, 'valid items');

    return res.status(200).json({
      success: true,
      items: validItems,
    });
  } catch (error: any) {
    console.error('[GenerateEstimateItems] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
