# Call Testing Cheat Sheet - PRINT THIS!

**Keep this next to you while making test calls**

---

## 📞 YOUR TWILIO NUMBER: ___________________

---

## 🎯 TEST CALL #1: Kitchen Remodel (Qualified)

| Step | AI Says | You Say |
|------|---------|---------|
| 1 | "How can I help you today?" | **"I want to remodel my kitchen"** |
| 2 | "What's your name?" | **"John Smith"** |
| 3 | "What's your budget?" | **"Fifty thousand dollars"** |
| 4 | "When are you looking to start?" | **"As soon as possible"** |
| 5 | Warm closing with your name | Listen and hang up |

### ✅ Check in CRM:
- [ ] Name: John Smith
- [ ] Project: Kitchen
- [ ] Budget: $50,000
- [ ] Timeline: ASAP
- [ ] Status: **Project** (qualified)
- [ ] Score: **80**

---

## 🎯 TEST CALL #2: Drywall (Unqualified)

| Step | You Say |
|------|---------|
| 1 | **"I need drywall patching"** |
| 2 | **"Sarah Johnson"** |
| 3 | **"Three thousand dollars"** |
| 4 | **"Next month"** |

### ✅ Check in CRM:
- [ ] Budget: $3,000
- [ ] Status: **Lead** (unqualified)
- [ ] Score: **40**

---

## 💰 Budget Format Tests

Try saying budget these different ways:

| Format | What to Say |
|--------|-------------|
| Words | "Fifty thousand" |
| Shorthand | "50k" |
| Numeric | "50,000 dollars" |
| With $ | "$50,000" |
| Informal | "Around 50 grand" |
| Range | "Between 40 and 60 thousand" |

**All should extract as $50,000**

---

## 🏗️ Project Type Tests

| Say This | Should Identify As |
|----------|---------------------|
| "kitchen remodel" | Kitchen |
| "bathroom renovation" | Bathroom |
| "new roof" | Roofing |
| "add a deck" | Deck/Patio |
| "paint the house" | Painting |
| "finish basement" | Basement |

---

## ⏰ Timeline Tests

| Say This | Extracts As |
|----------|-------------|
| "ASAP" | ASAP |
| "Within 3 months" | 1-3 months |
| "This summer" | 3-6 months |
| "This year" | This Year |
| "Next year" | Next Year |

---

## 🎯 Quick 3-Minute Test

**Call and say exactly this:**
1. "I want to remodel my kitchen"
2. "John Smith"
3. "Fifty thousand"
4. "ASAP"

**Then check CRM - everything should be there!**

---

## 📋 After Each Call - Verify:

- [ ] Lead appears in CRM
- [ ] Name is correct
- [ ] Project type correct
- [ ] Budget correct
- [ ] Timeline correct
- [ ] Qualification score (80 or 40)
- [ ] Full transcript saved

---

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| No greeting | Check Twilio webhook URL |
| Wrong data | Check transcript to see what AI heard |
| Lead not saved | Check Supabase connection |
| AI doesn't understand | Speak more clearly, reduce noise |

---

## 📊 Qualification Rules

```
Budget ≥ $10,000  →  Status: "Project"  →  Score: 80 ✅
Budget < $10,000  →  Status: "Lead"     →  Score: 40 ⚠️
```

---

## 🎤 Speech Tips

- Speak clearly and at normal pace
- Use a quiet environment
- Don't worry about perfect grammar
- Talk naturally like a real customer
- Pause briefly after AI asks questions

---

## 📝 Test Tracker

| Call # | Scenario | Pass/Fail | Notes |
|--------|----------|-----------|-------|
| 1 | Kitchen $50k | ☐ | |
| 2 | Drywall $3k | ☐ | |
| 3 | Budget: "50k" | ☐ | |
| 4 | Bathroom | ☐ | |
| 5 | Roofing | ☐ | |

---

**CRM Dashboard**: https://legacy-prime-workflow-suite.vercel.app/crm

**Start with Call #1 first!** ☎️
