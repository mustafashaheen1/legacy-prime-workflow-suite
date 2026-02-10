# Manual Call Assistance Test Checklist

Use this checklist when manually testing the call assistance system.

---

## Pre-Test Setup

- [ ] Twilio phone number configured: `___________________`
- [ ] OpenAI API key is active
- [ ] Supabase database is accessible
- [ ] Webhook URL configured in Twilio console: `___________________`
- [ ] Have access to CRM to verify lead creation

---

## Test 1: Happy Path - Qualified Kitchen Remodel

**Goal**: Complete call with all information, qualified budget

| Step | Action | Expected Result | ✓ |
|------|--------|----------------|---|
| 1 | Call the Twilio number | Hear greeting: "Thank you for calling Legacy Prime Construction..." | [ ] |
| 2 | Say: "I want to remodel my kitchen" | AI asks for your name | [ ] |
| 3 | Say: "My name is John Smith" | AI asks about budget | [ ] |
| 4 | Say: "Around fifty thousand dollars" | AI asks about timeline | [ ] |
| 5 | Say: "Within the next two months" | AI provides warm closing with your name | [ ] |
| 6 | Check CRM | Lead appears with name "John Smith" | [ ] |
| 7 | Verify lead status | Status: "Project" (qualified) | [ ] |
| 8 | Verify budget | Budget: $50,000 | [ ] |
| 9 | Verify project type | Project Type: Kitchen | [ ] |
| 10 | Verify qualification score | Score: 80 | [ ] |
| 11 | Check call logs table | Full transcript is saved | [ ] |
| 12 | Check follow-up | Follow-up scheduled for tomorrow | [ ] |

**Notes**: ___________________________________________________________________

---

## Test 2: Unqualified Lead - Low Budget

**Goal**: Lead with budget under $10,000

| Step | Action | Expected Result | ✓ |
|------|--------|----------------|---|
| 1 | Call Twilio number | Greeting plays | [ ] |
| 2 | Say: "I need some drywall patching" | AI engages in conversation | [ ] |
| 3 | Provide name: "Sarah Johnson" | AI asks about budget | [ ] |
| 4 | Say: "About three thousand dollars" | AI continues professionally | [ ] |
| 5 | Say timeline: "Next month" | Call completes | [ ] |
| 6 | Check CRM | Lead saved as "Lead" (unqualified) | [ ] |
| 7 | Verify budget | Budget: $3,000 | [ ] |
| 8 | Verify qualification | Score: 40 | [ ] |

**Notes**: ___________________________________________________________________

---

## Test 3: Budget Format Variations

Test different ways people say budget amounts:

| Budget Format | Say This | Extracted Value | ✓ |
|---------------|----------|----------------|---|
| Word format | "Fifty thousand dollars" | $50,000 | [ ] |
| Numeric | "50,000 dollars" | $50,000 | [ ] |
| With commas | "$50,000" | $50,000 | [ ] |
| Shorthand | "50k" | $50,000 | [ ] |
| Range | "Between 40 and 60 thousand" | ~$50,000 | [ ] |
| Million | "One point five million" | $1,500,000 | [ ] |
| Informal | "Around 50 grand" | $50,000 | [ ] |

**Notes**: ___________________________________________________________________

---

## Test 4: Name Extraction Edge Cases

| Name Format | Say This | Extracted Name | ✓ |
|-------------|----------|----------------|---|
| Formal | "My name is Robert Smith" | Robert Smith | [ ] |
| Informal | "I'm Bob" | Bob | [ ] |
| Hyphenated | "Maria Garcia-Lopez" | Maria Garcia-Lopez | [ ] |
| With filler | "Yeah, it's Jennifer" | Jennifer | [ ] |
| Casual | "Call me Mike" | Mike | [ ] |

**Notes**: ___________________________________________________________________

---

## Test 5: Timeline Variations

| Timeline | Say This | Expected Extraction | ✓ |
|----------|----------|---------------------|---|
| Urgent | "ASAP" | ASAP | [ ] |
| Short term | "Within 3 months" | 1-3 months | [ ] |
| Medium term | "This summer" | 3-6 months | [ ] |
| Long term | "Next year" | Next Year | [ ] |
| Flexible | "I'm flexible" | Flexible | [ ] |

**Notes**: ___________________________________________________________________

---

## Test 6: Project Type Recognition

| Project | Say This | Expected Type | ✓ |
|---------|----------|---------------|---|
| Kitchen | "I want to remodel my kitchen" | Kitchen | [ ] |
| Bathroom | "Bathroom renovation" | Bathroom | [ ] |
| Roofing | "I need a new roof" | Roofing | [ ] |
| Deck | "Want to add a deck" | Deck/Patio | [ ] |
| Painting | "Paint the house" | Painting | [ ] |
| Flooring | "Refinish hardwood floors" | Flooring | [ ] |

