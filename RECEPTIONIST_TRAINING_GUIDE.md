# Virtual Receptionist Training Guide

## Overview
This guide explains how to train your Twilio virtual receptionist to qualify customers and integrate with your business data.

## Current State
Your app already has:
- ✅ Twilio API integrated (backend routes for calls, SMS, virtual assistant)
- ✅ AI Assistant with access to price lists, projects, expenses, photos, etc.
- ✅ CRM system for managing leads

## What You Need to Do

### 1. Create an AI-Powered Webhook for the Receptionist

The current `create-virtual-assistant` endpoint generates basic TwiML. To make it intelligent and access your data, you need to create a webhook that uses AI.

#### Create the webhook route:
**File: `backend/trpc/routes/twilio/handle-receptionist/route.ts`**

```typescript
import { z } from "zod";
import { publicProcedure } from "../../../create-context";
import twilio from "twilio";
import { generateText } from "@rork-ai/toolkit-sdk";

const RECEPTIONIST_SYSTEM_PROMPT = `You are a professional receptionist for Legacy Prime Construction company.

Your job is to:
1. Greet callers warmly and professionally
2. Ask qualifying questions to determine if they are a serious lead
3. Collect their information (name, phone, project type, budget, timeline)
4. Be conversational and friendly, not robotic
5. If they are qualified (budget > $10k, ready in 3 months), tell them someone will call back

QUALIFYING QUESTIONS TO ASK:
- What type of construction project are you interested in?
- What is your estimated budget for this project?
- When are you looking to start?
- Is this residential or commercial?
- Can I get your name and best phone number?

After collecting info, summarize and thank them. Say: "Thank you [name], we've recorded your information. One of our project managers will contact you within 24 hours to discuss your [project type] project. Have a great day!"

Keep responses SHORT (1-2 sentences max). Let the caller talk.`;

export const handleReceptionistProcedure = publicProcedure
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
      console.log("[Receptionist] Call received:", input.CallSid);
      console.log("[Receptionist] From:", input.From);
      console.log("[Receptionist] Speech:", input.SpeechResult);
      
      const twiml = new twilio.twiml.VoiceResponse();

      // Parse conversation state
      let state = {
        step: 0,
        name: "",
        phone: input.From,
        projectType: "",
        budget: "",
        timeline: "",
        propertyType: "",
      };

      if (input.conversationState) {
        try {
          state = JSON.parse(Buffer.from(input.conversationState, 'base64').toString());
        } catch (e) {
          console.error("[Receptionist] Failed to parse state:", e);
        }
      }

      // Build conversation history for AI
      const conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
      
      if (state.step > 0) {
        conversationHistory.push({
          role: 'assistant',
          content: 'Hello, thank you for calling Legacy Prime Construction. How can I help you today?'
        });
      }

      if (input.SpeechResult) {
        conversationHistory.push({
          role: 'user',
          content: input.SpeechResult
        });
      }

      // Use AI to generate response
      const aiResponse = await generateText({
        messages: [
          { role: 'system' as const, content: RECEPTIONIST_SYSTEM_PROMPT },
          ...conversationHistory.map(m => ({ role: m.role, content: m.content }))
        ]
      });

      console.log("[Receptionist] AI Response:", aiResponse);

      // Extract information from the conversation
      if (input.SpeechResult) {
        const lowerSpeech = input.SpeechResult.toLowerCase();
        
        // Extract name
        if (!state.name && (lowerSpeech.includes("my name is") || lowerSpeech.includes("i'm") || lowerSpeech.includes("this is"))) {
          const nameMatch = lowerSpeech.match(/(?:my name is|i'm|this is)\s+([a-z]+(?:\s+[a-z]+)?)/i);
          if (nameMatch) state.name = nameMatch[1];
        }

        // Extract project type
        if (lowerSpeech.includes("kitchen") || lowerSpeech.includes("remodel")) {
          state.projectType = "Kitchen Remodel";
        } else if (lowerSpeech.includes("bathroom")) {
          state.projectType = "Bathroom Remodel";
        } else if (lowerSpeech.includes("addition") || lowerSpeech.includes("add")) {
          state.projectType = "Addition";
        } else if (lowerSpeech.includes("roof")) {
          state.projectType = "Roofing";
        }

        // Extract budget
        if (lowerSpeech.match(/\$?\d{1,3}(?:,?\d{3})*(?:\s*thousand|\s*k)?/)) {
          state.budget = input.SpeechResult.match(/\$?\d{1,3}(?:,?\d{3})*(?:\s*thousand|\s*k)?/)?.[0] || "";
        }

        // Extract timeline
        if (lowerSpeech.includes("next week") || lowerSpeech.includes("asap") || lowerSpeech.includes("soon")) {
          state.timeline = "ASAP";
        } else if (lowerSpeech.includes("month")) {
          state.timeline = "1-3 months";
        }

        // Extract property type
        if (lowerSpeech.includes("home") || lowerSpeech.includes("house") || lowerSpeech.includes("residential")) {
          state.propertyType = "Residential";
        } else if (lowerSpeech.includes("commercial") || lowerSpeech.includes("business")) {
          state.propertyType = "Commercial";
        }
      }

      state.step++;

      // Check if we have enough info to end the call
      const hasEnoughInfo = state.name && state.projectType && state.budget;

      if (hasEnoughInfo) {
        // Final message
        twiml.say({ voice: 'alice' }, aiResponse);
        
        // TODO: Add to CRM here
        console.log("[Receptionist] Lead captured:", state);
        
        // Hang up
        twiml.hangup();
      } else {
        // Continue conversation
        twiml.say({ voice: 'alice' }, aiResponse);
        
        const gather = twiml.gather({
          input: ['speech'],
          action: '/api/trpc/twilio.handleReceptionist',
          method: 'POST',
          speechTimeout: 'auto',
          language: 'en-US',
        });

        // Pass state forward
        const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');
        gather.say({ voice: 'alice' }, `<!-- ${encodedState} -->`);
      }

      return {
        success: true,
        twiml: twiml.toString(),
      };
    } catch (error: any) {
      console.error("[Receptionist] Error:", error);
      
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: 'alice' }, 
        "I apologize, but I'm experiencing technical difficulties. Please call back in a few minutes."
      );
      
      return {
        success: false,
        twiml: twiml.toString(),
        error: error.message,
      };
    }
  });
```

