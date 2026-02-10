# ☎️ SIMPLE CALL TEST - START HERE!

**First time testing? Follow this simple script.**

---

## STEP 1: Get Ready

- [ ] Find your Twilio phone number
- [ ] Open CRM dashboard in browser: https://legacy-prime-workflow-suite.vercel.app/crm
- [ ] Have your phone ready
- [ ] Find a quiet place

---

## STEP 2: Make the Call

**Dial your Twilio number**: `_______________________`

---

## STEP 3: Follow This Exact Script

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  AI: "Thank you for calling Legacy Prime Construction. │
│       How can I help you today?"                        │
│                                                         │
│  YOU: "I want to remodel my kitchen"                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  AI: "Great! What's your name?"                         │
│                                                         │
│  YOU: "John Smith"                                      │
│       (or use your real name)                           │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  AI: "What's your budget for this project?"             │
│                                                         │
│  YOU: "Fifty thousand dollars"                          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  AI: "When are you looking to start?"                   │
│                                                         │
│  YOU: "As soon as possible"                             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  AI: "Thank you, John! We'll be in touch soon..."       │
│                                                         │
│  [Call ends]                                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Total Time**: 2-3 minutes

---

## STEP 4: Check Results in CRM

1. **Go to your CRM dashboard**
2. **Look for the newest call log**
3. **Verify this information**:

```
┌───────────────────────────────────────┐
│ ✅ EXPECTED RESULTS:                  │
├───────────────────────────────────────┤
│ Name:          John Smith             │
│ Project Type:  Kitchen                │
│ Budget:        $50,000                │
│ Timeline:      ASAP                   │
│ Status:        Project (Qualified)    │
│ Score:         80                     │
│ Transcript:    Full conversation      │
│ Follow-up:     Tomorrow               │
└───────────────────────────────────────┘
```

---

## ✅ SUCCESS!

If all the data above appears correctly in your CRM:

**🎉 Your call assistance system is working!**

---

## ❌ Something Wrong?

### Lead Not Showing Up?
- Wait 10-20 seconds and refresh CRM
- Check browser console for errors
- Check Twilio console for webhook errors

### Wrong Information?
- Look at the transcript to see what AI heard
- Try calling again from a quieter place
- Speak more clearly

### Call Not Connecting?
- Verify you're calling the correct Twilio number
- Check Twilio console that number is active
- Verify webhook URL is configured

---

## 📞 NEXT TESTS

Once the first test works, try these:

### Test 2: Lower Budget (Unqualified Lead)
```
Call and say:
- "I need drywall patching"
- "Sarah Johnson"
- "Three thousand dollars"
- "Next month"

Expected: Status = "Lead", Score = 40
```

### Test 3: Different Budget Format
```
Call and say:
- "Kitchen remodel"
- "Your name"
- "50k" (shorthand format)
- "ASAP"

Expected: Budget = $50,000
```

---

## 💡 PRO TIP

**Speak naturally!** Don't worry about using exact phrases. The AI is smart and understands natural conversation.

For example, instead of saying exactly "I want to remodel my kitchen", you could say:
- "I'm looking to redo my kitchen"
- "We need a kitchen renovation"
- "Interested in kitchen remodeling"

The AI will understand all of these!

---

## 📋 QUICK REFERENCE

**Qualified Lead** = Budget ≥ $10,000 → Score: 80
**Unqualified Lead** = Budget < $10,000 → Score: 40

---

## 🆘 NEED HELP?

See these detailed guides:
- `tests/MANUAL-CALLING-GUIDE.md` - Full testing scenarios
- `tests/CALL-SCRIPT-CHEAT-SHEET.md` - Quick reference card
- `tests/QUICK-REFERENCE.md` - Troubleshooting

---

## 🎯 YOUR MISSION

**Make one successful test call and verify the data in CRM.**

That's it! Once this works, you can try more advanced tests.

---

**Ready? Pick up your phone and dial the number!** 📱

**Remember**:
- Quiet environment
- Speak clearly
- Check CRM after the call
- Have fun! 🎉
