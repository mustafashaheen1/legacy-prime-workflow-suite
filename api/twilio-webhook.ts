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

  const { From, SpeechResult } = req.body;
  const conversationState = req.query.state as string | undefined;
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
      console.log('[Twilio Webhook] 📦 Restored state:', state);
    } catch (e) {
      console.error('[Twilio Webhook] Failed to parse state');
    }
  }

  // First call - send greeting
  if (state.step === 0 && !SpeechResult) {
    console.log('[Twilio Webhook] Sending greeting');
    state.step = 1;

    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
    const actionUrl = `${webhookUrl}?state=${encodeURIComponent(encodedState)}`;

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" speechTimeout="auto">
    <Say voice="alice">Thank you for calling Legacy Prime Construction. How can I help you today?</Say>
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
          // Filter out common non-names and project types
          const lowerName = extractedName.toLowerCase();
          const nonNames = ['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'hello', 'hi', 'hey',
                           'kitchen', 'bathroom', 'remodel', 'renovation', 'addition', 'roofing',
                           'basement', 'deck', 'patio', 'flooring', 'painting', 'project'];
          if (!nonNames.includes(lowerName) && extractedName.split(' ').length <= 3) {
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
  // Require ALL three: name, project, AND budget
  const hasEnoughInfo = state.name && state.project && state.budget;

  if (hasEnoughInfo) {
    console.log('[Twilio Webhook] ✅ QUALIFIED LEAD:', state);

    // Save to CRM database
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        console.log('[Twilio Webhook] 💾 Saving lead to CRM...');

        // TODO: When multi-company is implemented, lookup company by Twilio number
        // For now, use hardcoded company ID
        const companyId = '3fd6f909-5c10-45eb-98af-83eb26879eec';
        console.log('[Twilio Webhook] 🏢 Using company ID:', companyId);

        // Determine lead status based on budget
        const budgetValue = parseInt((state.budget || '0').replace(/[^0-9]/g, '')) || 0;
        const isQualified = budgetValue >= 10000;

        // Save to clients table (only fields that exist in schema)
        const clientData = {
          company_id: companyId,
          name: state.name,
          phone: state.phone,
          email: '', // Not collected in call
          status: isQualified ? 'Project' : 'Lead',
          source: 'Other', // Database constraint: only allows Google, Referral, Ad, Other
          address: `[AI Call] ${state.project || 'General Inquiry'} - Budget: ${state.budget || 'Not specified'}`,
          next_follow_up_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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
        console.log('[Twilio Webhook] 📊 Lead details:', {
          name: state.name,
          project: state.project,
          budget: state.budget,
          status: isQualified ? 'Project' : 'Lead',
        });
      } catch (saveError: any) {
        console.error('[Twilio Webhook] ❌ Error saving to CRM:', saveError.message);
        // Don't fail the call if CRM save fails - still thank the customer
      }
    } else {
      console.log('[Twilio Webhook] ⚠️ Supabase not configured, skipping CRM save');
    }

    const closingMessage = `Wonderful, ${state.name.split(' ')[0]}! Thanks for sharing that you're interested in a ${state.project} project with a budget of ${state.budget}. One of our project managers will call you back within 24 hours to discuss the details. We're excited to help with your project!`;

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
    question = 'Great! What is your name?';
  } else if (!state.project) {
    question = 'Wonderful! What type of project do you need help with?';
  } else if (!state.budget) {
    question = 'Perfect! What kind of budget are you working with for this project?';
  }

  console.log('[Twilio Webhook] Asking:', question);
  console.log('[Twilio Webhook] Current state:', state);

  const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
  const actionUrl = `${webhookUrl}?state=${encodeURIComponent(encodedState)}`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" speechTimeout="auto">
    <Say voice="alice">${question}</Say>
  </Gather>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml);
}
