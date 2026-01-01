import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import fs from 'fs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audioBase64 } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    console.log('[STT] Transcribing audio with OpenAI Whisper...');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');

    // Create a temporary file
    const tempFile = `/tmp/audio-${Date.now()}.webm`;
    fs.writeFileSync(tempFile, audioBuffer);

    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFile),
      model: 'whisper-1',
    });

    // Clean up temp file
    fs.unlinkSync(tempFile);

    console.log('[STT] Transcription successful:', transcription.text.substring(0, 50));

    return res.status(200).json({
      success: true,
      text: transcription.text,
    });
  } catch (error: any) {
    console.error('[STT] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to transcribe audio',
    });
  }
}