#### Add to router:
**File: `backend/trpc/app-router.ts`**

```typescript
import { handleReceptionistProcedure } from './routes/twilio/handle-receptionist/route';

export const appRouter = router({
  // ... existing routes
  twilio: router({
    // ... existing twilio routes
    handleReceptionist: handleReceptionistProcedure,
  }),
});
```

### 2. Configure Twilio to Use the Webhook

1. Go to Twilio Console → Phone Numbers → Your Number
2. Under "Voice & Fax", set:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://your-domain.com/api/trpc/twilio.handleReceptionist`
   - **HTTP**: POST

### 3. Customize the Receptionist Instructions

In the code above, modify `RECEPTIONIST_SYSTEM_PROMPT` to match your business:

```typescript
const RECEPTIONIST_SYSTEM_PROMPT = `You are a professional receptionist for [YOUR COMPANY NAME].

Your job is to:
1. Greet callers warmly
2. Ask these specific questions:
   - [Your custom question 1]
   - [Your custom question 2]
   - etc.
3. Qualify leads based on: [Your criteria]

YOUR COMPANY INFO:
- Specialties: [Kitchen remodels, additions, etc.]
- Service area: [Your city/region]
- Typical project range: $[min] - $[max]
- Lead time: [Your typical timeline]

PRICE LIST ACCESS:
You have access to pricing for:
- Base cabinets: $320/LF (avg grade), $502/LF (premium)
- Countertops: Quartz $98/SF, Solid surface $75/SF
- [Add your key items here]

When asked for estimates, use this pricing to give rough ballpark ranges.

Example: "For a typical 10ft kitchen with base cabinets, you're looking at roughly $3,200 to $5,000 for cabinets alone, depending on grade."

Keep responses SHORT (1-2 sentences). Be conversational.`;
```

### 4. Give AI Access to Your Data

The AI assistant already has these tools (from `GlobalAIChatSimple.tsx`):
- `getPriceList` - Access to all your pricing
- `getProjects` - Current projects
- `getExpenses` - Expense data
- `getPhotosUploaded` - Photos by date/project
- `getCompanyOverview` - Overall stats

To use these in the receptionist, modify the handler:

```typescript
// In handle-receptionist/route.ts
import { masterPriceList } from '@/mocks/priceList';

// Add context to AI
const contextInfo = `
AVAILABLE PRICING (abbreviated):
${masterPriceList
  .filter(item => 
    item.category === 'Kitchen' || 
    item.category === 'Bathroom' ||
    item.category === 'Pre-Construction'
  )
  .slice(0, 20) // First 20 items
  .map(item => `- ${item.name}: $${item.unitPrice}/${item.unit}`)
  .join('\n')}

When caller asks about pricing, reference these costs.
`;

const aiResponse = await generateText({
  messages: [
    { role: 'system', content: RECEPTIONIST_SYSTEM_PROMPT + '\n\n' + contextInfo },
    ...conversationHistory
  ]
});
```

