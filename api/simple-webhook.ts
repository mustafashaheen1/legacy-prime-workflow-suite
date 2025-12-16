import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Simple Webhook] Request received:', {
    method: req.method,
    body: req.body,
  });

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { From, SpeechResult, conversationState } = req.body;

    const twiml = new twilio.twiml.VoiceResponse();

    // Simple conversation state
    let state: any = {
      step: 0,
      name: '',
      phone: From || '',
      project: '',
      budget: '',
    };

    if (conversationState) {
      try {
        state = JSON.parse(Buffer.from(conversationState as string, 'base64').toString());
      } catch (e) {
        console.error('[Simple Webhook] State parse error:', e);
      }
    }

    // First call - greeting
    if (state.step === 0 && !SpeechResult) {
      console.log('[Simple Webhook] Sending greeting');
      state.step = 1;

      twiml.say({ voice: 'alice' }, 'Thank you for calling Legacy Prime Construction. How can I help you today?');

      const gather = twiml.gather({
        input: ['speech'],
        action: 'https://legacy-prime-workflow-suite.vercel.app/api/simple-webhook',
        method: 'POST',
        speechTimeout: 'auto',
      });

      const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
      (gather as any).parameter({ name: 'conversationState', value: encodedState });

      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twiml.toString());
    }

    // Process speech
    if (SpeechResult) {
      console.log('[Simple Webhook] Processing speech:', SpeechResult);
      state.step++;

      const lower = (SpeechResult as string).toLowerCase();

      // Extract name
      if (!state.name && lower.includes('name')) {
        const match = (SpeechResult as string).match(/(?:name is|i'm|this is|call me)\s+(\w+)/i);
        if (match) {
          state.name = match[1];
        }
      }

      // Extract project
      if (!state.project) {
        if (lower.includes('kitchen')) state.project = 'Kitchen';
        else if (lower.includes('bathroom')) state.project = 'Bathroom';
        else if (lower.includes('remodel')) state.project = 'Remodel';
      }

      // Extract budget
      if (!state.budget && lower.match(/\d+/)) {
        const match = lower.match(/\d+/);
        if (match) {
          state.budget = match[0];
        }
      }
    }

    // Check if we have enough info
    const hasEnoughInfo = state.name && (state.project || state.budget);

    if (hasEnoughInfo) {
      console.log('[Simple Webhook] Qualified lead:', state);

      twiml.say({ voice: 'alice' }, `Thank you ${state.name}. We have received your ${state.project || 'project'} inquiry. We will call you back within 24 hours. Have a great day!`);
      twiml.hangup();

      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twiml.toString());
    }

    // Ask for missing info
    let question = '';
    if (!state.name) {
      question = 'What is your name?';
    } else if (!state.project) {
      question = 'What type of project do you need help with?';
    } else if (!state.budget) {
      question = 'What is your budget for this project?';
    }

    console.log('[Simple Webhook] Asking:', question);

    twiml.say({ voice: 'alice' }, question);

    const gather = twiml.gather({
      input: ['speech'],
      action: 'https://legacy-prime-workflow-suite.vercel.app/api/simple-webhook',
      method: 'POST',
      speechTimeout: 'auto',
    });

    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
    (gather as any).parameter({ name: 'conversationState', value: encodedState });

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());

  } catch (error: any) {
    console.error('[Simple Webhook] Error:', error.message, error.stack);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'alice' }, 'I apologize, but I am experiencing technical difficulties. Please call back later.');
    twiml.hangup();

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }
}
