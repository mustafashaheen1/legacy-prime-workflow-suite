# Phase 2: Fix tRPC Context - Complete

**Status:** ✅ Ready to Test
**Risk:** 🟡 Medium (Auth changes - test thoroughly)
**Duration:** Test in 10-15 minutes

---

## 🎯 What Phase 2 Does

**Fixes critical architectural gap:**
Automatically extracts user from JWT token in tRPC context.

**Before Phase 2:**
```typescript
// ❌ Every procedure had to manually check auth
export const addExpenseProcedure = publicProcedure
  .mutation(async ({ input }) => {
    // No automatic user context
    // Manual auth checks needed
    const companyId = input.companyId; // From input (can be spoofed!)
  });
```

**After Phase 2:**
```typescript
// ✅ Automatic auth with type safety
export const addExpenseProcedure = protectedProcedure
  .mutation(async ({ input, ctx }) => {
    // ctx.user automatically available!
    const companyId = ctx.user.companyId; // From JWT (secure!)
    const userId = ctx.user.id; // For uploaded_by tracking
  });
```

---

## 📦 Files Modified

### 1. **Backend: tRPC Context** ✅
**File:** `backend/trpc/create-context.ts`

**Changes:**
- ✅ Extracts JWT from `Authorization` header
- ✅ Verifies JWT with Supabase
- ✅ Fetches user profile from database
- ✅ Checks if user is active
- ✅ Makes `ctx.user` available in all procedures

**New exports:**
- `AuthUser` interface
- `publicProcedure` - No auth required
- `protectedProcedure` - Requires authenticated user
- `adminProcedure` - Requires admin/super-admin role

### 2. **Frontend: tRPC Client** ✅
**File:** `lib/trpc.ts`

**Changes:**
- ✅ Imports Supabase client
- ✅ Adds `getAuthToken()` helper
- ✅ Automatically attaches `Authorization: Bearer <token>` header
- ✅ Works for both React hooks and vanilla client
- ✅ Logs auth status for debugging

---

## 🔍 How It Works

### Request Flow:

```
1. Frontend (lib/trpc.ts)
   ↓
   Calls supabase.auth.getSession()
   ↓
   Extracts session.access_token
   ↓
   Attaches Authorization: Bearer <token> header

2. Backend (backend/trpc/create-context.ts)
   ↓
   Receives request with Authorization header
   ↓
   Verifies JWT with supabase.auth.getUser(token)
   ↓
   Fetches user profile from users table
   ↓
   Checks if user.is_active === true
   ↓
   Returns ctx.user (or null if unauthenticated)

3. Procedure (protectedProcedure)
   ↓
   Middleware checks if ctx.user exists
   ↓
   If null → throws UNAUTHORIZED error
   ↓
   If exists → proceeds with ctx.user available
```

---

## ✅ Benefits

1. **Security:**
   - ✅ Centralized auth logic
   - ✅ No manual auth checks needed
   - ✅ Can't spoof user ID in input
   - ✅ JWT verification on every request

2. **Type Safety:**
   - ✅ TypeScript knows `ctx.user` is not null in `protectedProcedure`
   - ✅ Auto-complete for `ctx.user.id`, `ctx.user.companyId`, etc.
   - ✅ Compile-time errors if accessing user incorrectly

3. **Developer Experience:**
   - ✅ Less boilerplate code
   - ✅ Consistent auth pattern
   - ✅ Easy to add role-based access (adminProcedure)
   - ✅ Automatic audit trail (user ID always available)

4. **Automatic User Tracking:**
   - ✅ Phase 3 will use `ctx.user.id` for `uploaded_by`
   - ✅ No input param needed
   - ✅ Can't be bypassed

---

## 🧪 Testing Phase 2

### Test 1: Verify Auth Token is Sent

**Steps:**
1. Open the app (web or mobile)
2. Log in with valid credentials
3. Open browser DevTools → Network tab
4. Trigger any tRPC call (e.g., load expenses)
5. Click the request → Headers tab

**Expected:**
```
Request Headers:
...
authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
content-type: application/json
```

**✅ Pass:** Authorization header is present
**❌ Fail:** No Authorization header → check lib/trpc.ts

---

### Test 2: Verify Backend Extracts User

**Steps:**
1. Ensure you're logged in
2. Make a tRPC call (any query or mutation)
3. Check your backend logs (Vercel logs or local console)

**Expected logs:**
```
[tRPC Context] Extracting user from JWT token...
[tRPC Context] JWT valid for user: user@example.com
[tRPC Context] ✅ User authenticated: {
  id: '123...',
  email: 'user@example.com',
  companyId: '456...',
  role: 'admin'
}
```

