import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import twilio from "twilio";
import OpenAI from "openai";
import { supabase } from "../../../../lib/supabase.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RECEPTIONIST_SYSTEM_PROMPT = `You are a professional, friendly receptionist for Legacy Prime Construction.

YOUR JOB:
1. Greet callers warmly and professionally
2. Understand what they need (use natural conversation, don't interrogate)
3. Collect key information naturally: name, project type, budget, timeline
4. Qualify leads: Good leads have budget > $10,000 and ready to start within 3 months
5. Thank them and promise follow-up

IMPORTANT RULES:
- Keep responses SHORT (1-2 sentences maximum)
- Sound natural and conversational, not robotic
- Ask ONE question at a time
- Let the caller talk
- Don't repeat yourself

PRICING KNOWLEDGE:
You have access to our complete price list. Key items:
- Kitchen cabinets: $320-$502 per linear foot
- Countertops (quartz): $98/SF, solid surface $75/SF
- Bathroom remodel: $12k-$40k depending on size and finishes
- General construction labor: $115-$120/hour
- Project management: $97-$104/hour

When asked about costs, give rough ballpark estimates based on this pricing.

CONVERSATION FLOW:
1. Greeting: "Thank you for calling Legacy Prime Construction, how can I help you today?"
2. Listen to their need
3. Ask about budget (if not mentioned): "What's your budget range for this project?"
4. Ask about timeline (if not mentioned): "When are you looking to get started?"
5. Get their name: "And who am I speaking with?"
6. Closing: "Thank you [name]. We'll have one of our project managers call you back within 24 hours to discuss your [project type]. Have a great day!"

REMEMBER: Sound like a real person, not a robot. Be warm and helpful.`;

interface ConversationState {
  step: number;
  collectedInfo: {
    name: string;
    phone: string;
    projectType: string;
    budget: string;
    timeline: string;
    propertyType: string;
  };
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];
}

function extractInformation(speech: string, state: ConversationState['collectedInfo']) {
  const lowerSpeech = speech.toLowerCase();

  // Extract name
  if (!state.name) {
    const namePatterns = [
      /(?:my name is|i'm|this is|call me|it's|name's)\s+([a-z]+(?:\s+[a-z]+)?)/i,
      /^([a-z]+(?:\s+[a-z]+)?)$/i, // Just a name
      /^(?:yes|yeah|yep|sure|okay|ok)?,?\s*([a-z]+(?:\s+[a-z]+)?)\.?$/i, // "Yes, John" or "Yeah John"
      /([a-z]+(?:\s+[a-z]+)?)\s*(?:here|speaking)\.?$/i, // "John here" or "John speaking"
    ];
    for (const pattern of namePatterns) {
      const match = speech.match(pattern);
      if (match && match[1]) {
        const extractedName = match[1].trim();
        // Filter out common non-names
        const lowercaseName = extractedName.toLowerCase();
        if (!['yes', 'yeah', 'yep', 'sure', 'okay', 'ok', 'hello', 'hi', 'hey'].includes(lowercaseName)
            && extractedName.split(' ').length <= 3) {
          state.name = extractedName;
          console.log('[Receptionist] ✅ Extracted name:', extractedName);
          break;
        }
      }
    }
  }

  // Extract project type
  if (!state.projectType) {
    if (lowerSpeech.match(/kitchen/)) state.projectType = "Kitchen Remodel";
    else if (lowerSpeech.match(/bathroom/)) state.projectType = "Bathroom Remodel";
    else if (lowerSpeech.match(/addition|add|extension|expand/)) state.projectType = "Addition";
    else if (lowerSpeech.match(/roof|roofing/)) state.projectType = "Roofing";
    else if (lowerSpeech.match(/basement/)) state.projectType = "Basement Finishing";
    else if (lowerSpeech.match(/deck|patio/)) state.projectType = "Deck/Patio";
    else if (lowerSpeech.match(/siding|exterior/)) state.projectType = "Exterior Renovation";
    else if (lowerSpeech.match(/window|door/)) state.projectType = "Windows/Doors";
    else if (lowerSpeech.match(/flooring|floor/)) state.projectType = "Flooring";
    else if (lowerSpeech.match(/paint|painting/)) state.projectType = "Painting";
    else if (lowerSpeech.match(/remodel|renovation/)) state.projectType = "General Remodel";
  }

  // Extract budget
  if (!state.budget) {
    const budgetPatterns = [
      /\$?\d{1,3}(?:,\d{3})*(?:\s*thousand)?/i,
      /\d+k/i,
      /(?:around|about|roughly|approximately)\s+\$?\d+/i,
    ];
    for (const pattern of budgetPatterns) {
      const match = speech.match(pattern);
      if (match) {
        state.budget = match[0];
        break;
      }
    }
  }

  // Extract timeline
  if (!state.timeline) {
    if (lowerSpeech.match(/asap|soon|immediately|right away|next week/)) {
      state.timeline = "ASAP";
    } else if (lowerSpeech.match(/(?:next|within|in)\s+(?:a\s+)?month/)) {
      state.timeline = "Within 1 month";
    } else if (lowerSpeech.match(/(?:next|within|in)\s+(?:\d+\s+)?(?:few\s+)?months?/)) {
      state.timeline = "1-3 months";
    } else if (lowerSpeech.match(/this year|later this year/)) {
      state.timeline = "This year";
    } else if (lowerSpeech.match(/next year/)) {
      state.timeline = "Next year";
    }
  }

  // Extract property type
  if (!state.propertyType) {
    if (lowerSpeech.match(/home|house|residential|personal/)) {
      state.propertyType = "Residential";
    } else if (lowerSpeech.match(/commercial|business|office|store|shop/)) {
      state.propertyType = "Commercial";
    }
  }

  return state;
}


export const handleReceptionistCallProcedure = publicProcedure
  .input(
    z.object({
      CallSid: z.string(),
      From: z.string(),
      SpeechResult: z.string().optional(),
      conversationState: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log("[Receptionist] ====== NEW CALL EVENT ======");
      console.log("[Receptionist] CallSid:", input.CallSid);
      console.log("[Receptionist] From:", input.From);
      console.log("[Receptionist] Speech:", input.SpeechResult || "(none - initial call)");
      
      const twiml = new twilio.twiml.VoiceResponse();

      // Initialize or parse conversation state
      let state: ConversationState = {
        step: 0,
        collectedInfo: {
          name: "",
          phone: input.From,
          projectType: "",
          budget: "",
          timeline: "",
          propertyType: "",
        },
        conversationHistory: [],
      };

      if (input.conversationState) {
        try {
          const decoded = Buffer.from(input.conversationState, 'base64').toString();
          state = JSON.parse(decoded);
          console.log("[Receptionist] Restored state:", state);
        } catch (e) {
          console.error("[Receptionist] Failed to parse state:", e);
        }
      }

      // First call (no speech result yet)
      if (state.step === 0 && !input.SpeechResult) {
        const greeting = "Thank you for calling Legacy Prime Construction. How can I help you today?";
        
        state.conversationHistory.push({
          role: 'assistant',
          content: greeting,
        });
        state.step = 1;

        twiml.say({ voice: 'alice' }, greeting);
        
        const gather = twiml.gather({
          input: ['speech'],
          action: `${process.env.EXPO_PUBLIC_API_URL || ''}/api/twilio/receptionist`,
          method: 'POST',
          speechTimeout: 'auto',
          language: 'en-US',
          hints: 'kitchen,bathroom,remodel,addition,roofing,thousand,dollars,budget,month,months',
        });

        const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
        (gather as any).parameter({ name: 'conversationState', value: encodedState });

        console.log("[Receptionist] Sent greeting, waiting for response");
        return {
          success: true,
          twiml: twiml.toString(),
        };
      }

      // Process speech input
      if (input.SpeechResult) {
        console.log("[Receptionist] Processing speech:", input.SpeechResult);
        
        state.conversationHistory.push({
          role: 'user',
          content: input.SpeechResult,
        });

        // Extract information from speech
        state.collectedInfo = extractInformation(input.SpeechResult, state.collectedInfo);
        console.log("[Receptionist] Extracted info:", state.collectedInfo);
      }

      // Check if we have enough information
      const hasName = state.collectedInfo.name.length > 0;
      const hasProjectType = state.collectedInfo.projectType.length > 0;
      const hasBudget = state.collectedInfo.budget.length > 0;
      const hasEnoughInfo = hasName && (hasProjectType || hasBudget);

      console.log("[Receptionist] Info status:", { hasName, hasProjectType, hasBudget, hasEnoughInfo });

      if (hasEnoughInfo) {
        // Generate final response
        const finalPrompt = `The caller has provided enough information. Their details:
Name: ${state.collectedInfo.name}
Project: ${state.collectedInfo.projectType || "Not specified"}
Budget: ${state.collectedInfo.budget || "Not specified"}
Timeline: ${state.collectedInfo.timeline || "Not specified"}

Generate a warm closing message thanking them by name and promising a callback within 24 hours. Keep it under 2 sentences.`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            { role: 'user', content: RECEPTIONIST_SYSTEM_PROMPT + '\n\n' + finalPrompt },
          ],
          temperature: 0.7,
        });
        const closingMessage = completion.choices[0]?.message?.content || "Thank you for calling. We'll be in touch soon.";

        console.log("[Receptionist] Closing message:", closingMessage);
        console.log("[Receptionist] Final lead data:", state.collectedInfo);

        twiml.say({ voice: 'alice' }, closingMessage);
        twiml.pause({ length: 1 });
        twiml.say({ voice: 'alice' }, "Have a great day!");
        twiml.hangup();

        // Save to CRM database
        try {
          console.log("[Receptionist] 💾 Saving lead to CRM...");

          // Get the first company (default company for now)
          const { data: companies, error: companyError } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single();

          if (companyError || !companies) {
            console.error("[Receptionist] ❌ Failed to get company:", companyError);
          } else {
            const companyId = companies.id;

            // Determine lead status based on budget
            const budgetValue = parseInt(state.collectedInfo.budget.replace(/[^0-9]/g, '')) || 0;
            const isQualified = budgetValue >= 10000;

            // Save to clients table
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert({
                company_id: companyId,
                name: state.collectedInfo.name,
                phone: state.collectedInfo.phone,
                email: '', // Not collected in call
                status: isQualified ? 'active-project' : 'lead',
                project_type: state.collectedInfo.projectType || 'General Inquiry',
                budget: state.collectedInfo.budget,
                property_type: state.collectedInfo.propertyType || 'Residential',
                timeline: state.collectedInfo.timeline || 'Not specified',
                source: 'Phone Call (AI Receptionist)',
                notes: `AI Receptionist Call on ${new Date().toLocaleString()}`,
              })
              .select()
              .single();

            if (clientError) {
              console.error("[Receptionist] ❌ Failed to save client:", clientError);
            } else {
              console.log("[Receptionist] ✅ Client saved successfully! ID:", newClient.id);

              // Also save call log
              const { error: callLogError } = await supabase
                .from('call_logs')
                .insert({
                  company_id: companyId,
                  client_id: newClient.id,
                  call_date: new Date().toISOString(),
                  duration: state.step, // Use step count as rough duration
                  outcome: isQualified ? 'Qualified' : 'Info Collected',
                  notes: `Project: ${state.collectedInfo.projectType}\nBudget: ${state.collectedInfo.budget}\nTimeline: ${state.collectedInfo.timeline}`,
                  follow_up_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
                });

              if (callLogError) {
                console.error("[Receptionist] ⚠️ Failed to save call log:", callLogError);
              } else {
                console.log("[Receptionist] ✅ Call log saved successfully!");
              }
            }
          }
        } catch (saveError) {
          console.error("[Receptionist] ❌ Error saving to CRM:", saveError);
          // Don't fail the call if CRM save fails
        }

        return {
          success: true,
          twiml: twiml.toString(),
          leadCaptured: state.collectedInfo,
        };
      }

      // Continue conversation - generate next response
      const conversationContext = state.conversationHistory
        .map(msg => `${msg.role === 'user' ? 'Caller' : 'You'}: ${msg.content}`)
        .join('\n');

      const missingInfo: string[] = [];
      if (!hasName) missingInfo.push("name");
      if (!hasProjectType) missingInfo.push("project type");
      if (!hasBudget) missingInfo.push("budget");

      const nextPrompt = `Based on this conversation:
${conversationContext}

Current information collected:
- Name: ${state.collectedInfo.name || "NOT COLLECTED"}
- Project Type: ${state.collectedInfo.projectType || "NOT COLLECTED"}
- Budget: ${state.collectedInfo.budget || "NOT COLLECTED"}
- Timeline: ${state.collectedInfo.timeline || "optional"}

Missing: ${missingInfo.join(', ')}

Generate the next response. Ask for ONE missing piece of information in a natural way. Keep it SHORT (1 sentence). Don't be repetitive.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: RECEPTIONIST_SYSTEM_PROMPT + '\n\n' + nextPrompt },
        ],
        temperature: 0.7,
      });
      const aiResponse = completion.choices[0]?.message?.content || "Could you tell me more about your project?";

      console.log("[Receptionist] AI Response:", aiResponse);

      state.conversationHistory.push({
        role: 'assistant',
        content: aiResponse,
      });
      state.step++;

      twiml.say({ voice: 'alice' }, aiResponse);
      
      const gather = twiml.gather({
        input: ['speech'],
        action: `${process.env.EXPO_PUBLIC_API_URL || ''}/api/twilio/receptionist`,
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US',
        hints: 'kitchen,bathroom,remodel,addition,roofing,thousand,dollars,budget,month,months',
      });

      const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
      (gather as any).parameter({ name: 'conversationState', value: encodedState });

      return {
        success: true,
        twiml: twiml.toString(),
      };

    } catch (error: any) {
      console.error("[Receptionist] ERROR:", error);
      
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: 'alice' }, 
        "I apologize, but I'm experiencing technical difficulties. Please call back in a few minutes, or leave a message and we'll call you back."
      );
      twiml.hangup();
      
      return {
        success: false,
        twiml: twiml.toString(),
        error: error.message,
      };
    }
  });
