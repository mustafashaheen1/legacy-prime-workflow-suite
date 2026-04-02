import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface State {
  step: number;        // 0=greeting, 1=name, 2+=custom questions
  name: string;
  phone: string;
  projectDescription: string;  // captured from greeting "How can I help you today?"
  answers: string[];            // one answer per custom question, in order
}

interface AssistantConfig {
  enabled: boolean;
  greeting: string;
  nameQuestion: string;
  customQuestions: string[];
  autoAddToCRM: boolean;
}

const DEFAULT_QUESTIONS = [
  'What is your budget for this project?',
];

async function formatCallSummary(
  projectDescription: string,
  questions: string[],
  answers: string[]
): Promise<string> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const projectLine = `Project: ${projectDescription || '(not specified)'}`;
    const pairs = questions
      .map((q, i) => `Q: ${q}\nA: ${answers[i] || '(no answer)'}`)
      .join('\n\n');
    const fullInput = pairs ? `${projectLine}\n\n${pairs}` : projectLine;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: [
            'You format phone call transcripts for a construction CRM. Output a clean multi-line summary.',
            '',
            'Rules:',
            '- Q1 is always the budget. Extract the dollar amount from speech. Examples: "my budget is ten thousand dollars" → "$10,000". "around thirty k" → "$30k". "10,000 dollars" → "$10,000". If no number found, write the cleaned answer.',
            '- Q2+ : derive a short label from the question text (e.g. "Start", "Address", "Timeline", "Permits", "Phone"). Clean the answer to 3-6 words.',
            '- Include EVERY question and answer — do not skip or omit any, even if the answer seems redundant (e.g. phone number, address).',
            '',
            'Output format — first line combines project + budget, then one item per line:',
            'Kitchen Remodel - Budget: $10,000',
            'Start: Next month',
            'Address: 123 Main Street Los Angeles',
            'Phone: 845-319-7137',
            '',
            'Do NOT write \\n literally. Use actual line breaks. No bullet points. No markdown. Return ONLY the formatted lines.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: fullInput,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    // Guard: replace any literal \n the model may have output with real newlines
    return raw.replace(/\\n/g, '\n') || answers.join(' · ');
  } catch (e: any) {
    console.warn('[Voice Webhook] OpenAI format failed, using raw answers:', e.message);
    return answers.join(' · ');
  }
}

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
          // Always build greeting dynamically with real company name
          // Use saved greeting as template but ensure company name is always present
          const rawGreeting = config.greeting || '';
          const afterReplacement = rawGreeting
            .replace(/calling us\b/i, `calling ${companyName}`)
            .replace(/\{company_name\}/gi, companyName)
            .trim();
          // If saved greeting still doesn't mention the company name, use the dynamic default
          assistantConfig.greeting = afterReplacement.includes(companyName)
            ? afterReplacement
            : `Thank you for calling ${companyName}. How can I help you today?`;
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
    projectDescription: '',
    answers: [],
  };

  if (conversationState && typeof conversationState === 'string') {
    try {
      state = JSON.parse(Buffer.from(conversationState, 'base64').toString());
    } catch (e) {
      console.error('[Voice Webhook] Failed to parse state');
    }
  }

  // ── Step 0: greeting — Gather captures project description ─────────────────
  if (state.step === 0) {
    if (!SpeechResult) {
      // First hit — play greeting and wait for caller to speak
      console.log('[Voice Webhook] Sending greeting for:', companyName);
      const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${webhookUrl}?conversationState=${encodeURIComponent(encodedState)}" method="POST" speechTimeout="5">
    <Say voice="alice">${escapeXml(assistantConfig.greeting)}</Say>
  </Gather>
</Response>`;
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twiml);
    } else {
      // Caller described their need — store as project description, ask name next
      state.projectDescription = SpeechResult.trim();
      state.step = 1;
      console.log('[Voice Webhook] Project description captured:', state.projectDescription);
      const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${webhookUrl}?conversationState=${encodeURIComponent(encodedState)}" method="POST" speechTimeout="5">
    <Say voice="alice">${escapeXml(assistantConfig.nameQuestion)}</Say>
  </Gather>
</Response>`;
      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twiml);
    }
  }

  // ── Step 1: name captured ────────────────────────────────────────────────
  if (state.step === 1 && SpeechResult) {
    const nameMatch =
      SpeechResult.match(/(?:name is|i(?:'|')?m|this is|call me)\s+([a-z]+(?:\s+[a-z]+)?)/i) ||
      SpeechResult.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)$/);
    if (nameMatch?.[1]) {
      state.name = nameMatch[1].trim();
    } else if (SpeechResult.trim().split(' ').length <= 3) {
      state.name = SpeechResult.trim();
    } else {
      state.name = SpeechResult.trim().split(' ').slice(0, 2).join(' ');
    }
    state.step = 2;
    console.log('[Voice Webhook] Name captured:', state.name);
  }

  // ── Step 2+: custom question answers (else if prevents name answer bleeding in) ──
  else if (state.step >= 2 && SpeechResult && state.name) {
    if (state.answers.length < assistantConfig.customQuestions.length) {
      state.answers = [...state.answers, SpeechResult.trim()];
      console.log(`[Voice Webhook] Answer ${state.answers.length}/${assistantConfig.customQuestions.length}:`, SpeechResult);
    }
  }

  // ── Check if all questions answered ────────────────────────────────────────
  const allAnswered = state.step >= 2 && state.name && state.answers.length >= assistantConfig.customQuestions.length;

  if (allAnswered) {
    console.log('[Voice Webhook] ✅ All questions answered, saving lead:', state.name);

    if (companyId && assistantConfig.autoAddToCRM) {
      try {
        // Use OpenAI to clean + format project description + all Q&A into a compact summary
        const summary = await formatCallSummary(state.projectDescription, assistantConfig.customQuestions, state.answers);
        const notes = `[AI Call]\n${summary}`;

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

  // ── Ask next custom question (step 2+) ──────────────────────────────────────
  const question = assistantConfig.customQuestions[state.answers.length];

  console.log('[Voice Webhook] Asking:', question);

  const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${webhookUrl}?conversationState=${encodeURIComponent(encodedState)}" method="POST" speechTimeout="5">
    <Say voice="alice">${escapeXml(question)}</Say>
  </Gather>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml);
}
