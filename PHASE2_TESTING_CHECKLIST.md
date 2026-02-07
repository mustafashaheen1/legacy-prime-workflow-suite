# Phase 2: Testing Checklist

**Deployment:** ✅ Pushed to GitHub (Vercel auto-deploy in progress)
**Time Required:** 10-15 minutes
**Status:** Ready to Test

---

## 🚀 Step 1: Wait for Vercel Deployment (2-3 minutes)

### Check Deployment Status:

**Option A: Vercel Dashboard**
1. Go to https://vercel.com/dashboard
2. Find your project: `legacy-prime-workflow-suite`
3. Check latest deployment status
4. Wait until status shows: **✅ Ready**

**Option B: Check GitHub Actions** (if configured)
1. Go to your GitHub repository
2. Click **Actions** tab
3. Latest commit should show deployment status

**Expected:**
- Deployment completes in 2-3 minutes
- Status: ✅ Ready/Success

**⚠️ If deployment fails:**
- Check build logs for TypeScript errors
- Verify all imports are correct
- Check Vercel function logs

---

## 🧪 Step 2: Test Frontend Sends Authorization Header

### Test A: Browser DevTools (Web)

**Steps:**
1. Open your app in browser: `https://your-app.vercel.app`
2. Log in with valid credentials
3. Open DevTools (F12 or Cmd+Option+I)
4. Go to **Console** tab - look for tRPC logs:
   ```
   [tRPC] ✅ Attaching JWT token to request
   ```

5. Go to **Network** tab
6. Filter: `trpc`
7. Click any tRPC request
8. Go to **Headers** tab → **Request Headers**

**Expected:**
```
authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
content-type: application/json
```

**✅ PASS:** Authorization header is present with JWT token
**❌ FAIL:** No Authorization header → See Troubleshooting Section 1

---

### Test B: Console Logs (Mobile/Web)

**Steps:**
1. Open the app
2. Log in
3. Navigate to any screen (Expenses, Photos, etc.)
4. Check console for logs

**Expected logs:**
```
[tRPC] Using window.location.origin: https://...
[tRPC] Fetching: https://.../trpc/...
[tRPC] ✅ Attaching JWT token to request
[tRPC] Response status: 200
```

**✅ PASS:** Sees "Attaching JWT token" message
**❌ FAIL:** Sees "No auth token - proceeding as unauthenticated"

---

## 🔍 Step 3: Verify Backend Extracts User

### Check Vercel Logs

**Steps:**
1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **Logs** tab (or **Functions** → **Logs**)
4. Filter by recent requests (last 5 minutes)
5. Look for tRPC Context logs

**Expected logs:**
```
[tRPC Context] Extracting user from JWT token...
[tRPC Context] JWT valid for user: user@example.com
[tRPC Context] ✅ User authenticated: {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'user@example.com',
  companyId: '789e4567-e89b-12d3-a456-426614174000',
  role: 'admin'
}
```

**✅ PASS:** User authenticated successfully
**⚠️ PARTIAL:** JWT valid but user fetch failed → Check users table
**❌ FAIL:** JWT verification failed → See Troubleshooting Section 2

---

## ✅ Step 4: Test Existing Functionality

### Test 4A: Load Expenses

**Steps:**
1. Navigate to Expenses screen
2. Verify expenses load correctly
3. Check console for errors

**Expected:**
- ✅ Expenses load normally
- ✅ No errors in console
- ✅ Backend logs show user context

**Result:** [ ] Pass / [ ] Fail

---

### Test 4B: Load Photos

**Steps:**
1. Navigate to Photos screen
2. Verify photos load correctly
3. Check for any errors

**Expected:**
- ✅ Photos display normally
- ✅ No errors

**Result:** [ ] Pass / [ ] Fail

---

### Test 4C: Create Expense (Optional)

**Steps:**
1. Try creating a new expense
2. Fill out form
3. Submit

**Expected:**
- ✅ Expense created successfully
- ⚠️ `uploaded_by` will still be NULL (Phase 3 will fix this)

**Result:** [ ] Pass / [ ] Fail

---

## 🔐 Step 5: Test Auth Enforcement

### Test 5A: Logged In User

**Steps:**
1. Ensure you're logged in
2. Perform any action (create expense, view data)
3. Check it works normally

**Expected:**
- ✅ All actions work
- ✅ No UNAUTHORIZED errors

**Result:** [ ] Pass / [ ] Fail

---

### Test 5B: Logged Out User (Expected to Fail)

**Steps:**
1. Log out of the app
2. Try to manually call an API (using Postman/Insomnia)
3. Make a request without Authorization header

**Example:**
```bash
curl -X POST https://your-app.vercel.app/trpc/expenses.addExpense \
  -H "Content-Type: application/json" \
  -d '{"projectId":"...","amount":100}'
```

**Expected:**
- ⚠️ **Currently:** Might still work (procedures are still `publicProcedure`)
- 🎯 **Phase 3:** Will fail with UNAUTHORIZED error

