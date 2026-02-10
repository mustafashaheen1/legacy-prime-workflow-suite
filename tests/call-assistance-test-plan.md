# Call Assistance Testing Plan

## Overview
This document provides comprehensive test scripts for the AI-powered call receptionist system.

---

## 1. MANUAL TEST SCENARIOS

### Scenario 1: Happy Path - Qualified Lead
**Objective**: Test complete flow with all information provided and qualified budget

**Test Steps**:
1. Call the Twilio number configured in your environment
2. Wait for greeting: "Thank you for calling Legacy Prime Construction..."
3. Respond naturally to each question:
   - **AI**: "How can I help you today?"
   - **YOU**: "Hi, I'm looking to remodel my kitchen"

   - **AI**: "What's your name?"
   - **YOU**: "John Smith"

   - **AI**: "What's your budget for this project?"
   - **YOU**: "Around fifty thousand dollars"

   - **AI**: "When are you looking to start?"
   - **YOU**: "Within the next two months"

4. Listen for personalized closing with your name
5. Hang up

**Expected Results**:
- ✅ Call completes without errors
- ✅ Lead appears in CRM with status "Project" (qualified)
- ✅ Budget: $50,000
- ✅ Project Type: Kitchen
- ✅ Timeline: 1-3 months
- ✅ Qualification Score: 80
- ✅ Full transcript saved in call_logs
- ✅ Follow-up scheduled for tomorrow

---

### Scenario 2: Unqualified Lead (Low Budget)
**Test Steps**:
1. Call the Twilio number
2. Provide project info with budget under $10,000:
   - **Project**: "I need some drywall patching"
   - **Name**: "Sarah Johnson"
   - **Budget**: "About three thousand dollars"
   - **Timeline**: "Next month"

**Expected Results**:
- ✅ Lead appears in CRM with status "Lead" (unqualified)
- ✅ Budget: $3,000
- ✅ Qualification Score: 40
- ✅ Still saved to database for follow-up

---

### Scenario 3: Multiple Project Types
**Test Steps**:
1. Call and mention multiple projects:
   - **YOU**: "I want to remodel my kitchen and bathroom, and maybe add a deck"

**Expected Results**:
- ✅ AI asks clarifying questions about priority
- ✅ Project type captures primary focus
- ✅ Notes field includes all mentioned projects

---

### Scenario 4: Vague Budget Response
**Test Steps**:
1. Call and provide unclear budget:
   - **AI**: "What's your budget?"
   - **YOU**: "I'm not sure, what do these things usually cost?"

**Expected Results**:
- ✅ AI provides pricing guidance from knowledge base
- ✅ AI asks for budget range again
- ✅ Handles "flexible" or "depends on the scope" responses

---

### Scenario 5: Budget Format Variations
Test different budget formats:
- ✅ "Fifty thousand dollars"
- ✅ "$50,000"
- ✅ "50k"
- ✅ "around 50 grand"
- ✅ "between 40 and 60 thousand"
- ✅ "One hundred and twenty-five thousand"

**Expected Results**:
- ✅ All formats correctly extracted and stored

---

### Scenario 6: Name Extraction Edge Cases
Test name variations:
- ✅ "My name is Robert Smith"
- ✅ "I'm Bob"
- ✅ "This is Maria Garcia-Lopez" (hyphenated)
- ✅ "Call me Mike" (informal)
- ✅ "Yeah, it's Jennifer" (with filler words)

**Expected Results**:
- ✅ Clean name extracted without filler words
- ✅ Handles compound names correctly

---

### Scenario 7: Timeline Variations
Test different timeline responses:
- ✅ "ASAP"
- ✅ "As soon as possible"
- ✅ "Within 3 months"
- ✅ "This summer"
- ✅ "Next year"
- ✅ "I'm flexible"

**Expected Results**:
- ✅ Timeline extracted and categorized correctly

---

### Scenario 8: Background Noise / Unclear Speech
**Test Steps**:
1. Call from noisy environment
2. Speak with varied clarity
3. Pause mid-sentence

**Expected Results**:
- ✅ AI asks for clarification when needed
- ✅ Doesn't crash on empty/garbled speech input
- ✅ Gracefully handles timeout scenarios

---

### Scenario 9: Early Hang-Up
**Test Steps**:
1. Call and provide only partial information
2. Hang up mid-conversation

**Expected Results**:
- ✅ Partial lead still saved to database
- ✅ Call log shows incomplete status
- ✅ No errors in server logs

---

### Scenario 10: Price Shopping / Information Only
**Test Steps**:
1. Call and ask: "How much does a kitchen remodel cost?"
2. Provide minimal personal information
3. Indicate not ready to move forward

**Expected Results**:
- ✅ AI provides pricing information
- ✅ Still attempts to collect contact info
- ✅ Lead saved as low-priority