### 5. Automatically Add Qualified Leads to CRM

Add this function to save leads:

```typescript
// In handle-receptionist/route.ts

async function addLeadToCRM(leadInfo: typeof state) {
  // Parse budget to number
  const budgetStr = leadInfo.budget.replace(/[$,k]/gi, '');
  const budgetNum = parseInt(budgetStr) * (leadInfo.budget.toLowerCase().includes('k') ? 1000 : 1);
  
  const isQualified = budgetNum > 10000 && 
                     (leadInfo.timeline === 'ASAP' || leadInfo.timeline === '1-3 months');
  
  // Save to your CRM (you'll need to implement this)
  const newClient = {
    id: `client-${Date.now()}`,
    name: leadInfo.name,
    phone: leadInfo.phone,
    email: '', // Not collected via phone
    source: 'Phone Call' as const,
    status: isQualified ? 'Lead' as const : 'Lead' as const,
    lastContacted: new Date().toISOString(),
    notes: `Project: ${leadInfo.projectType}\nBudget: ${leadInfo.budget}\nTimeline: ${leadInfo.timeline}\nProperty: ${leadInfo.propertyType}`,
  };
  
  console.log('[Receptionist] Lead to add to CRM:', newClient);
  // TODO: Save to database via tRPC mutation
  
  return newClient;
}

// Use it in the handler when hasEnoughInfo:
if (hasEnoughInfo) {
  await addLeadToCRM(state);
  // ... rest of code
}
```

### 6. Testing the Receptionist

#### Test Script:
1. Call your Twilio number
2. Say: "Hi, I need a kitchen remodel"
3. When asked about budget, say: "Around $20,000"
4. When asked about timeline, say: "I want to start next month"
5. When asked for name, say: "My name is John Smith"
6. The receptionist should summarize and end the call

#### Check the logs:
```bash
# In your terminal where the server runs
# You should see:
[Receptionist] Call received: CAxxxx...
[Receptionist] Speech: Hi, I need a kitchen remodel
[Receptionist] AI Response: Great! What's your estimated budget...
[Receptionist] Lead captured: { name: 'John Smith', ... }
```

## Advanced: Voice-to-Text for Better Understanding

For better accuracy, use Twilio's built-in speech recognition with custom hints:

```typescript
const gather = twiml.gather({
  input: ['speech'],
  action: '/api/trpc/twilio.handleReceptionist',
  speechModel: 'phone_call',
  enhanced: true,
  hints: 'kitchen,bathroom,remodel,addition,roofing,thousand,dollars,budget',
  language: 'en-US',
});
```

## Pricing Examples to Train With

Add these to your system prompt so AI knows how to estimate:

```
PRICING QUICK REFERENCE:
Kitchen Remodel (avg 10ft x 10ft):
- Base cabinets: $3,200 - $5,000
- Countertops (quartz): $2,000 - $2,500
- Installation/labor: $5,000 - $8,000
- Total range: $15,000 - $30,000

Bathroom Remodel:
- Standard (5x8): $12,000 - $18,000
- Luxury: $25,000 - $40,000

Additions:
- Per square foot: $200 - $400/SF
```

## Monitoring & Improving

1. **Review Call Logs in CRM**
   - Check which calls converted to leads
   - Listen to recordings (enable in Twilio)

2. **Adjust Qualification Criteria**
   - Modify budget thresholds
   - Change timeline requirements
   - Update property type filters

3. **Improve AI Responses**
   - Add more examples to system prompt
   - Fine-tune based on actual calls
   - Add specific responses for common questions

## Troubleshooting

### Issue: AI gives too long responses
**Fix**: Add to system prompt: "Keep ALL responses to maximum 2 sentences. Be brief."

### Issue: Not capturing information correctly
**Fix**: Add explicit extraction patterns:
```typescript
if (lowerSpeech.match(/my (?:name is|name's) ([a-z\s]+)/i)) {
  state.name = RegExp.$1.trim();
}
```

### Issue: Call drops unexpectedly
**Fix**: Increase `speechTimeout`:
```typescript
speechTimeout: '5' // 5 seconds instead of 'auto'
```

## Next Steps

1. ✅ Create the webhook handler
2. ✅ Configure Twilio webhook URL
3. ✅ Customize system prompt with your business info
4. ✅ Add price list context
5. ✅ Implement CRM auto-add
6. ✅ Test with real calls
7. ✅ Monitor and improve

Your receptionist will now:
- Answer calls professionally
- Qualify customers based on your criteria
- Have access to your pricing to give estimates
- Automatically add good leads to CRM
- Save you time on initial screening calls
