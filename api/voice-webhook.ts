import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface State {
  step: number;
  name: string;
  phone: string;
  project: string;
  budget: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Voice Webhook] Request received:', {
    method: req.method,
    From: req.body.From,
    To: req.body.To,
    SpeechResult: req.body.SpeechResult || '(initial call)',
  });

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { From, To, SpeechResult, conversationState } = req.body;
  const webhookUrl = 'https://legacy-prime-workflow-suite.vercel.app/api/voice-webhook';

  // Look up company by the Twilio number that was called
  let companyName = 'Legacy Prime Construction';
  let companyId: string | null = null;
  if (To) {
    try {
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .eq('twilio_phone_number', To)
        .single();
      if (data?.name) {
        companyName = data.name;
        companyId = data.id;
        console.log('[Voice Webhook] Company found:', companyName, companyId);
      }
    } catch (e) {
      console.warn('[Voice Webhook] Could not look up company, using default');
    }
  }

  // Initialize or restore state
  let state: State = {
    step: 0,
    name: '',
    phone: From || '',
    project: '',
    budget: '',
  };

  if (conversationState && typeof conversationState === 'string') {
    try {
      state = JSON.parse(Buffer.from(conversationState, 'base64').toString());
    } catch (e) {
      console.error('[Voice Webhook] Failed to parse state');
    }
  }

  // First call - send greeting
  if (state.step === 0 && !SpeechResult) {
    console.log('[Voice Webhook] Sending greeting for:', companyName);
    state.step = 1;

    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${webhookUrl}" method="POST" speechTimeout="auto">
    <Say voice="alice">Thank you for calling ${companyName}. How can I help you today?</Say>
    <Parameter name="conversationState" value="${encodedState}"/>
  </Gather>
</Response>`;

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  // Process speech input
  if (SpeechResult) {
    console.log('[Voice Webhook] Processing speech:', SpeechResult);
    state.step++;

    const lower = SpeechResult.toLowerCase();

    // Extract name
    if (!state.name) {
      const nameMatch = SpeechResult.match(/(?:name is|i'm|this is|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i);
      if (nameMatch && nameMatch[1]) {
        state.name = nameMatch[1].trim();
        console.log('[Voice Webhook] Extracted name:', state.name);
      }
    }

    // Extract project
    if (!state.project) {
      if (lower.includes('kitchen')) state.project = 'Kitchen';
      else if (lower.includes('bathroom')) state.project = 'Bathroom';
      else if (lower.includes('remodel') || lower.includes('renovation')) state.project = 'Remodel';
      else if (lower.includes('addition')) state.project = 'Addition';
      if (state.project) console.log('[Voice Webhook] Extracted project:', state.project);
    }

    // Extract budget
    if (!state.budget) {
      const budgetMatch = SpeechResult.match(/\$?\d{1,3}(?:,\d{3})*/);
      if (budgetMatch) {
        state.budget = budgetMatch[0];
        console.log('[Voice Webhook] Extracted budget:', state.budget);
      }
    }
  }

  // Check if we have enough information to qualify the lead
  const hasEnoughInfo = state.name && (state.project || state.budget);

  if (hasEnoughInfo) {
    console.log('[Voice Webhook] ✅ QUALIFIED LEAD:', state);

    // Save lead to clients table
    if (companyId) {
      try {
        const notes = `[AI Call] ${state.project || 'Project'}${state.budget ? ' - Budget: ' + state.budget : ''}`;
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            company_id: companyId,
            name: state.name,
            phone: state.phone,
            email: `phonecall_${Date.now()}@unknown.com`,
            source: 'Phone Call',
            status: 'Lead',
            address: notes,
            last_contact_date: new Date().toISOString(),
            last_contacted: new Date().toISOString(),
          })
          .select()
          .single();

        if (clientError) {
          console.error('[Voice Webhook] Failed to save lead:', clientError.message);
        } else {
          console.log('[Voice Webhook] ✅ Lead saved to CRM:', newClient.id, state.name);
        }
      } catch (err: any) {
        console.error('[Voice Webhook] Error saving lead:', err.message);
      }
    } else {
      console.warn('[Voice Webhook] No companyId — lead not saved to CRM');
    }

    const closingMessage = `Thank you ${state.name.split(' ')[0]}. We have received your ${state.project || 'project'} inquiry${state.budget ? ' with a budget of ' + state.budget : ''}. We will call you back within 24 hours.`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${closingMessage}</Say>
  <Pause length="1"/>
  <Say voice="alice">Have a great day!</Say>
  <Hangup/>
</Response>`;

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  // Ask for missing information
  let question = '';
  if (!state.name) {
    question = 'What is your name?';
  } else if (!state.project) {
    question = 'What type of project do you need help with?';
  } else if (!state.budget) {
    question = 'What is your budget for this project?';
  }

  console.log('[Voice Webhook] Asking:', question);

  const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${webhookUrl}" method="POST" speechTimeout="auto">
    <Say voice="alice">${question}</Say>
    <Parameter name="conversationState" value="${encodedState}"/>
  </Gather>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml);
}