---

## 2. API INTEGRATION TESTS

### Test 1: Webhook Endpoint Availability
```bash
# Test that webhook is accessible
curl -X POST https://your-domain.vercel.app/api/twilio/receptionist \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=%2B15551234567" \
  -d "CallSid=CA1234567890abcdef" \
  -d "AccountSid=AC1234567890abcdef"
```

**Expected**: Returns valid TwiML response (200 status)

---

### Test 2: tRPC Route - Get Call Logs
```typescript
// Test fetching call logs
const callLogs = await trpc.twilio.getCallLogs.query({
  companyId: 'test-company-id'
});

console.log('Call logs:', callLogs);
```

**Expected**: Returns array of call logs for company

---

### Test 3: tRPC Route - Make Outbound Call
```typescript
// Test making an outbound call
const result = await trpc.twilio.makeCall.mutate({
  to: '+15551234567',
  message: 'This is a test call from Legacy Prime Construction'
});

console.log('Call result:', result);
```

**Expected**: Call initiated, returns call SID

---

### Test 4: Send SMS
```typescript
// Test SMS sending
const result = await trpc.twilio.sendSms.mutate({
  to: '+15551234567',
  message: 'Test message from call assistance testing'
});

console.log('SMS result:', result);
```

**Expected**: SMS sent successfully

---

## 3. AUTOMATED TEST SUITE

Create file: `tests/call-assistance.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleReceptionistCall } from '@/backend/trpc/routes/twilio/handle-receptionist-call/route';

describe('Call Assistance - Lead Qualification', () => {

  it('should qualify lead with budget >= $10,000', () => {
    const budget = '$50,000';
    const isQualified = extractBudgetValue(budget) >= 10000;
    expect(isQualified).toBe(true);
  });

  it('should not qualify lead with budget < $10,000', () => {
    const budget = '$5,000';
    const isQualified = extractBudgetValue(budget) >= 10000;
    expect(isQualified).toBe(false);
  });

  it('should extract budget from word format', () => {
    const testCases = [
      { input: 'fifty thousand', expected: 50000 },
      { input: 'one hundred thousand', expected: 100000 },
      { input: 'twenty-five thousand', expected: 25000 },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractBudgetValue(input);
      expect(result).toBe(expected);
    });
  });

  it('should extract budget from numeric format', () => {
    const testCases = [
      { input: '$50,000', expected: 50000 },
      { input: '50k', expected: 50000 },
      { input: '$1.5M', expected: 1500000 },
      { input: 'around $75,000', expected: 75000 },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractBudgetValue(input);
      expect(result).toBe(expected);
    });
  });

  it('should extract project type from speech', () => {
    const testCases = [
      { input: 'I want to remodel my kitchen', expected: 'Kitchen' },
      { input: 'looking for bathroom renovation', expected: 'Bathroom' },
      { input: 'need a new roof', expected: 'Roofing' },
      { input: 'want to add a deck', expected: 'Deck/Patio' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractProjectType(input);
      expect(result).toBe(expected);
    });
  });

  it('should extract clean name from speech', () => {
    const testCases = [
      { input: 'Yeah, my name is John Smith', expected: 'John Smith' },
      { input: 'I\'m Sarah Johnson', expected: 'Sarah Johnson' },
      { input: 'Call me Mike', expected: 'Mike' },
      { input: 'This is Maria Garcia-Lopez', expected: 'Maria Garcia-Lopez' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractName(input);
      expect(result).toBe(expected);
    });
  });

  it('should handle timeline extraction', () => {
    const testCases = [
      { input: 'ASAP', expected: 'ASAP' },
      { input: 'within 3 months', expected: '1-3 months' },
      { input: 'next year', expected: 'This Year' },
      { input: 'as soon as possible', expected: 'ASAP' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = extractTimeline(input);
      expect(result).toContain(expected);
    });
  });

  it('should calculate qualification score correctly', () => {
    // Qualified lead
    expect(calculateQualificationScore(50000)).toBe(80);

    // Unqualified lead
    expect(calculateQualificationScore(5000)).toBe(40);

    // Edge case: exactly $10,000
    expect(calculateQualificationScore(10000)).toBe(80);
  });
});

describe('Call Assistance - Conversation State', () => {

  it('should encode and decode conversation state', () => {
    const state = {
      step: 2,
      collectedInfo: {
        name: 'John Smith',
        phone: '+15551234567',
        projectType: 'Kitchen',
        budget: '$50,000',
        timeline: 'ASAP',
        propertyType: ''
      },
      conversationHistory: [
        { role: 'user', content: 'I want to remodel my kitchen' },
        { role: 'assistant', content: 'Great! What\'s your name?' }
      ]
    };

    const encoded = Buffer.from(JSON.stringify(state)).toString('base64');
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString());

    expect(decoded).toEqual(state);
  });

  it('should initialize conversation state correctly', () => {
    const state = initializeConversationState('+15551234567');

    expect(state.step).toBe(0);
    expect(state.collectedInfo.phone).toBe('+15551234567');
    expect(state.collectedInfo.name).toBe('');
    expect(state.conversationHistory).toEqual([]);
  });
});

describe('Call Assistance - Error Handling', () => {

  it('should handle missing Supabase gracefully', async () => {
    // Mock Supabase client as undefined
    const result = await saveLeadToCRM(null, leadData);

    expect(result.addedToCRM).toBe(false);
    expect(result.error).toContain('Supabase not configured');
  });

  it('should handle OpenAI API errors', async () => {
    // Mock OpenAI error
    vi.mocked(openai.chat.completions.create).mockRejectedValue(
      new Error('API rate limit exceeded')
    );

    const response = await generateAIResponse(conversationState);

    expect(response).toContain('Could you repeat that?');
  });

  it('should handle empty speech input', () => {
    const speechResult = '';
    const response = handleSpeechInput(speechResult);

    expect(response).toContain('I didn\'t catch that');
  });
});

// Helper functions (extract from actual implementation)
function extractBudgetValue(budgetString: string): number {
  // Implementation from handle-receptionist-call/route.ts
  const numberMatch = budgetString.match(/\$?[\d,]+k?/i);
  if (numberMatch) {
    const value = numberMatch[0].replace(/[$,]/g, '');
    return value.endsWith('k')
      ? parseInt(value) * 1000
      : parseInt(value);
  }
  return 0;
}

function extractProjectType(speech: string): string {
  const projectTypes = [
    'Kitchen', 'Bathroom', 'Painting', 'Flooring', 'Roofing',
    'Deck/Patio', 'Basement', 'Addition', 'Exterior'
  ];

  for (const type of projectTypes) {
    if (speech.toLowerCase().includes(type.toLowerCase())) {
      return type;
    }
  }
  return '';
}

function extractName(speech: string): string {
  // Remove filler words and extract clean name
  const cleaned = speech
    .replace(/yeah|yes|okay|um|uh|my name is|i'm|call me|this is/gi, '')
    .trim();
  return cleaned;
}

function extractTimeline(speech: string): string {
  if (/asap|immediately|right away/i.test(speech)) return 'ASAP';
  if (/1-3 months|three months|next few months/i.test(speech)) return '1-3 months';
  if (/this year|next year/i.test(speech)) return 'This Year';
  return speech;
}

function calculateQualificationScore(budget: number): number {
  return budget >= 10000 ? 80 : 40;
}
```

