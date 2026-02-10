# Manual Call Testing Guide - Step by Step

**For testing the AI Call Receptionist by actually calling the number**

---

## 🎯 What You Need

- [ ] Your Twilio phone number: **____________________**
- [ ] Your phone or calling app
- [ ] Access to the CRM dashboard to check results
- [ ] Quiet environment (minimize background noise)
- [ ] This guide open while calling

---

## 📞 TEST 1: Basic Qualified Lead (Kitchen Remodel)

**Time**: 2-3 minutes
**Goal**: Complete successful call with qualified budget

### Call Script

1. **Dial the Twilio number**

2. **Wait for greeting**, you'll hear:
   > "Thank you for calling Legacy Prime Construction. How can I help you today?"

3. **YOU SAY**:
   ```
   "Hi, I'm interested in remodeling my kitchen"
   ```

4. **AI WILL ASK** something like:
   > "Great! What's your name?"

5. **YOU SAY**:
   ```
   "My name is John Smith"
   ```
   *(Use your real name or test name)*

6. **AI WILL ASK**:
   > "What's your budget for this project?"

7. **YOU SAY**:
   ```
   "Around fifty thousand dollars"
   ```

8. **AI WILL ASK**:
   > "When are you looking to start?"

9. **YOU SAY**:
   ```
   "As soon as possible"
   ```

10. **AI WILL RESPOND** with a warm closing using your name:
    > "Thank you, John! Someone from our team will be in touch with you soon..."

11. **Call ends**

### ✅ Check Results in CRM

Go to your CRM dashboard and verify:

- [ ] **Lead Name**: John Smith (or the name you said)
- [ ] **Project Type**: Kitchen
- [ ] **Budget**: $50,000
- [ ] **Timeline**: ASAP
- [ ] **Status**: Project *(because budget ≥ $10,000)*
- [ ] **Qualification Score**: 80
- [ ] **Call Log**: Full conversation transcript is saved
- [ ] **Follow-up**: Scheduled for tomorrow

**✅ PASS** if all items above are correct
**❌ FAIL** if any data is missing or incorrect

---

## 📞 TEST 2: Unqualified Lead (Small Job)

**Time**: 2-3 minutes
**Goal**: Test lead with budget under $10,000

### Call Script

1. **Dial the Twilio number**

2. **After greeting**, YOU SAY:
   ```
   "I need some drywall patching done"
   ```

3. **When asked for name**, YOU SAY:
   ```
   "Sarah Johnson"
   ```

4. **When asked for budget**, YOU SAY:
   ```
   "About three thousand dollars"
   ```

5. **When asked for timeline**, YOU SAY:
   ```
   "Sometime next month"
   ```

6. **Listen for closing message**

### ✅ Check Results

- [ ] **Lead Name**: Sarah Johnson
- [ ] **Project Type**: Drywall
- [ ] **Budget**: $3,000
- [ ] **Timeline**: 1-3 months
- [ ] **Status**: Lead *(because budget < $10,000)*
- [ ] **Qualification Score**: 40
- [ ] **Still saved to database** (unqualified leads are kept)

---

## 📞 TEST 3: Different Budget Formats

**Goal**: Test if AI understands different ways of saying budget

### Try These Different Formats (One per call)

| Call # | What You Say | Expected Result |
|--------|--------------|-----------------|
| 1 | "Fifty thousand" | $50,000 |
| 2 | "50k" | $50,000 |
| 3 | "$50,000" | $50,000 |
| 4 | "One hundred thousand dollars" | $100,000 |
| 5 | "Around 75 grand" | $75,000 |
| 6 | "Between 40 and 60 thousand" | ~$50,000 |

**Make 2-3 calls** using different budget formats and verify each is extracted correctly.

---

## 📞 TEST 4: Different Project Types

**Goal**: Test if AI recognizes different construction projects

### Try These Projects (One per call)

| What You Say | Expected Project Type |
|--------------|----------------------|
| "I want to remodel my bathroom" | Bathroom |
| "I need a new roof" | Roofing |
| "I want to add a deck to my backyard" | Deck/Patio |
| "I need the house painted" | Painting |
| "I want to finish my basement" | Basement |
| "I need new hardwood floors" | Flooring |

**Make 2-3 calls** with different project types.

---

## 📞 TEST 5: Different Timelines

