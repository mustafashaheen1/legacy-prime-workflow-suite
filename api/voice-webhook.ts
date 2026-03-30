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

interface AssistantConfig {
  enabled: boolean;
  greeting: string;
  projectQuestion: string;
  budgetQuestion: string;
  autoAddToCRM: boolean;
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

  const { From, To, SpeechResult } = req.body;
  const conversationState = (req.query.conversationState as string) || req.body.conversationState;
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

  // Load call assistant config for this company
  const assistantConfig: AssistantConfig = {
    enabled: true,
    greeting: `Thank you for calling ${companyName}. How can I help you today?`,
    projectQuestion: 'What type of project do you need help with?',
    budgetQuestion: 'What is your budget for this project?',
    autoAddToCRM: true,
  };

  if (companyId) {
    try {
      const { data: config } = await supabase
        .from('call_assistant_config')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (config) {
        assistantConfig.enabled = config.enabled ?? true;
        assistantConfig.greeting = config.greeting || assistantConfig.greeting;
        assistantConfig.projectQuestion = config.project_question || assistantConfig.projectQuestion;
        assistantConfig.budgetQuestion = config.budget_question || assistantConfig.budgetQuestion;
        assistantConfig.autoAddToCRM = config.auto_add_to_crm ?? true;
        console.log('[Voice Webhook] Loaded assistant config for company:', companyId);
      }
    } catch (e) {
      console.warn('[Voice Webhook] No assistant config found, using defaults');
    }
  }

  // If assistant is disabled, politely decline
  if (!assistantConfig.enabled) {
    console.log('[Voice Webhook] Assistant disabled for company:', companyId);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling ${companyName}. Our office is currently unavailable. Please call back during business hours or leave a message on our website.</Say>
  <Hangup/>
</Response>`;
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
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
  <Gather input="speech" action="${webhookUrl}?conversationState=${encodeURIComponent(encodedState)}" method="POST" speechTimeout="auto">
    <Say voice="alice">${assistantConfig.greeting}</Say>
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

    // Extract name — match "my name is John", "I'm John", or just "John Smith"
    if (!state.name) {
      const nameMatch = SpeechResult.match(/(?:name is|i(?:'|')?m|this is|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i)
        || SpeechResult.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/);
      if (nameMatch && nameMatch[1]) {
        state.name = nameMatch[1].trim();
        console.log('[Voice Webhook] Extracted name:', state.name);
      } else if (SpeechResult.trim().split(' ').length <= 3) {
        state.name = SpeechResult.trim();
        console.log('[Voice Webhook] Extracted name (fallback):', state.name);
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

    // Extract budget — matches $15000, 15,000, 15000, $5k etc.
    if (!state.budget) {
      const budgetMatch = SpeechResult.match(/\$?\d[\d,]*(?:k)?/i);
      if (budgetMatch) {
        const raw = budgetMatch[0];
        state.budget = raw.startsWith('$') ? raw : `$${raw}`;
        console.log('[Voice Webhook] Extracted budget:', state.budget);
      }
    }
  }

  // Check if we have enough information to qualify the lead
  const hasEnoughInfo = state.name && state.project && state.budget;

  if (hasEnoughInfo) {
    console.log('[Voice Webhook] ✅ QUALIFIED LEAD:', state);

    // Save lead to clients table (if enabled)
    if (companyId && assistantConfig.autoAddToCRM) {
      try {
        const notes = `[AI Call] ${state.project || 'Project'}${state.budget ? ' - Budget: ' + state.budget : ''}`;
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            company_id: companyId,
            name: state.name,
            phone: state.phone,
            email: null,
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
    } else if (!assistantConfig.autoAddToCRM) {
      console.log('[Voice Webhook] Auto-add to CRM disabled — lead not saved');
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
    question = assistantConfig.projectQuestion;
  } else if (!state.budget) {
    question = assistantConfig.budgetQuestion;
  }

  console.log('[Voice Webhook] Asking:', question);

  const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${webhookUrl}?conversationState=${encodeURIComponent(encodedState)}" method="POST" speechTimeout="auto">
    <Say voice="alice">${question}</Say>
  </Gather>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml);
}
