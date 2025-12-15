import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { From, SpeechResult, conversationState } = req.body;
    const twiml = new twilio.twiml.VoiceResponse();

    let state: any = {
      step: 0,
      collectedInfo: { name: '', phone: From || '', projectType: '', budget: '' },
      conversationHistory: [],
    };

    if (conversationState) {
      try {
        state = JSON.parse(Buffer.from(conversationState, 'base64').toString());
      } catch (e) {}
    }

    if (state.step === 0 && !SpeechResult) {
      twiml.say({ voice: 'alice' }, 'Thank you for calling. How can I help you today?');
      const gather = twiml.gather({
        input: ['speech'],
        action: process.env.EXPO_PUBLIC_API_URL + '/api/twilio-webhook',
        method: 'POST',
      });
      (gather as any).parameter({ name: 'conversationState', value: Buffer.from(JSON.stringify({ ...state, step: 1 })).toString('base64') });
      res.setHeader('Content-Type', 'text/xml');
      return res.send(twiml.toString());
    }

    if (SpeechResult) {
      const lower = SpeechResult.toLowerCase();
      if (!state.collectedInfo.name && lower.includes('name is')) {
        const match = SpeechResult.match(/name is (\w+)/i);
        if (match) state.collectedInfo.name = match[1];
      }
      if (!state.collectedInfo.projectType && lower.includes('kitchen')) {
        state.collectedInfo.projectType = 'Kitchen';
      }
      if (!state.collectedInfo.budget && lower.match(/\d+/)) {
        state.collectedInfo.budget = lower.match(/\d+/)[0];
      }
    }

    const hasInfo = state.collectedInfo.name && (state.collectedInfo.projectType || state.collectedInfo.budget);

    if (hasInfo) {
      try {
        const { data: company } = await supabase.from('companies').select('id').limit(1).single();
        if (company) {
          await supabase.from('clients').insert({
            company_id: company.id,
            name: state.collectedInfo.name,
            phone: state.collectedInfo.phone,
            email: '',
            status: 'lead',
            source: 'Phone Call',
          });
        }
      } catch (e) {
        console.error('DB error:', e);
      }
      
      twiml.say({ voice: 'alice' }, 'Thank you. We will call you back soon.');
      twiml.hangup();
      res.setHeader('Content-Type', 'text/xml');
      return res.send(twiml.toString());
    }

    let question = !state.collectedInfo.name ? 'What is your name?' : 
                   !state.collectedInfo.projectType ? 'What project do you need help with?' :
                   'What is your budget?';
    
    twiml.say({ voice: 'alice' }, question);
    const gather = twiml.gather({
      input: ['speech'],
      action: process.env.EXPO_PUBLIC_API_URL + '/api/twilio-webhook',
      method: 'POST',
    });
    state.step++;
    (gather as any).parameter({ name: 'conversationState', value: Buffer.from(JSON.stringify(state)).toString('base64') });
    
    res.setHeader('Content-Type', 'text/xml');
    return res.send(twiml.toString());

  } catch (error) {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'alice' }, 'Sorry, an error occurred.');
    twiml.hangup();
    res.setHeader('Content-Type', 'text/xml');
    return res.send(twiml.toString());
  }
}
