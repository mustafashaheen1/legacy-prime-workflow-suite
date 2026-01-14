import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

// API endpoint for generating custom AI reports
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, projectsData } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[Generate AI Report] OpenAI API key not configured');
      return res.status(500).json({ error: 'AI service not configured' });
    }

    const openai = new OpenAI({ apiKey });

    const dataContext = projectsData ? JSON.stringify(projectsData, null, 2) : 'No project data provided';

    const systemPrompt = `You are a professional construction project report generator. Generate detailed, professional reports based on the user's requirements and the project data provided. Use clear sections, bullet points, and summaries. Include relevant metrics, insights, and actionable recommendations.`;

    const userPrompt = `User Request: ${prompt}

Project Data:
${dataContext}

Generate a detailed report based on the user's request. Format it in a clear, professional manner with sections, bullet points, and summaries as appropriate. Include relevant metrics, insights, and recommendations.`;

    console.log('[Generate AI Report] Generating report with prompt:', prompt.slice(0, 100));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const generatedReport = completion.choices[0]?.message?.content;

    if (!generatedReport) {
      throw new Error('No response from AI');
    }

    console.log('[Generate AI Report] Report generated successfully, length:', generatedReport.length);

    return res.status(200).json({
      success: true,
      report: generatedReport,
    });
  } catch (error: any) {
    console.error('[Generate AI Report] Error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate report',
    });
  }
}
