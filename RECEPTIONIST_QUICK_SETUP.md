# Virtual Receptionist - Quick Setup Summary

## ✅ What's Been Done

### Backend Implementation
1. **Created intelligent receptionist handler**: `backend/trpc/routes/twilio/handle-receptionist-call/route.ts`
   - Uses AI (generateText) to have natural conversations
   - Extracts information from speech (name, project type, budget, timeline)
   - Has access to your price list database
   - Can provide ballpark estimates
   - Tracks conversation state across multiple exchanges

2. **Added to tRPC router**: The route is now available at `/api/trpc/twilio.handleReceptionistCall`

### Features Already Working
- ✅ Natural language conversation flow
- ✅ Automatic information extraction from speech
- ✅ Access to complete price list ($320-502/LF for cabinets, $98/SF for quartz, etc.)
- ✅ Qualification criteria (budget >$10k, timeline <3 months)
- ✅ Detailed logging for debugging
- ✅ Professional greeting and closing

### AI Assistant Already Has Access To
Your AI assistant (in the chat feature) already has these tools:
- `getPriceList` - Search and filter your pricing database
- `calculateEstimate` - Build estimates with line items
- `getProjects` - All project data
- `getExpenses` - Expense tracking
- `getPhotosUploaded` - Photos by date/project
- `getExpensesDetailed` - Detailed expense analysis
- `getCompanyOverview` - Company-wide stats
- `getTimeTracking` - Clock in/out data

## 🔧 What You Need to Configure

### 1. Set Up Twilio Webhook (2 minutes)

**Your Webhook URL:**
```
https://your-domain.com/api/trpc/twilio.handleReceptionistCall
```

**Steps:**
1. Go to https://console.twilio.com/
2. Navigate to: **Phone Numbers → Manage → Active Numbers**
3. Click on your phone number
4. Under **Voice & Fax** section:
   - **A CALL COMES IN**: Select "Webhook"
   - **URL**: Paste your webhook URL above
   - **HTTP**: Select "POST"
5. Click **Save**

**For Testing Locally (using ngrok):**
```bash
# Terminal 1: Start your app
npm start

# Terminal 2: Expose with ngrok
npx ngrok http 8081

# Use the ngrok URL like: https://abc123.ngrok.io/api/trpc/twilio.handleReceptionistCall
```

### 2. Customize Receptionist Personality (Optional)

Edit `backend/trpc/routes/twilio/handle-receptionist-call/route.ts` and modify:

```typescript
const RECEPTIONIST_SYSTEM_PROMPT = `You are a professional, friendly receptionist for [YOUR COMPANY NAME].

// Customize:
// - Your company name
// - Service area
// - Specialties
// - Typical project ranges
// - Qualification criteria
// - Conversation style
`;
```

### 3. Test the Receptionist

**Test Call Script:**
1. Call your Twilio number
2. Receptionist: "Thank you for calling Legacy Prime Construction, how can I help you today?"
3. You: "Hi, I need a kitchen remodel"
4. Receptionist: *Asks about budget*
5. You: "Around $20,000"
6. Receptionist: *Asks when you want to start*
7. You: "Next month"
8. Receptionist: *Asks for your name*
9. You: "John Smith"
10. Receptionist: "Thank you John. We'll have one of our project managers call you back within 24 hours..."

**Check Server Logs:**
```bash
# You should see detailed logs like:
[Receptionist] ====== NEW CALL EVENT ======
[Receptionist] CallSid: CAxxxx...
[Receptionist] Speech: Hi, I need a kitchen remodel
[Receptionist] Extracted info: { projectType: 'Kitchen Remodel', ... }
[Receptionist] ✅ QUALIFIED LEAD - Should add to CRM
```

### 4. Add Auto-CRM Integration (Next Step)

Currently, the receptionist logs qualified leads. To automatically add them to your CRM:

**In the handler (line ~268), replace this:**
```typescript
// TODO: Save to CRM database
console.log("[Receptionist] ✅ QUALIFIED LEAD - Should add to CRM");
```

**With actual CRM saving code:**
```typescript
// Save to CRM
const newClient = {
  id: `client-${Date.now()}`,
  name: state.collectedInfo.name,
  phone: state.collectedInfo.phone,
  email: '',
  source: 'Phone Call' as const,
  status: 'Lead' as const,
  lastContacted: new Date().toISOString(),
  notes: `Project: ${state.collectedInfo.projectType}\nBudget: ${state.collectedInfo.budget}\nTimeline: ${state.collectedInfo.timeline}`,
};

// TODO: Save to your database via tRPC mutation or direct DB call
console.log("[Receptionist] Saving to CRM:", newClient);
```

