# 🚀 Setup Instructions

## Current Error: "Failed to fetch"

This error occurs because the backend server is not accessible. To fix this, you need to:

## ✅ Solution: Set Up Environment Variables

### 1. Create `.env` file in the root of your project:

```env
# Backend API URL (required for tRPC)
EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:8081

# Stripe Keys (required for subscriptions)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here

# Optional: Other Services
OPENAI_API_KEY=sk-your-openai-key
EXPO_PUBLIC_TWILIO_ACCOUNT_SID=your_twilio_sid
EXPO_PUBLIC_TWILIO_AUTH_TOKEN=your_twilio_token
EXPO_PUBLIC_TWILIO_PHONE_NUMBER=your_twilio_phone
```

### 2. Get Your Stripe Keys:

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy the **Publishable key** (starts with `pk_test_`)
3. Copy the **Secret key** (starts with `sk_test_`)
4. Add them to your `.env` file

### 3. Restart the Development Server:

```bash
# Stop the current server (Ctrl+C)
# Then restart with:
npx expo start --clear
```

## 🧪 Testing Without Backend Setup

If you want to test the app WITHOUT setting up Stripe and backend, the subscription flow will work in "offline mode" and skip the Stripe payment step.

## 📱 Current Features That Work Without Backend:

- ✅ Login/Signup (stores locally)
- ✅ Dashboard
- ✅ CRM
- ✅ Projects
- ✅ Expenses
- ✅ Photos
- ✅ Schedule

## 🔧 Features That Need Backend:

- ❌ Stripe Subscriptions (needs Stripe keys)
- ❌ Twilio Receptionist (needs Twilio credentials)
- ❌ AI Chat (needs OpenAI API key)

## 🆘 Still Having Issues?

### Check 1: Is the backend running?
Open your browser and visit: http://localhost:8081/api/health
You should see: `{"status":"healthy"}`

### Check 2: Are environment variables loaded?
Look at the console logs when the app starts. You should see:
```
[tRPC] Using EXPO_PUBLIC_RORK_API_BASE_URL: http://localhost:8081
```

### Check 3: Is Stripe configured?
Look at the console logs when creating subscription. You should see:
```
[Subscription] Stripe Publishable Key: Set
```

## 💡 Quick Test Mode

Want to test immediately without configuring anything? 

The app should detect missing credentials and work in "demo mode". However, the subscription creation will show an error if the backend is not reachable.

For a full test:
1. Set up the `.env` file with at least:
   - `EXPO_PUBLIC_RORK_API_BASE_URL=http://localhost:8081`
   - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`
   - `STRIPE_SECRET_KEY=sk_test_...`
2. Restart the dev server
3. Try creating an account with subscription

---

**Need more help?** Check these guides:
- `STRIPE_SETUP_GUIDE.md` - Complete Stripe setup
- `TESTING_GUIDE.md` - Testing all features
- `QUICK_START.md` - Quick start guide
