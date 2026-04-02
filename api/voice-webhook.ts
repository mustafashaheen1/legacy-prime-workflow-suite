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
  answers: string[];   // one answer per custom question, in order
}

interface AssistantConfig {
  enabled: boolean;
  greeting: string;
  nameQuestion: string;
  customQuestions: string[];
  autoAddToCRM: boolean;
}

const DEFAULT_QUESTIONS = [
  'What type of project do you need help with?',
  'What is your budget for this project?',
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

  const body = req.body || {};
  const { From, To, SpeechResult } = body;
  const conversationState = (req.query.conversationState as string) || body.conversationState;
  const webhookUrl = 'https://legacy-prime-workflow-suite.vercel.app/api/voice-webhook';

  // ── Load company + assistant config ────────────────────────────────────────
  let companyName = 'Legacy Prime Construction';
  let companyId: string | null = null;

  const assistantConfig: AssistantConfig = {
    enabled: true,
    greeting: `Thank you for calling ${companyName}. How can I help you today?`,
    nameQuestion: 'What is your name?',
    customQuestions: [...DEFAULT_QUESTIONS],
    autoAddToCRM: true,
  };

  if (To) {
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .eq('twilio_phone_number', To)
        .single();

      if (company?.name) {
        companyName = company.name;
        companyId = company.id;
        assistantConfig.greeting = `Thank you for calling ${companyName}. How can I help you today?`;
        console.log('[Voice Webhook] Company found:', companyName, companyId);

        const { data: config } = await supabase
          .from('call_assistant_config')
          .select('*')
          .eq('company_id', companyId)
          .single();

        if (config) {
          assistantConfig.enabled = config.enabled ?? true;
          assistantConfig.greeting = config.greeting || assistantConfig.greeting;
          assistantConfig.nameQuestion = config.name_question || assistantConfig.nameQuestion;
          assistantConfig.autoAddToCRM = config.auto_add_to_crm ?? true;

          // Prefer new custom_questions; fall back to legacy fields for old rows
          if (Array.isArray(config.custom_questions) && config.custom_questions.length > 0) {
            assistantConfig.customQuestions = config.custom_questions;
          } else {
            assistantConfig.customQuestions = [
              config.project_question || DEFAULT_QUESTIONS[0],
              config.budget_question  || DEFAULT_QUESTIONS[1],
            ];
          }
          console.log('[Voice Webhook] Loaded config, questions:', assistantConfig.customQuestions.length);
        }
      }
    } catch (e: any) {
      console.warn('[Voice Webhook] DB lookup failed, using defaults:', e.message);
    }
  }

  // ── Disabled check ──────────────────────────────────────────────────────────
  if (!assistantConfig.enabled) {
    console.log('[Voice Webhook] Assistant disabled for company:', companyId);
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling ${escapeXml(companyName)}. Our office is currently unavailable. Please call back during business hours or leave a message on our website.</Say>
  <Hangup/>
</Response>`;
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  // ── Restore state ───────────────────────────────────────────────────────────
  let state: State = {
    step: 0,
    name: '',
    phone: From || '',
    answers: [],
  };

  if (conversationState && typeof conversationState === 'string') {
    try {
      state = JSON.parse(Buffer.from(conversationState, 'base64').toString());
    } catch (e) {
      console.error('[Voice Webhook] Failed to parse state');
    }
  }

  // ── Initial greeting ────────────────────────────────────────────────────────
  if (state.step === 0 && !SpeechResult) {
    console.log('[Voice Webhook] Sending greeting for:', companyName);
    state.step = 1;
    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${webhookUrl}?conversationState=${encodeURIComponent(encodedState)}" method="POST" speechTimeout="auto">
    <Say voice="alice">${escapeXml(assistantConfig.greeting)}</Say>
  </Gather>
</Response>`;
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  // ── Process speech ──────────────────────────────────────────────────────────
  if (SpeechResult) {
    if (!state.name) {
      // First response is always treated as the caller's name
      const nameMatch =
        SpeechResult.match(/(?:name is|i(?:'|')?m|this is|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i) ||
        SpeechResult.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/);
      if (nameMatch?.[1]) {
        state.name = nameMatch[1].trim();
      } else if (SpeechResult.trim().split(' ').length <= 3) {
        state.name = SpeechResult.trim();
      } else {
        // Take first two words as name fallback
        state.name = SpeechResult.trim().split(' ').slice(0, 2).join(' ');
      }
      console.log('[Voice Webhook] Captured name:', state.name);
    } else {
      // Subsequent responses are answers to custom questions in order
      state.answers = [...(state.answers || []), SpeechResult.trim()];
      console.log(`[Voice Webhook] Answer ${state.answers.length}/${assistantConfig.customQuestions.length}:`, SpeechResult);
    }
  }

  // ── Check if all questions answered ────────────────────────────────────────
  const allAnswered = state.name && state.answers.length >= assistantConfig.customQuestions.length;

  if (allAnswered) {
    console.log('[Voice Webhook] ✅ All questions answered, saving lead:', state.name);

    if (companyId && assistantConfig.autoAddToCRM) {
      try {
        // Build compact one-line summary for CRM card display
        const isDefault =
          assistantConfig.customQuestions.length === 2 &&
          assistantConfig.customQuestions[0] === DEFAULT_QUESTIONS[0] &&
          assistantConfig.customQuestions[1] === DEFAULT_QUESTIONS[1];

        let notes: string;
        if (isDefault) {
          const project = state.answers[0] || '';
          const budget = state.answers[1] || '';
          notes = `[AI Call] ${project} - Budget: ${budget}`.trim();
        } else {
          // Custom questions: compact joined summary
          const summary = state.answers
            .map((a, i) => a || 'No answer')
            .join(' · ');
          notes = `[AI Call] ${summary}`.trim();
        }

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
    }

    const firstName = state.name.split(' ')[0];
    const closingMessage = `Thank you ${firstName}. We have received your information and will be in touch within 24 hours. Have a great day!`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">${escapeXml(closingMessage)}</Say>
  <Pause length="1"/>
  <Hangup/>
</Response>`;
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  // ── Ask next question ───────────────────────────────────────────────────────
  let question: string;
  if (!state.name) {
    question = assistantConfig.nameQuestion;
  } else {
    question = assistantConfig.customQuestions[state.answers.length];
  }

  console.log('[Voice Webhook] Asking:', question);

  const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${webhookUrl}?conversationState=${encodeURIComponent(encodedState)}" method="POST" speechTimeout="auto">
    <Say voice="alice">${escapeXml(question)}</Say>
  </Gather>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml);
}