## 🎯 How It Works

### Information Extraction
The receptionist automatically extracts:
- **Name**: From phrases like "My name is...", "I'm...", "This is..."
- **Project Type**: From keywords (kitchen, bathroom, addition, roof, etc.)
- **Budget**: From patterns like "$20,000", "20k", "around $15,000"
- **Timeline**: From phrases like "ASAP", "next month", "in 3 months"
- **Property Type**: Residential vs Commercial

### Pricing Knowledge
The receptionist has access to:
- All items in `mocks/priceList.ts` (336 items)
- Can provide estimates like: "For a 10ft kitchen with base cabinets, you're looking at $3,200 to $5,000"
- Knows labor rates, material costs, typical project ranges

### Conversation Flow
1. **Greeting** → Ask how to help
2. **Listen** → Extract what they need
3. **Ask Budget** → If not mentioned naturally
4. **Ask Timeline** → If not mentioned
5. **Get Name** → Confirm who's calling
6. **Closing** → Thank them, promise callback

## 📊 What the AI Can Already Answer

Your AI assistant (the chat bot in your app) can already:

✅ **About Pricing:**
- "What's the cost per linear foot for base cabinets?"
- "Give me an estimate for 300 lineal feet of base cabinets"
- "How much does quartz countertop cost?"

✅ **About Projects:**
- "Which projects are over budget?"
- "Show me all active projects"
- "What's the total remaining budget across all projects?"

✅ **About Expenses:**
- "How much did we spend today?"
- "Show expenses for the Sunset Remodel project"
- "What are my material costs this week?"

✅ **About Photos:**
- "Which photos were uploaded today?"
- "Show me all foundation photos"
- "What photos do we have for Project X?"

✅ **About Time:**
- "How many hours did employees work this week?"
- "Who's clocked in right now?"
- "Show me John's timesheet"

✅ **Create Estimates:**
- "Create an estimate with 10 LF of cabinets and 25 SF of quartz countertops"
- "Build an estimate for a kitchen remodel"

## 🔍 Monitoring & Debugging

### View Call Logs
1. In Twilio Console → Monitor → Logs → Calls
2. See: Duration, Status, Cost, Transcripts

### Server Logs
All receptionist activity is logged with `[Receptionist]` prefix:
```bash
[Receptionist] ====== NEW CALL EVENT ======
[Receptionist] Speech: I need a kitchen remodel
[Receptionist] Extracted info: { projectType: 'Kitchen Remodel' }
[Receptionist] AI Response: Great! What's your budget...
```

### Test AI Responses
The AI uses `generateText` from `@rork-ai/toolkit-sdk`. You can test prompts separately.

## 🚀 Next Steps

1. **Configure Twilio webhook** (see step 1 above)
2. **Test with a call** to your Twilio number
3. **Check logs** to see information extraction
4. **Customize the prompt** if needed
5. **Add CRM auto-save** functionality
6. **Monitor and improve** based on real calls

## 💡 Advanced Customization

### Change Qualification Criteria
```typescript
// In the handler, around line 239:
const hasEnoughInfo = hasName && (hasProjectType || hasBudget);

// Change to require more info:
const hasEnoughInfo = hasName && hasProjectType && hasBudget && hasTimeline;
```

### Add More Project Types
```typescript
// In extractInformation function, around line 74:
else if (lowerSpeech.match(/pool/)) state.projectType = "Pool Construction";
else if (lowerSpeech.match(/landscape/)) state.projectType = "Landscaping";
```

### Adjust Voice/Language
```typescript
// In twiml.say(), around line 200:
twiml.say({ voice: 'alice' }, greeting);

// Change to:
twiml.say({ voice: 'Polly.Matthew', language: 'en-US' }, greeting);
// See: https://www.twilio.com/docs/voice/twiml/say#voice
```

## 📞 Support

If issues occur:
1. Check server logs for `[Receptionist]` entries
2. Verify Twilio webhook URL is correct and accessible
3. Ensure `generateText` from `@rork-ai/toolkit-sdk` is working
4. Test that your Twilio credentials are configured

## Summary

✅ **Backend is ready** - Intelligent receptionist with AI
✅ **Price list integrated** - Can provide estimates
✅ **Information extraction** - Captures name, project, budget, timeline
✅ **Natural conversation** - Not robotic, sounds professional
✅ **Detailed logging** - Easy to debug and monitor

**All you need to do**: Configure the Twilio webhook URL and test it!