**Goal**: Test timeline extraction

### Try Saying:

| What You Say | Expected Timeline |
|--------------|-------------------|
| "ASAP" | ASAP |
| "Within the next three months" | 1-3 months |
| "Sometime this summer" | 3-6 months |
| "This year" | This Year |
| "Next year" | Next Year |
| "I'm flexible" | Flexible |

---

## 📞 TEST 6: Name Variations

**Goal**: Test name extraction with different formats

### Try Saying Your Name As:

| What You Say | Should Extract |
|--------------|----------------|
| "My name is Robert Smith" | Robert Smith |
| "I'm Bob" | Bob |
| "Call me Mike" | Mike |
| "Yeah, it's Jennifer" | Jennifer |
| "This is Maria Garcia-Lopez" | Maria Garcia-Lopez |

---

## 📞 TEST 7: Test AI's Pricing Knowledge

**Goal**: See if AI can provide pricing guidance

### Call and Ask:

1. **After greeting**, say:
   ```
   "How much does a kitchen remodel usually cost?"
   ```

2. **AI should provide pricing info**:
   - Kitchen cabinets: $320-$502 per linear foot
   - General range information

3. **Continue with the conversation**:
   - Provide your name, budget, timeline as normal

### ✅ Verify:
- [ ] AI provided helpful pricing information
- [ ] AI still collected all required information
- [ ] Lead was saved correctly

---

## 📞 TEST 8: Handle Unclear/Missing Info

**Goal**: Test how AI handles vague responses

### Scenario A: "I don't know" Budget

1. Call the number
2. When asked for budget, say:
   ```
   "I'm not sure, what do these projects usually cost?"
   ```

3. **Expected**: AI should provide guidance and ask again

### Scenario B: Multiple Projects

1. Call the number
2. Say:
   ```
   "I want to remodel my kitchen and bathroom, and maybe add a deck"
   ```

3. **Expected**: AI should handle multiple projects and ask clarifying questions

### Scenario C: Silence/Unclear Speech

1. Call the number
2. After a question, stay silent for 3-5 seconds
3. **Expected**: AI should ask you to repeat or clarify

---

## 📞 TEST 9: Early Hang-Up

**Goal**: Verify partial leads are saved

### Test:

1. Call the number
2. Provide only name and project type
3. Hang up before providing budget

### ✅ Check Results:
- [ ] Partial lead is saved in database
- [ ] Has the information you provided
- [ ] Marked as incomplete

---

## 📞 TEST 10: Background Noise Test

**Goal**: Test speech recognition quality

### Test:

1. Call from a moderately noisy environment (TV on, outdoor, etc.)
2. Complete a full conversation
3. Verify data accuracy

### ✅ Check:
- [ ] Name extracted correctly
- [ ] Budget extracted correctly
- [ ] Project type correct
- [ ] Call completed successfully

**Note**: If data is wrong, review transcript to see what AI heard

---

## 🎯 Quick 5-Minute Test

**If you're short on time, do this one test:**

1. **Call the number**
2. **Say**: "Hi, I want to remodel my kitchen"
3. **When asked name**: "John Smith"
4. **When asked budget**: "Fifty thousand"
5. **When asked timeline**: "ASAP"
6. **Check CRM**: Verify all data is correct

**✅ If this works, system is operational**

---

## 📊 What to Check After Each Call

### In CRM Dashboard:

1. **Go to CRM tab** or `/crm` route
2. **Look for your test call** in the call logs
3. **Click to view details**

### Verify This Data:

| Field | Check |
|-------|-------|
| **Caller Name** | Matches what you said |
| **Phone Number** | Your phone number |
| **Project Type** | Correctly identified |
| **Budget** | Correctly extracted (numeric value) |
| **Timeline** | Correctly categorized |
| **Status** | "Project" if ≥$10k, "Lead" if <$10k |
| **Qualification Score** | 80 for qualified, 40 for unqualified |
| **Transcript** | Full conversation is recorded |
| **Call Duration** | Shows number of exchanges |
| **Follow-up Date** | Scheduled for next day |

---

## 🐛 Troubleshooting

### Issue: No Greeting / Call Doesn't Connect

**Check**:
- [ ] Calling the correct Twilio number
- [ ] Number is configured in Twilio console
- [ ] Webhook URL is set correctly
- [ ] Check Twilio console for errors

