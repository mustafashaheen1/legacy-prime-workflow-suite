import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'nova', model = 'tts-1' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('[TTS] Generating speech for text:', text.substring(0, 50));

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const mp3 = await openai.audio.speech.create({
      model,
      voice,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const audioBase64 = buffer.toString('base64');

    console.log('[TTS] Speech generated successfully');

    return res.status(200).json({
      success: true,
      audioBase64,
      mimeType: 'audio/mpeg',
    });
  } catch (error: any) {
    console.error('[TTS] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate speech',
    });
  }
}
