# AI Assistant Testing Checklist

## ✅ Environment Variables Check

### Required Environment Variables

Create a `.env` file in the root of your project with these variables:

```env
# OpenAI Configuration (REQUIRED for AI features)
OPENAI_API_KEY=sk-your-openai-api-key-here

# Backend API URL (REQUIRED)
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:8081

# Twilio Configuration (for SMS/Voice features)
EXPO_PUBLIC_TWILIO_ACCOUNT_SID=your_twilio_sid
EXPO_PUBLIC_TWILIO_AUTH_TOKEN=your_twilio_auth_token
EXPO_PUBLIC_TWILIO_PHONE_NUMBER=+1234567890

# Stripe Configuration (for payments)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key

# App Configuration
EXPO_PUBLIC_API_URL=http://localhost:8081
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

### How to Verify Environment Variables

1. **Start your server** and check the console logs:

```
[Backend] ========================================
[Backend] ✓ Hono server initialized successfully
[Backend] ========================================
[Backend] Environment Configuration:
[Backend]   OpenAI API Key: ✓ Configured
[Backend]   Twilio Account SID: ✓ Configured
[Backend]   Twilio Auth Token: ✓ Configured
[Backend]   Twilio Phone Number: ✓ Configured
[Backend]   Stripe Secret Key: ✓ Configured
[Backend] ========================================
```

2. **Visit the health endpoint**:
   - Open: `http://localhost:8081/api/` in your browser
   - You should see:
   ```json
   {
     "status": "ok",
     "message": "API is running",
     "openai": "configured",
     "timestamp": "2025-01-28T..."
   }
   ```

---

## 🧪 Backend API Testing

### 1. Test OpenAI Connection

Use the test endpoint to verify OpenAI is working:

**tRPC Call:**
```typescript
const result = await trpcClient.openai.testConnection.query();
```

**Expected Response:**
```typescript
{
  success: true,
  message: "OpenAI connection successful!",
  model: "gpt-4o"
}
```

### 2. Test AI Chat

**tRPC Call:**
```typescript
const result = await trpcClient.openai.chat.mutate({
  messages: [
    { role: "user", content: "Hello!" }
  ]
});
```

**Expected Response:**
```typescript
{
  success: true,
  message: "Hi! How can I help you today?",
  usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
}
```

### 3. Test Speech-to-Text

**tRPC Call:**
```typescript
const result = await trpcClient.openai.speechToText.mutate({
  audioBase64: "base64_encoded_audio_data",
  language: "en"
});
```

**Expected Response:**
```typescript
{
  success: true,
  text: "Transcribed text from audio"
}
```

### 4. Test Image Analysis

**tRPC Call:**
```typescript
const result = await trpcClient.openai.imageAnalysis.mutate({
  imageBase64: "base64_encoded_image_data",
  prompt: "Describe this construction site"
});
```

**Expected Response:**
```typescript
{
  success: true,
  analysis: "This is a construction site with..."
}
```

### 5. Test AI Agent Chat

**tRPC Call:**
```typescript
const result = await trpcClient.openai.agentChat.mutate({
  messages: [
    {
      role: "user",
      parts: [{ type: "text", text: "Hello" }]
    }
  ],
  systemInstructions: "You are a helpful assistant"
});
```

**Expected Response:**
```typescript
{
  success: true,
  parts: [
    { type: "text", text: "Hello! How can I assist you?" }
  ]
}
```

---

## 🎨 Frontend AI Features Testing

### 1. AI Estimate Generation (Estimate Interface)

**Location:** `app/project/[id]/estimate.tsx`

**How to Test:**
1. Navigate to any project
2. Tap on "Estimate" tab
3. Tap "Generate with AI" button (purple button with sparkle icon)
4. Enter scope of work: "Replace 10 linear feet of base cabinets and install granite countertop"
5. Tap "Generate Estimate"

**Expected Behavior:**
- Loading indicator appears
- AI generates line items matching your price list
- Items appear in the selected items section
- Each item has quantity, price, and notes

**What the AI Should Do:**
- Read the scope of work description
- Match items to existing price list items
- Calculate realistic quantities
- Add relevant notes explaining selections
- Follow your instructions precisely (e.g., "4 linear feet" → quantity: 4)

**Example Test Cases:**

| Input | Expected Output |
|-------|----------------|
| "Replace 4 linear feet of semi custom cabinets" | Should find cabinet item with quantity 4 |
| "Install 100 square feet of tile flooring" | Should find tile item with quantity 100 |
| "Paint 2 rooms" | Should find paint items with appropriate quantities |

### 2. Camera/File Upload for AI

**How to Test:**
1. In AI Generate modal, tap the paperclip icon (📎)
2. Choose "Take Photo" or "Choose File"
3. Upload an image of a construction site
4. Describe work or let AI analyze the image
5. Generate estimate

**Expected Behavior:**
- Camera opens or file picker appears
- Image is attached and shown as a chip
- AI analyzes image along with text description
- Generates relevant line items based on visual analysis

### 3. Voice Input for AI

**How to Test:**
1. In AI Generate modal, tap the microphone icon (🎤)
2. Speak your scope of work
3. Tap microphone again to stop
4. Text should appear in the input field
5. Generate estimate

**Expected Behavior:**
- Recording indicator appears (red border)
- Speech is transcribed to text
- Text appears in input field
- Can be edited before generating

---

## 🔍 Error Handling Testing

### Test: Missing OpenAI API Key

1. **Remove OPENAI_API_KEY** from .env
2. **Restart server**
3. **Try to generate estimate**