**Note:** We'll convert to `protectedProcedure` in Phase 3

---

## 🐛 Troubleshooting

### Section 1: No Authorization Header Sent

**Symptoms:**
- Console shows: "No auth token - proceeding as unauthenticated"
- No Authorization header in Network tab

**Possible Causes:**

**1. Not Logged In**
- **Check:** Are you actually logged in?
- **Fix:** Log in with valid credentials

**2. Session Expired**
- **Check:** Try logging out and back in
- **Fix:** Clear AsyncStorage and re-login

**3. Supabase Client Issue**
- **Check:** Browser console for Supabase errors
- **Fix:** Verify environment variables:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://...
  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
  ```

**4. getAuthToken() Failing**
- **Debug:** Add console.log in `lib/trpc.ts`:
  ```typescript
  const token = await getAuthToken();
  console.log('[DEBUG] Token:', token ? 'EXISTS' : 'NULL');
  console.log('[DEBUG] Token length:', token?.length);
  ```

---

### Section 2: JWT Verification Failed

**Symptoms:**
- Backend logs: "JWT verification failed"
- User context is null

**Possible Causes:**

**1. Wrong Supabase Service Role Key**
- **Check:** Backend uses `SUPABASE_SERVICE_ROLE_KEY`
- **Fix:** Verify in Vercel environment variables

**2. Token Format Wrong**
- **Check:** Should be `Bearer <token>`, not just `<token>`
- **Fix:** Already handled in `lib/trpc.ts`

**3. Token Expired**
- **Check:** Supabase tokens expire after 1 hour
- **Fix:** Log out and log back in

**4. Mismatched Supabase Projects**
- **Check:** Frontend and backend use same Supabase project
- **Fix:** Verify `EXPO_PUBLIC_SUPABASE_URL` matches on both

---

### Section 3: User Fetch Failed

**Symptoms:**
- Backend logs: "JWT valid" but "Failed to fetch user profile"

**Possible Causes:**

**1. User Not in Database**
- **Check:** User exists in `auth.users` but not in `public.users`
- **Fix:** Query Supabase:
  ```sql
  SELECT * FROM users WHERE email = 'user@example.com';
  ```
- Create user record if missing

**2. User is Inactive**
- **Check:** `is_active = false` in users table
- **Fix:** Update:
  ```sql
  UPDATE users SET is_active = true WHERE email = 'user@example.com';
  ```

**3. Database Connection Issue**
- **Check:** Backend can connect to Supabase
- **Fix:** Verify service role key is correct

---

## ✅ Success Checklist

Mark each item when complete:

- [ ] ✅ Code deployed to Vercel successfully
- [ ] ✅ Frontend sends Authorization header
- [ ] ✅ Backend logs show "User authenticated"
- [ ] ✅ Expenses screen loads correctly
- [ ] ✅ Photos screen loads correctly
- [ ] ✅ No TypeScript errors
- [ ] ✅ No runtime errors in console
- [ ] ✅ Existing functionality works

---

## 📊 Expected Test Results

**All tests should show:**

| Test | Expected Result | Your Result |
|------|----------------|-------------|
| 1. Deployment | ✅ Success | [ ] |
| 2A. Auth header sent | ✅ Present | [ ] |
| 2B. Console logs | ✅ "Attaching JWT token" | [ ] |
| 3. Backend logs | ✅ "User authenticated" | [ ] |
| 4A. Load expenses | ✅ Works | [ ] |
| 4B. Load photos | ✅ Works | [ ] |
| 4C. Create expense | ✅ Works | [ ] |
| 5A. Logged in actions | ✅ Works | [ ] |

---

## 🎯 After Testing

### If ALL Tests Pass ✅

**You're ready for Phase 3!**

Phase 3 will:
1. Convert procedures to `protectedProcedure`
2. Auto-capture `ctx.user.id` for `uploaded_by`
3. Update queries to return uploader info

**Next:** Tell me "All tests pass" and I'll start Phase 3!

---

### If ANY Tests Fail ❌

**Don't proceed yet!**

1. Note which test failed
2. Check the Troubleshooting section for that test
3. Share the error logs with me
4. I'll help you fix it before Phase 3

**Tell me:**
- Which test failed (number + letter)
- What error message you see
- Relevant logs (console or Vercel)

---

## 💡 Testing Tips

**Console Logs:**
- Filter by `[tRPC]` to see only relevant logs
- Clear console before testing for clean output

**Network Tab:**
- Filter by `trpc` to see only API calls
- Check both Request and Response headers

**Vercel Logs:**
- Use "Search logs" to filter by keyword
- Look for timestamps matching your test time

**Common Issues:**
- 90% of issues are: not logged in, expired session, or wrong env vars
- Always try logging out and back in first

---

**Status:** Awaiting your test results! 🧪

Let me know which tests pass/fail and I'll guide you to the next step.
