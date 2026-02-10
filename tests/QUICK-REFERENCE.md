# Call Assistance Testing - Quick Reference Card

**Print this or keep it open while testing**

---

## 🚀 Quick Commands

```bash
# Run everything
./tests/run-call-tests.sh

# Quick smoke test (30 seconds)
./tests/smoke-test.sh

# Unit tests only
npm test tests/call-assistance.test.ts

# Single test category
npm test tests/call-assistance.test.ts -t "Budget"
```

---

## 📞 Test Call Script

**Call**: [Your Twilio Number Here]

### Scenario 1: Qualified Lead (Budget ≥ $10k)
```
AI: "How can I help you?"
YOU: "I want to remodel my kitchen"

AI: "What's your name?"
YOU: "John Smith"

AI: "What's your budget?"
YOU: "Around fifty thousand dollars"

AI: "When are you looking to start?"
YOU: "ASAP"
```
**Expected**: Lead saved as "Project", Score: 80

### Scenario 2: Unqualified Lead (Budget < $10k)
```
YOU: "I need some drywall patching"
YOU: "Sarah Johnson"
YOU: "About three thousand"
YOU: "Next month"
```
**Expected**: Lead saved as "Lead", Score: 40

---

## 🧪 Budget Format Test Cases

| Say This | Should Extract |
|----------|----------------|
| "Fifty thousand" | $50,000 |
| "$50,000" | $50,000 |
| "50k" | $50,000 |
| "One hundred thousand" | $100,000 |
| "Around 75 grand" | $75,000 |
| "Between 40 and 60 thousand" | ~$50,000 |

---

## 🏗️ Project Type Keywords

| Say This | Extracted Type |
|----------|----------------|
| "kitchen remodel" | Kitchen |
| "bathroom renovation" | Bathroom |
| "new roof" | Roofing |
| "add a deck" | Deck/Patio |
| "paint the house" | Painting |
| "hardwood floors" | Flooring |
| "basement finishing" | Basement |

---

## ⏰ Timeline Test Cases

| Say This | Extracted |
|----------|-----------|
| "ASAP" | ASAP |
| "Within 3 months" | 1-3 months |
| "This summer" | 3-6 months |
| "This year" | This Year |
| "Next year" | Next Year |
| "I'm flexible" | Flexible |

---

## ✅ Post-Call Checklist

After each test call, verify in CRM:

- [ ] Lead appears in database
- [ ] Name extracted correctly
- [ ] Project type identified
- [ ] Budget value correct
- [ ] Timeline captured
- [ ] Qualification score accurate (80 or 40)
- [ ] Full transcript saved
- [ ] Follow-up scheduled (24 hours)
- [ ] Status correct (Project or Lead)

---

## 🐛 Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "No greeting" | Check Twilio webhook URL |
| "Speech not recognized" | Speak clearly, reduce background noise |
| "Lead not saved" | Check Supabase connection |
| "Wrong budget" | Review transcript, test different format |
| "Webhook error" | Check server logs, verify environment vars |

---

## 📊 Expected Metrics

| Metric | Target |
|--------|--------|
| Budget extraction accuracy | 95%+ |
| Project type identification | 90%+ |
| Name extraction | 85%+ |
| Lead qualification | 98%+ |
| Call completion rate | 95%+ |

---

## 🔍 Where to Check Results

1. **CRM**: `/crm` - See leads and call logs
2. **Database**: `call_logs` table - Full transcripts
3. **Twilio Console**: Check for webhook errors
4. **Server Logs**: Look for API errors

---

## 🆘 Emergency Debugging

```bash
# Check environment
cat .env.local | grep TWILIO

# Test webhook
curl https://your-domain.vercel.app/api/twilio/receptionist

# Check TypeScript
tsc --noEmit

# View recent logs (if using Vercel)
vercel logs
```

---

## 📋 Test Priorities

1. **P0 (Critical)**:
   - Greeting plays
   - Speech recognized
   - Lead saved to database
   - Budget qualification correct

2. **P1 (High)**:
   - All data fields extracted
   - Transcript saved
   - Follow-up scheduled

3. **P2 (Medium)**:
   - Edge cases handled
   - Pricing knowledge accurate
   - Multi-company isolation

---

## 🎯 Quick Validation (2 mins)

```bash
# 1. Smoke test
./tests/smoke-test.sh

# 2. Make one test call
# Call number, say: "Kitchen remodel, John Smith, $50k, ASAP"

# 3. Check CRM
# Verify lead appears with correct data

# ✅ If all pass, system is working
```

---

## 📞 Testing Contacts

- **Twilio Support**: https://support.twilio.com
- **OpenAI Status**: https://status.openai.com
- **Vercel Status**: https://www.vercel-status.com

---

## 🔢 Test Data Reference

**Qualified Budgets** (Score: 80):
- $10,000 (minimum)
- $50,000 (typical)
- $100,000 (high-end)

**Unqualified Budgets** (Score: 40):
- $5,000
- $3,000
- $1,000

**Project Types** (15 total):
Kitchen, Bathroom, Painting, Flooring, Roofing, Deck/Patio, Basement, Addition, Exterior, Windows/Doors, Drywall, Electrical, Plumbing, HVAC, Remodel

**Timelines** (6 options):
ASAP, 1-3 months, 3-6 months, This Year, Next Year, Flexible

---

**Version**: 1.0
**Last Updated**: 2026-02-10

---

**REMEMBER**:
- Speak clearly during test calls
- Check CRM after each test
- Document any unexpected behavior
- Budget ≥ $10k = Qualified (Score 80)
- Budget < $10k = Unqualified (Score 40)