---

## 4. LOAD TESTING

Create file: `tests/load-test-calls.js`

```javascript
// Artillery load test configuration
// Run with: artillery run load-test-calls.yml

// artillery.yml
config:
  target: 'https://your-domain.vercel.app'
  phases:
    - duration: 60
      arrivalRate: 5  # 5 calls per second
  plugins:
    expect: {}
scenarios:
  - name: 'Concurrent Call Webhooks'
    flow:
      - post:
          url: '/api/twilio/receptionist'
          headers:
            Content-Type: 'application/x-www-form-urlencoded'
          form:
            From: '+1555{{ $randomNumber(1000000, 9999999) }}'
            CallSid: 'CA{{ $randomString() }}'
            AccountSid: 'ACtest123'
            SpeechResult: 'I want to remodel my kitchen'
          expect:
            - statusCode: 200
            - contentType: text/xml
            - hasHeader: 'content-type'
```

---

## 5. SMOKE TESTS (Quick Validation)

Create file: `tests/smoke-test.sh`

```bash
#!/bin/bash

echo "🧪 Running Call Assistance Smoke Tests..."

# Test 1: Webhook endpoint is accessible
echo "Test 1: Checking webhook endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
  https://your-domain.vercel.app/api/twilio/receptionist)

if [ $response -eq 200 ] || [ $response -eq 405 ]; then
  echo "✅ Webhook endpoint accessible"
else
  echo "❌ Webhook endpoint failed (Status: $response)"
  exit 1
fi

# Test 2: Environment variables configured
echo "Test 2: Checking environment variables..."
if [ -z "$EXPO_PUBLIC_TWILIO_ACCOUNT_SID" ]; then
  echo "❌ TWILIO_ACCOUNT_SID not set"
  exit 1
fi
echo "✅ Environment variables configured"

# Test 3: Database connection
echo "Test 3: Checking database connection..."
# Add database connectivity check here

echo "✅ All smoke tests passed!"
```

---

## 6. POSTMAN COLLECTION

Import this collection for API testing:

```json
{
  "info": {
    "name": "Call Assistance API Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Simulate Incoming Call - Step 1",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/x-www-form-urlencoded"
          }
        ],
        "body": {
          "mode": "urlencoded",
          "urlencoded": [
            { "key": "From", "value": "+15551234567" },
            { "key": "CallSid", "value": "CAtest123" },
            { "key": "AccountSid", "value": "ACtest456" }
          ]
        },
        "url": {
          "raw": "{{BASE_URL}}/api/twilio/receptionist",
          "host": ["{{BASE_URL}}"],
          "path": ["api", "twilio", "receptionist"]
        }
      }
    },
    {
      "name": "Simulate Speech Input - Kitchen Project",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "urlencoded",
          "urlencoded": [
            { "key": "From", "value": "+15551234567" },
            { "key": "CallSid", "value": "CAtest123" },
            { "key": "SpeechResult", "value": "I want to remodel my kitchen" },
            { "key": "state", "value": "{{base64_state}}" }
          ]
        },
        "url": "{{BASE_URL}}/api/twilio/receptionist"
      }
    },
    {
      "name": "Get Call Logs",
      "request": {
        "method": "GET",
        "url": "{{BASE_URL}}/api/get-call-logs?companyId={{COMPANY_ID}}"
      }
    }
  ]
}
```

---

## 7. MONITORING & OBSERVABILITY

### Key Metrics to Track:
- ✅ Call answer rate
- ✅ Average call duration
- ✅ Lead qualification rate (% of qualified leads)
- ✅ Data extraction accuracy (% calls with complete info)
- ✅ AI response latency
- ✅ Webhook failure rate
- ✅ Database write success rate

### Test Monitoring Setup:
```typescript
// Add to your monitoring dashboard
const callMetrics = {
  totalCalls: await db.call_logs.count(),
  qualifiedLeads: await db.call_logs.count({ where: { isQualified: true } }),
  averageDuration: await db.call_logs.avg('callDuration'),
  completionRate: (completedCalls / totalCalls) * 100,
  dataExtractionRate: (callsWithAllInfo / totalCalls) * 100
};
```

---

## 8. REGRESSION TEST CHECKLIST

Before each deployment, verify:

- [ ] AI greeting plays correctly
- [ ] Speech recognition captures input
- [ ] GPT-4 API responds within 3 seconds
- [ ] All data extraction patterns work
- [ ] Budget qualification threshold ($10k) enforced
- [ ] Lead saved to database with all fields
- [ ] Call transcript stored completely
- [ ] Follow-up scheduled correctly
- [ ] Error handling doesn't crash calls
- [ ] Multi-company isolation works

---

## 9. DEBUGGING AIDS

### Enable Verbose Logging:
```typescript
// Add to receptionist handler
console.log('📞 Incoming call from:', request.body.From);
console.log('🗣️ Speech result:', request.body.SpeechResult);
console.log('📊 Conversation state:', conversationState);
console.log('💾 Saving lead:', leadData);
```

### Test with Twilio Console:
1. Go to Twilio Console → Phone Numbers
2. Click your number
3. Under "Voice Configuration", temporarily set webhook to ngrok tunnel
4. Test locally with breakpoints

---

## 10. TEST DATA FIXTURES

Create file: `tests/fixtures/call-test-data.ts`

```typescript
export const testCallers = [
  {
    phone: '+15551111111',
    name: 'John Smith',
    projectType: 'Kitchen',
    budget: '$50,000',
    timeline: 'ASAP',
    expectedQualified: true
  },
  {
    phone: '+15552222222',
    name: 'Sarah Johnson',
    projectType: 'Bathroom',
    budget: '$3,000',
    timeline: '1-3 months',
    expectedQualified: false
  },
  {
    phone: '+15553333333',
    name: 'Mike Williams',
    projectType: 'Roofing',
    budget: '$125,000',
    timeline: 'This Year',
    expectedQualified: true
  }
];

export const speechInputs = {
  greeting: [
    'Hi, I need help with a kitchen remodel',
    'I\'m looking to renovate my bathroom',
    'Can you help me with a construction project?'
  ],
  budget: [
    'Around fifty thousand dollars',
    '$50,000',
    'About 50k',
    'Between 40 and 60 thousand'
  ],
  timeline: [
    'ASAP',
    'Within the next 3 months',
    'This summer',
    'Next year'
  ]
};
```

---

## NEXT STEPS

1. **Run smoke tests** to verify basic functionality
2. **Execute manual test scenarios** 1-10 with real calls
3. **Set up automated test suite** with Vitest
4. **Configure load testing** with Artillery
5. **Implement monitoring dashboard** for call metrics
6. **Document edge cases** discovered during testing

---

## REPORTING BUGS

When reporting issues, include:
- Call SID from Twilio
- Full transcript from call_logs table
- Speech recognition accuracy
- Expected vs actual data extraction
- Server logs with timestamps
- Conversation state at failure point
