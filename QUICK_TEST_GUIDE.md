# Quick AI Assistant Test Guide

## 🚀 Quick Setup (2 minutes)

### 1. Create `.env` File

Create a file named `.env` in your project root with this content:

```env
# REQUIRED: OpenAI API Key
OPENAI_API_KEY=sk-your-openai-key-here

# REQUIRED: Backend URL
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:8081

# OPTIONAL: Other integrations
EXPO_PUBLIC_TWILIO_ACCOUNT_SID=your_sid
EXPO_PUBLIC_TWILIO_AUTH_TOKEN=your_token
EXPO_PUBLIC_TWILIO_PHONE_NUMBER=+1234567890
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
```

### 2. Restart Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
bun start
```

### 3. Verify Setup

Check the console logs when server starts:

```
[Backend] ========================================
[Backend]   OpenAI API Key: ✓ Configured  <-- Should show checkmark
[Backend] ========================================
```

---

## ✅ Quick Test (3 steps)

### Test 1: Check Backend Status

1. Open browser to: `http://localhost:8081/api/`
2. You should see:
   ```json
   {
     "status": "ok",
     "openai": "configured"
   }
   ```

### Test 2: Generate AI Estimate

1. Open your app
2. Navigate to any project
3. Click "Estimate" tab
4. Click **"Generate with AI"** button (purple sparkle icon)
5. Type: **"Replace 10 linear feet of base cabinets"**
6. Click **"Generate Estimate"**

**Expected Result:**
- Loading indicator appears
- After 5-15 seconds, cabinet items appear in selected items
- Items have correct quantities (10 LF)
- Items have notes explaining selection

### Test 3: Try Voice Input (if on mobile)

1. In AI Generate modal, tap microphone icon
2. Speak: "Install granite countertop and paint walls"
3. Tap microphone again to stop
4. Text should appear in input field
5. Generate estimate

---

## ❌ Common Issues

### Issue: "OPENAI_API_KEY not configured"

**Fix:**
1. Verify `.env` file exists in project root
2. Check the API key starts with `sk-`
3. Restart server completely
4. Clear cache: `bun start --clear`

### Issue: No items generated

**Fix:**
- Make your description more specific
- Use construction terms: "cabinets", "flooring", "paint", etc.
- Include quantities: "10 linear feet", "2 rooms", etc.

### Issue: Wrong items generated

**Fix:**
- The AI matches to your existing price list
- Be more specific: "semi-custom base cabinets" vs just "cabinets"
- Check that similar items exist in your price list

---

## 🎯 Test These Scenarios

Copy and paste these into the AI generator to test:

1. **"Replace 4 linear feet of semi custom cabinets"**
   - Should find cabinet item with quantity = 4

2. **"Install 100 square feet of tile flooring in bathroom"**
   - Should find tile items with quantity = 100

3. **"Paint 2 rooms with primer and finish coat"**
   - Should find paint items, primer, etc.

4. **"Install new granite countertop 8 linear feet"**
   - Should find countertop item with quantity = 8

---

## 📊 Success Criteria

Your AI assistant is working if:

- ✅ No errors in console
- ✅ "Generate with AI" button works
- ✅ AI generates relevant line items
- ✅ Quantities match your description
- ✅ Items are from your price list
- ✅ Items appear in estimate with correct pricing

---

## 🆘 Need Help?

**Check these logs:**
1. Browser console: Check for frontend errors
2. Terminal/server console: Check for backend errors
3. Network tab: Check API responses

**Common log messages:**
- `[AI Estimate] Generating estimate...` = Started
- `[AI Estimate] API Response:` = AI responded
- `[AI Estimate] Added price list item:` = Item matched
- `[AI Estimate] Generated X items` = Success!

---

## 🎉 Ready for Production?

Run through all 3 tests above. If they all pass, your AI assistant is ready to use!

**Next steps:**
- Test with real project scenarios
- Train team members on how to use it
- Monitor AI-generated estimates for accuracy
- Adjust prompts if needed for better results

---

**Last Updated:** January 28, 2025
