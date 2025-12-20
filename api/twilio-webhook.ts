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

    // Check if they're asking about pricing (be flexible with how they ask)
    const isPricingQuestion = lower.match(/(?:how much|what.*cost|price|pricing|budget|expensive|afford|cost|much)/);
    const mentionsProject = lower.match(/kitchen|bathroom|paint|floor|roof|deck|patio|basement|addition|siding|window|door|drywall|electrical|plumbing|hvac|remodel|renovation|model/);

    // If they mention both cost/price AND a project type, assume it's a pricing question
    const likelyPricingQuestion = isPricingQuestion && mentionsProject;

    if (likelyPricingQuestion && state.step === 2) {
      // They asked a pricing question on first response - answer it!
      console.log('[Twilio Webhook] 💰 Detected pricing question - providing estimate');

      let projectType = '';
      let estimate = '';
      if (lower.includes('kitchen')) {
        projectType = 'kitchen remodel';
        state.project = 'Kitchen'; // Save to state!
        estimate = '$15,000 to $50,000 depending on the size and finishes';
      } else if (lower.includes('bathroom')) {
        projectType = 'bathroom remodel';
        state.project = 'Bathroom'; // Save to state!
        estimate = '$12,000 to $40,000 depending on size and quality';
      } else if (lower.includes('addition')) {
        projectType = 'addition';
        state.project = 'Addition'; // Save to state!
        estimate = '$100 to $300 per square foot';
      } else if (lower.includes('basement')) {
        projectType = 'basement finishing';
        state.project = 'Basement'; // Save to state!
        estimate = '$30,000 to $75,000 for a typical basement';
      } else {
        projectType = 'remodel';
        state.project = 'Remodel'; // Save to state!
        estimate = 'varies based on the scope, typically $20,000 to $100,000';
      }

      console.log('[Twilio Webhook] 📝 Extracted project from question:', state.project);
      const pricingResponse = `Great question! A ${projectType} typically costs ${estimate}. I'd love to help you with this! What's your name?`;

      const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
      const actionUrl = `${webhookUrl}?state=${encodeURIComponent(encodedState)}`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="${actionUrl}" method="POST" speechTimeout="auto">
    <Say voice="alice">${pricingResponse}</Say>
  </Gather>
</Response>`;

      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twiml);
    }

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
                           'basement', 'deck', 'patio', 'flooring', 'painting', 'project', 'work',
                           'need', 'want', 'looking', 'interested'];

          // Check if ANY word in the name is a non-name word
          const words = lowerName.split(' ');
          const containsNonName = words.some(word => nonNames.includes(word));

          if (!containsNonName && extractedName.split(' ').length <= 3) {
            state.name = extractedName;
            console.log('[Twilio Webhook] ✅ Extracted name:', state.name);
            break;
          } else if (containsNonName) {
            console.log('[Twilio Webhook] ⏭️ Skipped non-name:', extractedName);
          }
        }
      }
    }

    // Extract project type
    if (!state.project) {
      if (lower.includes('kitchen')) state.project = 'Kitchen';
      else if (lower.includes('bathroom')) state.project = 'Bathroom';
      else if (lower.includes('painting') || lower.includes('paint')) state.project = 'Painting';
      else if (lower.includes('flooring') || lower.includes('floor')) state.project = 'Flooring';
      else if (lower.includes('roof') || lower.includes('roofing')) state.project = 'Roofing';
      else if (lower.includes('deck') || lower.includes('patio')) state.project = 'Deck/Patio';
      else if (lower.includes('basement')) state.project = 'Basement';
      else if (lower.includes('addition') || lower.includes('add on')) state.project = 'Addition';
      else if (lower.includes('siding') || lower.includes('exterior')) state.project = 'Exterior';
      else if (lower.includes('window') || lower.includes('door')) state.project = 'Windows/Doors';
      else if (lower.includes('drywall')) state.project = 'Drywall';
      else if (lower.includes('electrical') || lower.includes('electric')) state.project = 'Electrical';
      else if (lower.includes('plumbing') || lower.includes('plumber')) state.project = 'Plumbing';
      else if (lower.includes('hvac') || lower.includes('heating') || lower.includes('cooling')) state.project = 'HVAC';
      else if (lower.includes('remodel') || lower.includes('renovation')) state.project = 'Remodel';

      if (state.project) console.log('[Twilio Webhook] Extracted project:', state.project);
    }

    // Extract budget (handle various formats: $50000, $50,000, 50k, fifty thousand, etc.)
    if (!state.budget) {
      // Try different patterns
      const patterns = [
        /\$?\d{1,3}(?:,\d{3})+/,           // $50,000 or 50,000
        /\$?\d+k/i,                        // 50k or $50k
        /\$?\d{4,}/,                       // $50000 (4+ digits without commas)
        /(?:around|about|roughly|approximately)?\s*\$?\d+(?:,\d{3})*/i, // around $50,000
      ];

      for (const pattern of patterns) {
        const budgetMatch = SpeechResult.match(pattern);
        if (budgetMatch) {
          state.budget = budgetMatch[0];
          console.log('[Twilio Webhook] ✅ Extracted budget:', state.budget);
          break;
        }
      }

      // Also check for word numbers (thousand, million)
      if (!state.budget) {
        const wordToNumber: { [key: string]: number } = {
          'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
          'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
          'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
          'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
          'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
          'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90,
          'hundred': 100, 'thousand': 1000, 'million': 1000000
        };

        // Check for "million" first (higher priority)
        if (lower.includes('million')) {
          const millionMatch = SpeechResult.match(/(\d+(?:\.\d+)?)\s*million/i);
          if (millionMatch) {
            const value = parseFloat(millionMatch[1]) * 1000000;
            state.budget = `$${value.toLocaleString()}`;
            console.log('[Twilio Webhook] ✅ Extracted budget from million:', state.budget);
          } else if (lower.match(/\b(?:a|one)\s*million/i)) {
            state.budget = '$1,000,000';
            console.log('[Twilio Webhook] ✅ Extracted budget: a million');
          } else {
            // Try to parse word numbers like "thirty million"
            const words = SpeechResult.toLowerCase().split(/\s+/);
            for (let i = 0; i < words.length - 1; i++) {
              if (words[i + 1] === 'million' && wordToNumber[words[i]]) {
                const value = wordToNumber[words[i]] * 1000000;
                state.budget = `$${value.toLocaleString()}`;
                console.log('[Twilio Webhook] ✅ Extracted word million:', state.budget);
                break;
              }
            }
          }
        }
        // Check for "thousand"
        else if (lower.includes('thousand')) {
          const thousandMatch = SpeechResult.match(/(\d+)\s*thousand/i);
          if (thousandMatch) {
            state.budget = `$${thousandMatch[1]},000`;
            console.log('[Twilio Webhook] ✅ Extracted budget from thousand:', state.budget);
          } else if (lower.match(/\b(?:a|one)\s*thousand/i)) {
            state.budget = '$1,000';
            console.log('[Twilio Webhook] ✅ Extracted budget: a thousand');
          } else {
            // Try to parse word numbers like "thirty thousand", "fifty thousand"
            const words = SpeechResult.toLowerCase().split(/\s+/);
            for (let i = 0; i < words.length - 1; i++) {
              if (words[i + 1] === 'thousand' && wordToNumber[words[i]]) {
                const value = wordToNumber[words[i]] * 1000;
                state.budget = `$${value.toLocaleString()}`;
                console.log('[Twilio Webhook] ✅ Extracted word thousand:', state.budget);
                break;
              }
            }
          }
        }
        // Check for "hundred"
        else if (lower.includes('hundred')) {
          const hundredMatch = SpeechResult.match(/(\d+)\s*hundred/i);
          if (hundredMatch) {
            state.budget = `$${parseInt(hundredMatch[1]) * 100}`;
            console.log('[Twilio Webhook] ✅ Extracted budget from hundred:', state.budget);
          } else {
            // Try word numbers like "five hundred"
            const words = SpeechResult.toLowerCase().split(/\s+/);
            for (let i = 0; i < words.length - 1; i++) {
              if (words[i + 1] === 'hundred' && wordToNumber[words[i]]) {
                const value = wordToNumber[words[i]] * 100;
                state.budget = `$${value}`;
                console.log('[Twilio Webhook] ✅ Extracted word hundred:', state.budget);
                break;
              }
            }
          }
        }
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
