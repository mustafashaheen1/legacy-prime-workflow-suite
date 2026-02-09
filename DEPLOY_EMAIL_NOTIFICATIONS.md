# 🚀 Deployment Instructions - Email + SMS Notifications

## **Quick Deployment Steps**

### **1. Get Resend API Key**

1. Go to https://resend.com
2. Sign up (free - 3,000 emails/month)
3. Go to API Keys
4. Click "Create API Key"
5. Copy the key (starts with `re_`)

### **2. Update Environment Variables**

#### **Local Development (.env.local)**
Already updated! Just replace the placeholder:
```bash
RESEND_API_KEY="re_YOUR_ACTUAL_KEY_HERE"
```

#### **Vercel Production**
1. Go to https://vercel.com/dashboard
2. Select project: `legacy-prime-workflow-suite`
3. Go to Settings → Environment Variables
4. Add these 3 variables:

```
RESEND_API_KEY = re_your_key_here
EMAIL_FROM_NAME = Legacy Prime Workflow Suite
EMAIL_FROM_ADDRESS = onboarding@resend.dev
```

(Note: `onboarding@resend.dev` is free to use for testing)

### **3. Run Database Migration**

Go to Supabase Dashboard:
1. Open https://supabase.com/dashboard
2. Select your project: `qwzhaexlnlfovrwzamop`
3. Go to SQL Editor
4. Copy contents of `supabase/migrations/20260209_create_estimate_requests.sql`
5. Paste and click **Run**
6. Verify: Should see "Success. No rows returned"

### **4. Install Dependencies**

```bash
cd /Users/codercrew/Downloads/legacy-prime-workflow-suite
bun add resend @aws-sdk/client-ses
```

### **5. Test Locally**

```bash
# Start development server
bun run dev

# Open in browser
# http://localhost:8081

# Test:
# 1. Go to a project page
# 2. Click "Request Estimate"
# 3. Select subcontractor
# 4. Fill form
# 5. Send request
# 6. Check console for [Email] logs
```

### **6. Deploy to Production**

```bash
# Commit all changes
git add .
git commit -m "Add email + SMS notifications for estimate requests

- Add Resend email service integration
- Send both SMS and Email to subcontractors
- Beautiful HTML email template (responsive)
- Fallback to AWS SES if Resend fails
- Track notification delivery status
- Update UI to show email/SMS status
- Cross-platform support (iOS, Android, Web)

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"

# Push to deploy
git push origin main
```

Vercel will automatically deploy in ~2 minutes.

### **7. Verify Deployment**

1. Open https://legacy-prime-workflow-suite.vercel.app
2. Go to any project page
3. Send an estimate request
4. Check:
   - ✅ Success message shows "SMS sent" and "Email sent"
   - ✅ Subcontractor receives SMS
   - ✅ Subcontractor receives email
   - ✅ Email looks professional

### **8. Monitor**

Check Resend Dashboard:
- https://resend.com/emails
- View sent emails
- Check delivery status
- Monitor any errors

---

## **Troubleshooting**

### **Issue: Email not sending**

**Check:**
```bash
# Verify RESEND_API_KEY is set
vercel env ls

# Check Vercel function logs
vercel logs
```

**Solution:**
- Make sure API key is correct
- Check Resend dashboard for errors
- Falls back to AWS SES automatically

### **Issue: SMS not sending**

**Check Twilio credentials:**
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_PHONE_NUMBER

### **Issue: Database error**

**Check migration:**
```sql
-- In Supabase SQL Editor
SELECT * FROM estimate_requests LIMIT 1;
```

If table doesn't exist, re-run migration.

---

## **Success Criteria**

After deployment, verify:

- ✅ `estimate_requests` table exists in Supabase
- ✅ Can send estimate request from UI
- ✅ SMS received by subcontractor
- ✅ Email received by subcontractor
- ✅ Email displays correctly on mobile
- ✅ Success message shows both notifications
- ✅ Request appears in database
- ✅ Works on iOS app
- ✅ Works on Android app
- ✅ Works on web

---

## **What Was Deployed**

### **New Files:**
- `backend/lib/email-service.ts` - Email sending service
- `supabase/migrations/20260209_create_estimate_requests.sql` - Database schema

### **Modified Files:**
- `backend/trpc/routes/subcontractors/request-estimate/route.ts` - Added DB + notifications
- `components/RequestEstimate.tsx` - Added tRPC integration + loading states
- `.env.local` - Added email config

### **New Features:**
- ✅ Database persistence (estimate_requests table)
- ✅ SMS notifications via Twilio
- ✅ Email notifications via Resend
- ✅ Beautiful responsive HTML email template
- ✅ Fallback to AWS SES
- ✅ Status tracking (pending → sent → viewed → responded)
- ✅ Notification delivery tracking
- ✅ Loading states in UI
- ✅ Better error messages
- ✅ Cross-platform support

---

## **Post-Deployment Tasks**

### **Optional: Custom Email Domain**

For production, set up custom domain:

1. In Resend dashboard → Domains
2. Add your domain (e.g., `legacyprime.com`)
3. Add DNS records (provided by Resend)
4. Verify domain
5. Update env var:
```
EMAIL_FROM_ADDRESS=notifications@legacyprime.com
```

### **Optional: Monitor Email Delivery**

Set up webhook in Resend for email events:
- delivered
- opened
- clicked
- bounced

---

**Deployment complete! 🎉**
# Email API configured