**Notes**: ___________________________________________________________________

---

## Test 7: Conversation Quality

Rate the AI's performance on a scale of 1-5:

| Aspect | Rating (1-5) | Notes |
|--------|--------------|-------|
| Natural conversation flow | ___/5 | |
| Appropriate responses | ___/5 | |
| Handles interruptions | ___/5 | |
| Clarifying questions | ___/5 | |
| Warm, professional tone | ___/5 | |
| Pricing knowledge accuracy | ___/5 | |
| Closing message quality | ___/5 | |

**Overall Rating**: ___/5

**Notes**: ___________________________________________________________________

---

## Test 8: Error Handling

| Scenario | Test It | Handled Gracefully? | ✓ |
|----------|---------|---------------------|---|
| Say nothing (silence) | Stay quiet after AI asks question | AI asks for clarification | [ ] |
| Unclear speech | Mumble or speak unclearly | AI requests repeat | [ ] |
| Background noise | Call from noisy location | AI continues conversation | [ ] |
| Hang up early | End call mid-conversation | Partial lead still saved | [ ] |
| "I don't know" budget | Say "I'm not sure" for budget | AI provides guidance | [ ] |
| Multiple projects | "Kitchen and bathroom and deck" | AI handles multiple types | [ ] |

**Notes**: ___________________________________________________________________

---

## Test 9: Data Accuracy Check

After 3-5 test calls, verify in CRM:

| Check | Result | ✓ |
|-------|--------|---|
| All test calls appear in call logs | ____ out of ____ | [ ] |
| Caller names extracted correctly | ____ out of ____ | [ ] |
| Project types identified correctly | ____ out of ____ | [ ] |
| Budgets extracted correctly | ____ out of ____ | [ ] |
| Timelines captured correctly | ____ out of ____ | [ ] |
| Qualification scores accurate | ____ out of ____ | [ ] |
| Full transcripts saved | ____ out of ____ | [ ] |
| No duplicate leads created | No duplicates | [ ] |

**Accuracy Rate**: _____%

---

## Test 10: Load Testing (Optional)

If testing with multiple callers:

| Metric | Result | Target | ✓ |
|--------|--------|--------|---|
| Concurrent calls handled | ____ | 5+ | [ ] |
| Average call duration | ____ mins | 2-4 mins | [ ] |
| Call completion rate | ____% | 95%+ | [ ] |
| Lead creation rate | ____% | 95%+ | [ ] |
| API errors | ____ | 0 | [ ] |

**Notes**: ___________________________________________________________________

---

## Test 11: Pricing Knowledge

Ask the AI for pricing guidance:

| Question | Ask This | AI Response Quality | ✓ |
|----------|----------|---------------------|---|
| Kitchen cabinets | "How much do kitchen cabinets cost?" | Provides $320-502/LF range | [ ] |
| Bathroom remodel | "What's a bathroom remodel cost?" | Mentions $12k-40k range | [ ] |
| General labor | "What's your hourly rate?" | References $115-120/hr | [ ] |

**Notes**: ___________________________________________________________________

---

## Test 12: Multi-Company Isolation (If Applicable)

If you have multiple companies configured:

- [ ] Call as Company A, verify lead saved to Company A only
- [ ] Call as Company B, verify lead saved to Company B only
- [ ] Company A cannot see Company B's call logs
- [ ] Company B cannot see Company A's call logs

**Notes**: ___________________________________________________________________

---

## Post-Test Verification

After completing all tests:

- [ ] Check Twilio call logs for any errors
- [ ] Review server logs for exceptions
- [ ] Verify database integrity (no orphaned records)
- [ ] Confirm no PII leakage in logs
- [ ] Test follow-up reminders are scheduled
- [ ] Verify SMS notifications sent (if configured)

---

## Issues Found

Document any bugs or unexpected behavior:

| # | Issue | Severity | Expected | Actual | Status |
|---|-------|----------|----------|--------|--------|
| 1 | | 🔴/🟡/🟢 | | | |
| 2 | | 🔴/🟡/🟢 | | | |
| 3 | | 🔴/🟡/🟢 | | | |

---

## Test Completion

**Tester**: _____________________
**Date**: _____________________
**Environment**: ☐ Dev  ☐ Staging  ☐ Production
**Overall Result**: ☐ Pass  ☐ Pass with Issues  ☐ Fail

**Summary**: ___________________________________________________________________

___________________________________________________________________

___________________________________________________________________

**Next Steps**: ___________________________________________________________________

___________________________________________________________________