**Expected Error:**
```
"OPENAI_API_KEY is not configured in environment variables"
```

### Test: Invalid Scope Description

1. **Enter gibberish:** "asdfsdf asdfasdf"
2. **Generate estimate**

**Expected Behavior:**
- No items generated OR
- Alert: "AI could not generate any line items"

### Test: Network Error

1. **Stop the backend server**
2. **Try to generate estimate**

**Expected Error:**
```
"Failed to generate estimate. Please try again."
```

---

## 📊 AI Response Quality Testing

### Price List Matching Accuracy

The AI should:
- ✅ Use ONLY items from your existing price list
- ✅ Match descriptions accurately (e.g., "cabinets" → cabinet items)
- ✅ Calculate realistic quantities
- ✅ Avoid creating custom items unless absolutely necessary

**Test Prompt:**
```
"Replace 8 linear feet of upper cabinets, 12 linear feet of base cabinets, and install new granite countertops"
```

**Expected AI Behavior:**
- Find cabinet items from price list
- Use correct quantities (8 LF, 12 LF)
- Find granite countertop item
- Add notes explaining selections

### Quantity Precision

**Test Prompts:**

1. "4 linear feet of cabinets"
   - Expected: quantity = 4

2. "100 square feet of flooring"
   - Expected: quantity = 100

3. "2 gallons of paint"
   - Expected: quantity = 2

---

## 🚀 Performance Testing

### Response Time Benchmarks

| Operation | Expected Time | Max Acceptable |
|-----------|--------------|----------------|
| AI Chat | 1-3 seconds | 10 seconds |
| Speech-to-Text | 2-5 seconds | 15 seconds |
| Image Analysis | 3-8 seconds | 20 seconds |
| Estimate Generation | 5-15 seconds | 30 seconds |

### Load Testing

1. Generate 5 estimates in a row
2. All should complete successfully
3. No memory leaks
4. No performance degradation

---

## 📱 Mobile Compatibility Testing

### iOS Testing

1. Test on iPhone (if available)
2. Test AI generation
3. Test camera integration
4. Test voice input

### Android Testing

1. Test on Android device (if available)
2. Test AI generation
3. Test camera integration
4. Test voice input

### Web Testing

1. Test on Chrome
2. Test on Safari
3. Test on Firefox
4. Verify all features work

---

## 🐛 Common Issues & Solutions

### Issue: "OPENAI_API_KEY not configured"

**Solution:**
1. Create `.env` file in project root
2. Add: `OPENAI_API_KEY=sk-your-key`
3. Restart server with `npm start` or `bun start`

### Issue: AI generates irrelevant items

**Solution:**
1. Improve system prompt in `estimate.tsx` (lines 1336-1365)
2. Add more specific instructions
3. Include better price list context

### Issue: Camera/file upload not working

**Solution:**
1. Check permissions in `app.json`
2. Verify expo-camera and expo-image-picker are installed
3. Test on physical device (camera doesn't work in simulator)

### Issue: Voice input not transcribing

**Solution:**
1. Verify `speechToText` API is working
2. Check microphone permissions
3. Test with clear audio input
4. Verify audio format is supported (.wav, .m4a)

### Issue: Slow AI responses

**Solution:**
1. Check OpenAI API status
2. Reduce max_tokens in API calls
3. Use faster models (gpt-4o-mini instead of gpt-4o)
4. Implement request caching

---

## ✅ Final Checklist

Before marking as "ready for production":

- [ ] All environment variables are set
- [ ] OpenAI API key is valid and has credits
- [ ] Backend health endpoint returns "configured"
- [ ] AI chat responds correctly
- [ ] Speech-to-text works
- [ ] Image analysis works
- [ ] Estimate generation creates accurate line items
- [ ] Camera/file upload functional
- [ ] Voice input transcribes correctly
- [ ] Error handling works properly
- [ ] Mobile app works on iOS/Android
- [ ] Web app works in all major browsers
- [ ] Performance is acceptable (<30s for estimates)
- [ ] No console errors or warnings
- [ ] Price list items are matched correctly
- [ ] Quantities are calculated accurately

---

## 🎯 Testing Script

Run this complete test in your app:

```typescript
// Test 1: Connection
const testConnection = await trpcClient.openai.testConnection.query();
console.log('Connection:', testConnection.success ? '✅' : '❌');

// Test 2: Chat
const chatResult = await trpcClient.openai.chat.mutate({
  messages: [{ role: 'user', content: 'Say hi' }]
});
console.log('Chat:', chatResult.success ? '✅' : '❌');

// Test 3: Generate Estimate (from UI)
// 1. Navigate to project estimate page
// 2. Click "Generate with AI"
// 3. Enter: "Replace 10 feet of cabinets"
// 4. Click Generate
// 5. Verify items appear

console.log('🎉 All tests passed! AI Assistant is ready!');
```

---

## 📞 Need Help?

If tests fail:

1. Check backend logs for errors
2. Check browser console for frontend errors
3. Verify environment variables are loaded
4. Restart the server completely
5. Clear cache and reload app
6. Check OpenAI API dashboard for usage/errors

---

## 🎓 Next Steps After Testing

Once all tests pass:

1. **Fine-tune AI prompts** for better accuracy
2. **Add more test cases** for edge scenarios
3. **Implement caching** for common requests
4. **Add analytics** to track AI usage
5. **Set up monitoring** for API errors
6. **Create user documentation** for AI features

---

**Last Updated:** January 28, 2025