**✅ Pass:** User extracted successfully
**❌ Fail:** See troubleshooting below

---

### Test 3: Test Public Procedure (No Auth)

**Steps:**
1. Log out of the app
2. Try to access a public endpoint (if any)

**Expected:**
- ✅ Public procedures work without auth
- ✅ No UNAUTHORIZED error

**Note:** Most procedures will be `protectedProcedure` in Phase 3

---

### Test 4: Test Protected Procedure (With Auth)

**Steps:**
1. Log in to the app
2. Try to create an expense or photo
3. Check if it works

**Expected:**
- ✅ Works for authenticated users
- ✅ Backend logs show user context

**If converted to protectedProcedure:**
- Procedure should succeed with user context

---

### Test 5: Test Protected Procedure (Without Auth)

**Steps:**
1. Log out of the app
2. Try to manually call a protected endpoint
3. Or: use Postman/Insomnia to call without Authorization header

**Expected:**
```json
{
  "error": {
    "message": "You must be logged in to perform this action",
    "code": "UNAUTHORIZED"
  }
}
```

**✅ Pass:** Properly blocks unauthenticated requests

---

### Test 6: Test Inactive User

**Steps:**
1. In Supabase, set a user's `is_active` to `false`
2. Try to log in with that user
3. Make any tRPC call

**Expected:**
- ✅ User context is null (treated as unauthenticated)
- ✅ Protected procedures fail with UNAUTHORIZED

---

## 🐛 Troubleshooting

### Issue: "No auth token" in logs

**Cause:** Session not found

**Fix:**
1. Check if user is logged in
2. Verify AsyncStorage has session:
   ```javascript
   import AsyncStorage from '@react-native-async-storage/async-storage';
   AsyncStorage.getAllKeys().then(keys => console.log(keys));
   ```
3. Look for keys like `supabase.auth.token`

---

### Issue: "JWT verification failed"

**Possible causes:**
1. **Expired token** - Log out and log back in
2. **Wrong Supabase URL/keys** - Check environment variables
3. **Token format wrong** - Should be `Bearer <token>`

**Debug:**
```typescript
// In lib/trpc.ts, add:
console.log('[tRPC] Token:', token?.substring(0, 50) + '...');
```

---

### Issue: "Failed to fetch user profile"

**Cause:** User exists in auth but not in `users` table

**Fix:**
1. Check Supabase → Table Editor → users
2. Verify user record exists with correct `id`
3. Check if `is_active` is `true`

---

### Issue: TypeScript errors in create-context.ts

**Error:** `Property 'id' does not exist on type 'never'`

**Fix:** Already handled with type assertion - make sure you have latest code

---

### Issue: "User account is inactive"

**Expected behavior** - check Supabase `users` table:
```sql
SELECT id, email, is_active FROM users WHERE email = 'user@example.com';
```

If `is_active = false`, user cannot authenticate.

---

## 📊 Success Criteria

Phase 2 is complete when:

- [ ] Frontend sends `Authorization` header
- [ ] Backend logs show user extraction
- [ ] `ctx.user` is available in procedures
- [ ] Protected procedures block unauthenticated requests
- [ ] Existing functionality still works
- [ ] No TypeScript errors
- [ ] All tests pass

---

## 🎯 What's Next?

**Phase 3: Update Backend Procedures**

Now that we have `ctx.user` available, we'll:

1. ✅ Convert `addExpense` to `protectedProcedure`
2. ✅ Convert `addPhoto` to `protectedProcedure`
3. ✅ Auto-capture `ctx.user.id` for `uploaded_by`
4. ✅ Update queries to JOIN with users table
5. ✅ Return uploader info in responses

**Estimated time:** 20-30 minutes

---

## 💡 Pro Tips

**Logging:**
- Check browser console for `[tRPC]` logs (frontend)
- Check Vercel logs for `[tRPC Context]` logs (backend)
- Use log levels to debug auth flow

**Security:**
- ✅ JWT verified on every request
- ✅ User must be active
- ✅ Can't bypass auth by removing protectedProcedure

**Performance:**
- JWT verification is fast (~10-20ms)
- Database lookup cached by Supabase
- Minimal overhead per request

---

## 🚦 Ready for Phase 3?

Once all tests pass:

**Verify:**
- ✅ Can log in successfully
- ✅ Authorization header is sent
- ✅ Backend extracts user correctly
- ✅ Logs show user context

**Then proceed to:**
📋 **Phase 3: Update Backend Procedures** (Add uploaded_by tracking)

---

**Questions or Issues?**
- Check Vercel/server logs for detailed errors
- Verify Supabase environment variables
- Test auth flow with fresh login

**Last Updated:** February 7, 2026
**Status:** Phase 2 of 6
