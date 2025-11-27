# Testing Guide - Subscription & Authentication Flow

## Overview
Your app now has a complete authentication and subscription system integrated with Stripe (in Test Mode). This guide will help you test all features.

## Current Status
✅ Stripe keys configured (Test Mode)
✅ Login/Signup interfaces ready
✅ Subscription payment flow integrated
✅ Company and Employee account types
✅ Logout functionality added
✅ Twilio integration ready

## Testing the Complete Flow

### 1. Logout from Current Session
1. Navigate to the **Settings** tab (bottom right)
2. Scroll down and tap the **"Logout"** button
3. Confirm logout
4. You'll be redirected to the Login screen

### 2. Test Company Account Creation with Subscription

#### Step 1: Navigate to Signup
1. On the Login screen, tap **"Create Account"**
2. You'll see two options:
   - **Company Account** (for business owners)
   - **Employee Account** (for team members)

#### Step 2: Select Company Account
1. Tap **"Company Account"**
2. Fill in the form:
   - Full Name: `John Doe`
   - Email: `john@example.com`
   - Password: `password123`
   - Confirm Password: `password123`
   - Company Name: `ABC Construction`
   - Employee Count: `5` (this affects pricing)
3. Tap **"Create Account"**

#### Step 3: Choose Subscription Plan
You'll be redirected to the subscription page with two plans:

**Basic Plan:**
- Base: $10/month
- Per employee: $8/month
- For 5 employees: $10 + (4 × $8) = **$42/month**
- Features: Dashboard, CRM, Expenses, Photos, Estimates

**Premium Plan (Recommended):**
- Base: $20/month
- Per employee: $15/month
- For 5 employees: $20 + (4 × $15) = **$80/month**
- Features: Everything in Basic + Schedule, Chat, Reports, Clock In/Out

Select a plan and tap **"Crear Cuenta"**

#### Step 4: Payment (Test Mode)

**On Mobile (iOS/Android):**
- Stripe Payment Sheet will appear
- Use test card: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., `12/25`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

**On Web:**
- You'll see a simulation alert (Payment Sheet only works on mobile)
- The account will be created for testing purposes

#### Step 5: Success
After successful payment:
- Your company account is created
- You'll receive a **Company Code** (e.g., `XYZ123`)
- Save this code! Employees need it to register
- You'll be redirected to the Dashboard

### 3. Test Employee Account Creation

#### Step 1: Logout Again
1. Go to Settings → Logout
2. Return to Login screen

#### Step 2: Create Employee Account
1. Tap **"Create Account"**
2. Select **"Employee Account"**
3. Fill in the form:
   - Full Name: `Jane Smith`
   - Email: `jane@example.com`
   - Password: `password123`
   - Confirm Password: `password123`
   - Company Code: `[Use the code from company creation]`
4. Tap **"Create Account"**

#### Step 3: Verification
- The app validates the company code
- Checks if company has active subscription
- Links employee to the company
- Redirects to Dashboard

### 4. Test Login Flow
1. Logout
2. On Login screen, enter credentials
3. Tap **"Login"** or use social login (Google/Apple)
4. Access the Dashboard

## Stripe Test Cards

### Success Scenarios
| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Succeeds and processes payment |
| `5555 5555 5555 4444` | Succeeds (Mastercard) |

### Failure Scenarios (for testing error handling)
| Card Number | Result |
|-------------|--------|
| `4000 0000 0000 0002` | Card declined |
| `4000 0000 0000 9995` | Insufficient funds |
| `4000 0000 0000 0069` | Charge expired |

**For all test cards:**
- Use any future expiry date
- Use any 3-digit CVC
- Use any ZIP code

## Features to Test

### 1. Dashboard
- View projects
- See financial stats
- Navigate to different sections

### 2. CRM
- Add clients
- Send inspection links
- Track leads

### 3. Subscription Features
Check what features are available based on your plan:
- **Basic**: Dashboard, CRM, Expenses, Photos
- **Premium**: All Basic features + Schedule, Chat, Reports, Clock

### 4. Twilio Integration (Receptionist)
Your Twilio account is approved! Test:
- Make calls from CRM
- Send SMS to clients
- Use the virtual receptionist

### 5. Team Management (Admin Only)
- Go to Settings
- View team members
- Change user roles (if you're admin)

## Environment Variables Check

Make sure these are set in your environment:

```bash
# Stripe (Test Mode)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Twilio (if testing calls/SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

## Troubleshooting

### "No subscription found" error
- Make sure you completed the payment flow
- Check that company.subscriptionStatus is 'active' or 'trial'

### "Company code invalid" error
- Verify the company code is correct (case-sensitive)
- Ensure the company account was created successfully

### Payment Sheet not appearing (Mobile)
- Verify EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is set
- Restart the Expo Go app
- Check console for initialization errors

### Web shows simulation alert
- This is expected! Payment Sheet only works on native mobile
- For production web, you'll need Stripe Elements integration

## Next Steps

1. **Test all features** with both Company and Employee accounts
2. **Verify Stripe Dashboard**: Check test payments at https://dashboard.stripe.com/test/payments
3. **Test Twilio**: Make calls and send SMS
4. **Role Management**: Test permissions for different roles
5. **Production Readiness**: When ready, switch Stripe keys from test to live mode

## Production Checklist

Before going live:
- [ ] Switch Stripe keys to live mode (pk_live_... and sk_live_...)
- [ ] Configure real OAuth credentials for Google/Apple Sign-In
- [ ] Set up proper email verification
- [ ] Configure Twilio with production phone number
- [ ] Test on real devices (iOS and Android)
- [ ] Set up proper error monitoring
- [ ] Review security: API keys, authentication tokens
- [ ] Configure proper webhook endpoints for Stripe

## Support

If you encounter any issues:
1. Check the browser/app console for errors
2. Verify all environment variables are set correctly
3. Ensure you're using the test card numbers correctly
4. Check Stripe Dashboard for payment logs

---

**Ready to test!** Start by logging out from Settings and trying the complete signup flow as a Company owner.
