import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";
import twilio from "twilio";
import OpenAI from "openai";
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RECEPTIONIST_SYSTEM_PROMPT = `You are a warm, enthusiastic receptionist for Legacy Prime Construction. Think of yourself as a friendly neighbor helping someone with their home project!

YOUR JOB:
1. Greet callers warmly with genuine excitement for their project
2. Understand what they need through natural, friendly conversation
3. Collect key information naturally: name, project type, budget, timeline
4. Qualify leads: Good leads have budget > $10,000 and ready to start within 3 months
5. Thank them warmly and promise follow-up

IMPORTANT RULES:
- Keep responses SHORT (1-2 sentences maximum)
- Sound warm, enthusiastic, and conversational - use phrases like "That sounds exciting!", "I'd love to help with that!"
- Ask ONE question at a time in a friendly way
- Let the caller talk and really listen
- Don't repeat yourself
- Show genuine interest in their project

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
2. Listen to their need, respond with enthusiasm: "That sounds exciting! I'd love to help you with that."
3. Get their name: "And who am I speaking with?"
4. Ask about budget naturally: "Great! What kind of budget are you working with for this project?"
5. Ask about timeline (if not mentioned): "Perfect! When were you hoping to get started?"
6. Closing: "Wonderful, [name]! I'm excited about your [project type]. One of our project managers will give you a call within 24 hours to discuss the details. Thanks so much for calling!"

REMEMBER: Sound like an enthusiastic friend who's genuinely excited to help. Be warm, upbeat, and make them feel great about their project!`;

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
    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Twilio] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

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

        twiml.say({
          voice: 'Polly.Joanna-Neural',
          language: 'en-US'
        }, greeting);

        const gather = twiml.gather({
          input: ['speech'],
          action: `${process.env.EXPO_PUBLIC_API_URL || ''}/api/twilio/receptionist`,
          method: 'POST',
          speechTimeout: 'auto',
          language: 'en-US',
          speechModel: 'phone_call',
          enhanced: true,
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
      const hasEnoughInfo = hasName && hasProjectType && hasBudget; // Require ALL three

      console.log("[Receptionist] ========================================");
      console.log("[Receptionist] INFO CHECK:");
      console.log("[Receptionist]   - Name:", state.collectedInfo.name || "❌ MISSING");
      console.log("[Receptionist]   - Project:", state.collectedInfo.projectType || "❌ MISSING");
      console.log("[Receptionist]   - Budget:", state.collectedInfo.budget || "❌ MISSING");
      console.log("[Receptionist]   - Has Enough Info?", hasEnoughInfo ? "✅ YES - ENDING CALL" : "❌ NO - CONTINUING");
      console.log("[Receptionist] ========================================");

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

        twiml.say({
          voice: 'Polly.Joanna-Neural',
          language: 'en-US'
        }, closingMessage);
        twiml.pause({ length: 1 });
        twiml.say({
          voice: 'Polly.Joanna-Neural',
          language: 'en-US'
        }, "Have a great day!");
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

              // Format conversation history as readable transcript
              const transcript = state.conversationHistory
                .map(msg => `${msg.role === 'assistant' ? 'AI' : 'Caller'}: ${msg.content}`)
                .join('\n\n');

              // Also save call log with full details
              const { error: callLogError } = await supabase
                .from('call_logs')
                .insert({
                  company_id: companyId,
                  client_id: newClient.id,
                  caller_name: state.collectedInfo.name,
                  caller_phone: state.collectedInfo.phone,
                  call_date: new Date().toISOString(),
                  call_duration: `${state.step} exchanges`,
                  call_type: 'incoming',
                  status: 'answered',
                  is_qualified: isQualified,
                  qualification_score: isQualified ? 80 : 40,
                  notes: `Project: ${state.collectedInfo.projectType}\nBudget: ${state.collectedInfo.budget}\nTimeline: ${state.collectedInfo.timeline}`,
                  transcript: transcript,
                  project_type: state.collectedInfo.projectType || 'General Inquiry',
                  budget: state.collectedInfo.budget,
                  start_date: state.collectedInfo.timeline,
                  property_type: state.collectedInfo.propertyType || 'Residential',
                  added_to_crm: true,
                  scheduled_follow_up: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
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

      // Prioritize what to ask for next
      let nextQuestion = "";
      if (!hasName) {
        nextQuestion = "Ask for their name in a friendly way.";
      } else if (!hasProjectType) {
        nextQuestion = "Ask what type of project they need help with.";
      } else if (!hasBudget) {
        nextQuestion = "Ask about their budget for the project. Be warm and enthusiastic!";
      }

      const nextPrompt = `Based on this conversation:
${conversationContext}

Current information collected:
- Name: ${state.collectedInfo.name || "NOT COLLECTED"}
- Project Type: ${state.collectedInfo.projectType || "NOT COLLECTED"}
- Budget: ${state.collectedInfo.budget || "NOT COLLECTED"}
- Timeline: ${state.collectedInfo.timeline || "optional"}

Missing: ${missingInfo.join(', ')}

NEXT STEP: ${nextQuestion}

Generate a warm, enthusiastic response (1-2 sentences max). Show genuine excitement about helping with their project!`;

      console.log("[Receptionist] 🤖 GENERATING AI RESPONSE...");
      console.log("[Receptionist] Next Question Should Be:", nextQuestion);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'user', content: RECEPTIONIST_SYSTEM_PROMPT + '\n\n' + nextPrompt },
        ],
        temperature: 0.7,
      });
      const aiResponse = completion.choices[0]?.message?.content || "Could you tell me more about your project?";

      console.log("[Receptionist] 🤖 AI WILL SAY:", aiResponse);

      state.conversationHistory.push({
        role: 'assistant',
        content: aiResponse,
      });
      state.step++;

      twiml.say({
        voice: 'Polly.Joanna-Neural',
        language: 'en-US'
      }, aiResponse);

      const gather = twiml.gather({
        input: ['speech'],
        action: `${process.env.EXPO_PUBLIC_API_URL || ''}/api/twilio/receptionist`,
        method: 'POST',
        speechTimeout: 'auto',
        language: 'en-US',
        speechModel: 'phone_call',
        enhanced: true,
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
      twiml.say({
        voice: 'Polly.Joanna-Neural',
        language: 'en-US'
      }, "I apologize, but I'm experiencing technical difficulties. Please call back in a few minutes, or leave a message and we'll call you back.");
      twiml.hangup();
      
      return {
        success: false,
        twiml: twiml.toString(),
        error: error.message,
      };
    }
  });
