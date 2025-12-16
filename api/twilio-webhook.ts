import type { VercelRequest, VercelResponse } from '@vercel/node';
import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    console.log('[Twilio] Request received:', {
      method: req.method,
      body: req.body,
      env: {
        hasSupabaseUrl: !!process.env.EXPO_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasApiUrl: !!process.env.EXPO_PUBLIC_API_URL,
      }
    });

    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }
    
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
        console.log('[Twilio] Restored state:', state);
      } catch (e) {
        console.error('[Twilio] State parse error:', e);
      }
    }

    // First call - greeting
    if (state.step === 0 && !SpeechResult) {
      console.log('[Twilio] Sending greeting');
      state.step = 1;
      
      twiml.say({ voice: 'alice' }, 'Thank you for calling Legacy Prime Construction. How can I help you today?');
      
      const gather = twiml.gather({
        input: ['speech'],
        action: (process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app') + '/api/twilio-webhook',
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
      console.log('[Twilio] Processing speech:', SpeechResult);
      state.step++;
      
      const lower = (SpeechResult as string).toLowerCase();
      
      // Extract name
      if (!state.name && lower.includes('name')) {
        const match = (SpeechResult as string).match(/(?:name is|i'm|this is|call me)\s+(\w+)/i);
        if (match) {
          state.name = match[1];
          console.log('[Twilio] Extracted name:', state.name);
        }
      }
      
      // Extract project
      if (!state.project) {
        if (lower.includes('kitchen')) state.project = 'Kitchen';
        else if (lower.includes('bathroom')) state.project = 'Bathroom';
        else if (lower.includes('remodel')) state.project = 'Remodel';
        console.log('[Twilio] Extracted project:', state.project);
      }
      
      // Extract budget
      if (!state.budget && lower.match(/\d+/)) {
        const match = lower.match(/\d+/);
        if (match) {
          state.budget = match[0];
          console.log('[Twilio] Extracted budget:', state.budget);
        }
      }
    }

    // Check if we have enough info
    const hasEnoughInfo = state.name && (state.project || state.budget);

    if (hasEnoughInfo) {
      console.log('[Twilio] Qualified lead, saving to DB:', state);

      // Try to save to database
      try {
        if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = createClient(
            process.env.EXPO_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
          );

          const { data: company } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single();

          if (company) {
            const { data, error } = await supabase.from('clients').insert({
              company_id: company.id,
              name: state.name,
              phone: state.phone,
              email: '',
              status: 'lead',
              project_type: state.project || 'General',
              budget: state.budget || '',
              source: 'Phone Call (AI)',
            });

            if (error) {
              console.error('[Twilio] DB insert error:', error);
            } else {
              console.log('[Twilio] Saved to CRM successfully');
            }
          }
        } else {
          console.warn('[Twilio] Missing Supabase env vars, skipping DB save');
        }
      } catch (dbError) {
        console.error('[Twilio] Database error:', dbError);
      }

      twiml.say({ voice: 'alice' }, `Thank you ${state.name}. We will call you back within 24 hours. Have a great day!`);
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

    console.log('[Twilio] Asking:', question);

    twiml.say({ voice: 'alice' }, question);
    
    const gather = twiml.gather({
      input: ['speech'],
      action: (process.env.EXPO_PUBLIC_API_URL || 'https://legacy-prime-workflow-suite.vercel.app') + '/api/twilio-webhook',
      method: 'POST',
      speechTimeout: 'auto',
    });

    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
    (gather as any).parameter({ name: 'conversationState', value: encodedState });

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());

  } catch (error: any) {
    console.error('[Twilio] Fatal error:', error.message, error.stack);

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'alice' }, 'I apologize, but I am experiencing technical difficulties. Please call back later.');
    twiml.hangup();
    
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }
}