### Issue: AI Doesn't Understand What I Said

**Try**:
- Call from quieter environment
- Speak more clearly
- Use simpler phrases
- Check transcript to see what AI heard

### Issue: Lead Not Appearing in CRM

**Check**:
- [ ] Supabase connection is working
- [ ] Check browser console for errors
- [ ] Look in `call_logs` table directly
- [ ] Verify call shows in Twilio console

### Issue: Wrong Data Extracted

**Do This**:
- Review the full transcript in call log
- See what the AI "heard" vs what you said
- Try saying it differently (e.g., "$50,000" instead of "fifty thousand")

### Issue: Call Drops or Errors

**Check**:
- [ ] Server logs for exceptions
- [ ] Twilio console for webhook errors
- [ ] OpenAI API status (status.openai.com)
- [ ] Verify API keys are valid

---

## 📝 Test Results Template

Use this to track your tests:

### Test Session: [Date/Time]

**Tester**: _____________________

| Test # | Scenario | Result | Issues |
|--------|----------|--------|--------|
| 1 | Basic qualified lead | ☐ Pass ☐ Fail | |
| 2 | Unqualified lead | ☐ Pass ☐ Fail | |
| 3 | Budget: "50k" | ☐ Pass ☐ Fail | |
| 4 | Budget: "fifty thousand" | ☐ Pass ☐ Fail | |
| 5 | Project: Bathroom | ☐ Pass ☐ Fail | |
| 6 | Project: Roofing | ☐ Pass ☐ Fail | |
| 7 | Timeline: ASAP | ☐ Pass ☐ Fail | |
| 8 | Pricing question | ☐ Pass ☐ Fail | |
| 9 | Early hang-up | ☐ Pass ☐ Fail | |
| 10 | Background noise | ☐ Pass ☐ Fail | |

**Overall**: ☐ Pass  ☐ Pass with Issues  ☐ Fail

**Notes**:
________________________________________________________________

________________________________________________________________

---

## 🎬 Video Recording (Optional)

Consider screen recording your CRM while making test calls to:
- Document the end-to-end flow
- Show data appearing in real-time
- Create training materials
- Debug issues

---

## 📞 Recommended Test Order

### First Time Testing:
1. ✅ Test 1: Basic qualified lead (verify system works)
2. ✅ Test 2: Unqualified lead (verify scoring)
3. ✅ Test 3: Try 2 different budget formats
4. ✅ Test 4: Try 2 different project types

**Total Time**: 20-30 minutes

### Full Testing:
- Complete all 10 test scenarios
- Make 15-20 test calls total
- Try different variations

**Total Time**: 1-2 hours

---

## 💡 Pro Tips

1. **Speak naturally** - Don't use robotic speech, talk like a real customer
2. **Vary your phrasing** - Real callers won't use exact keywords
3. **Test edge cases** - Try saying things in weird ways
4. **Document everything** - Take notes on what works and what doesn't
5. **Check transcripts** - They show exactly what the AI heard
6. **Test from different phones** - Mobile, landline, VoIP
7. **Test at different times** - Check if performance varies

---

## ✅ Success Criteria

After testing, the system should:
- [ ] Answer calls with greeting
- [ ] Understand natural speech
- [ ] Extract name, project, budget, timeline
- [ ] Qualify leads correctly (≥$10k = qualified)
- [ ] Save all data to CRM
- [ ] Create full transcripts
- [ ] Schedule follow-ups
- [ ] Handle 9 out of 10 calls successfully

---

## 📞 Your Twilio Number

**Write it here for quick reference:**

```
╔════════════════════════════════╗
║                                ║
║   YOUR TWILIO NUMBER:          ║
║                                ║
║   +1 ___ - ___ - ____         ║
║                                ║
╚════════════════════════════════╝
```

---

## 🆘 Need Help?

If you encounter issues:

1. Check `tests/QUICK-REFERENCE.md` for common issues
2. Review server logs for errors
3. Check Twilio console for webhook failures
4. Verify environment variables are set
5. Run smoke test: `./tests/smoke-test.sh`

---

**Ready to start testing? Pick up your phone and dial the number!** 📱

**Start with Test 1** - it's the easiest and verifies basic functionality.

---

**Good luck with testing!** 🎉

*Remember: Speak clearly, be in a quiet space, and have fun talking to the AI!*
