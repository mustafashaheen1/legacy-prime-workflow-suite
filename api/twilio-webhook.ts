import type { VercelRequest, VercelResponse } from '@vercel/node';

interface State {
  step: number;
  name: string;
  phone: string;
  project: string;
  budget: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Twilio Webhook] Request received:', {
    method: req.method,
    From: req.body.From,
    SpeechResult: req.body.SpeechResult || '(initial call)',
  });

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { From, SpeechResult, conversationState } = req.body;
  const webhookUrl = 'https://legacy-prime-workflow-suite.vercel.app/api/twilio-webhook';

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
      console.error('[Twilio Webhook] Failed to parse state');
    }
  }

  // First call - send greeting
  if (state.step === 0 && !SpeechResult) {
    console.log('[Twilio Webhook] Sending greeting');
    state.step = 1;

    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${webhookUrl}" method="POST" speechTimeout="auto">
    <Say voice="alice">Thank you for calling Legacy Prime Construction. How can I help you today?</Say>
    <Parameter name="conversationState" value="${encodedState}"/>
  </Gather>
</Response>`;

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml);
  }

  // Process speech input
  if (SpeechResult) {
    console.log('[Twilio Webhook] Processing speech:', SpeechResult);
    state.step++;

    const lower = SpeechResult.toLowerCase();

    // Extract name (more flexible patterns)
    if (!state.name) {
      const namePatterns = [
        /(?:name is|i'm|this is|call me|it's|name's)\s+([a-z]+(?:\s+[a-z]+)?)/i,
        /^(?:yes|yeah|yep|sure|okay|ok)?,?\s*([a-z]+(?:\s+[a-z]+)?)\.?$/i, // "Yes, John" or just "John"
        /([a-z]+(?:\s+[a-z]+)?)\s*(?:here|speaking)\.?$/i, // "John here" or "John speaking"
      ];

      for (const pattern of namePatterns) {
        const nameMatch = SpeechResult.match(pattern);
        if (nameMatch && nameMatch[1]) {
          const extractedName = nameMatch[1].trim();
          // Filter out common non-names
          const lowerName = extractedName.toLowerCase();
          if (!['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'hello', 'hi', 'hey'].includes(lowerName)
              && extractedName.split(' ').length <= 3) {
            state.name = extractedName;
            console.log('[Twilio Webhook] ✅ Extracted name:', state.name);
            break;
          }
        }
      }
    }

    // Extract project
    if (!state.project) {
      if (lower.includes('kitchen')) state.project = 'Kitchen';
      else if (lower.includes('bathroom')) state.project = 'Bathroom';
      else if (lower.includes('remodel') || lower.includes('renovation')) state.project = 'Remodel';
      else if (lower.includes('addition')) state.project = 'Addition';
      if (state.project) console.log('[Twilio Webhook] Extracted project:', state.project);
    }

    // Extract budget
    if (!state.budget) {
      const budgetMatch = SpeechResult.match(/\$?\d{1,3}(?:,\d{3})*/);
      if (budgetMatch) {
        state.budget = budgetMatch[0];
        console.log('[Twilio Webhook] Extracted budget:', state.budget);
      }
    }
  }

  // Check if we have enough information to qualify the lead
  const hasEnoughInfo = state.name && (state.project || state.budget);

  if (hasEnoughInfo) {
    console.log('[Twilio Webhook] ✅ QUALIFIED LEAD:', state);

    // Save to CRM database
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        console.log('[Twilio Webhook] 💾 Saving lead to CRM...');

        // Get the first company (default company for now)
        const companiesResponse = await fetch(`${supabaseUrl}/rest/v1/companies?select=id&limit=1`, {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
          },
        });

        if (!companiesResponse.ok) {
          throw new Error('Failed to fetch company');
        }

        const companies = await companiesResponse.json();
        if (!companies || companies.length === 0) {
          throw new Error('No companies found');
        }

        const companyId = companies[0].id;

        // Determine lead status based on budget
        const budgetValue = parseInt((state.budget || '0').replace(/[^0-9]/g, '')) || 0;
        const isQualified = budgetValue >= 10000;

        // Save to clients table
        const clientData = {
          company_id: companyId,
          name: state.name,
          phone: state.phone,
          email: '', // Not collected in call
          status: isQualified ? 'active-project' : 'lead',
          project_type: state.project || 'General Inquiry',
          budget: state.budget || 'Not specified',
          property_type: 'Residential',
          timeline: 'Not specified',
          source: 'Phone Call (AI Receptionist)',
          notes: `AI Receptionist Call on ${new Date().toLocaleString()}\nBudget: ${state.budget || 'Not specified'}\nProject: ${state.project || 'Not specified'}`,
        };

        const clientResponse = await fetch(`${supabaseUrl}/rest/v1/clients`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify(clientData),
        });

        if (!clientResponse.ok) {
          const error = await clientResponse.text();
          throw new Error(`Failed to save client: ${error}`);
        }

        const newClients = await clientResponse.json();
        const newClient = newClients[0];

        console.log('[Twilio Webhook] ✅ Client saved successfully! ID:', newClient.id);

        // Save call log
        const callLogData = {
          company_id: companyId,
          client_id: newClient.id,
          call_date: new Date().toISOString(),
          duration: state.step,
          outcome: isQualified ? 'Qualified' : 'Info Collected',
          notes: `Project: ${state.project || 'Not specified'}\nBudget: ${state.budget || 'Not specified'}`,
          follow_up_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
        };

        const callLogResponse = await fetch(`${supabaseUrl}/rest/v1/call_logs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(callLogData),
        });

        if (!callLogResponse.ok) {
          console.error('[Twilio Webhook] ⚠️ Failed to save call log');
        } else {
          console.log('[Twilio Webhook] ✅ Call log saved successfully!');
        }
      } catch (saveError: any) {
        console.error('[Twilio Webhook] ❌ Error saving to CRM:', saveError.message);
        // Don't fail the call if CRM save fails - still thank the customer
      }
    } else {
      console.log('[Twilio Webhook] ⚠️ Supabase not configured, skipping CRM save');
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

  console.log('[Twilio Webhook] Asking:', question);

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
