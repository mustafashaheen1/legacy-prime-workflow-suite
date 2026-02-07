# Phase 2B: Standalone API Auth - Complete

**Status:** ✅ Ready to Deploy
**Purpose:** Add JWT authentication to standalone API endpoints
**Why:** App uses both tRPC AND standalone endpoints - need auth for both

---

## 🎯 What Phase 2B Does

Adds JWT authentication to standalone API endpoints (`/api/add-expense`, `/api/save-photo`) so they can:
- ✅ Extract user from Authorization header
- ✅ Verify user is authenticated
- ✅ Capture `uploaded_by` automatically
- ✅ Use `companyId` from JWT (security improvement)

---

## 📦 Files Modified

### 1. **New: Auth Helper** ✅
**File:** `api/lib/auth-helper.ts` (NEW)

**Functions:**
- `extractUserFromRequest(req)` - Extract user from JWT
- `requireAuth(req)` - Throw error if not authenticated
- `requireAdmin(req)` - Require admin role

**Usage:**
```typescript
import { requireAuth } from './lib/auth-helper';

const authUser = await requireAuth(req);
// Now have: authUser.id, authUser.companyId, authUser.role, etc.
```

---

### 2. **Updated: Add Expense Endpoint** ✅
**File:** `api/add-expense.ts`

**Changes:**
- ✅ Import `requireAuth`
- ✅ Extract user at start of handler
- ✅ Return 401 if not authenticated
- ✅ Use `authUser.companyId` instead of input
- ✅ Store `authUser.id` in `uploaded_by` field
- ✅ Log authenticated user

---

### 3. **Updated: Save Photo Endpoint** ✅
**File:** `api/save-photo.ts`

**Changes:**
- ✅ Import `requireAuth`
- ✅ Extract user at start of handler
- ✅ Return 401 if not authenticated
- ✅ Use `authUser.companyId` from JWT
- ✅ Store `authUser.id` in `uploaded_by` field

---

### 4. **Updated: Frontend - Add Expense** ✅
**File:** `contexts/AppContext.tsx` (addExpense function)

**Changes:**
- ✅ Import `supabase` from lib
- ✅ Get JWT token from session
- ✅ Attach `Authorization: Bearer <token>` header
- ✅ Remove `companyId` from request body (comes from JWT)
- ✅ Warn if no token available

---

### 5. **Updated: Frontend - Add Photo** ✅
**File:** `contexts/AppContext.tsx` (addPhoto function)

**Changes:**
- ✅ Get JWT token from session
- ✅ Attach `Authorization` header
- ✅ Remove `companyId` from body

---

## 🔐 Security Improvements

### Before Phase 2B:
```typescript
// ❌ Company ID from request body (can be spoofed!)
const { companyId, projectId, amount } = req.body;

await supabase.from('expenses').insert({
  company_id: companyId, // Spoofable!
  // No uploaded_by tracking
});
```

### After Phase 2B:
```typescript
// ✅ Company ID from JWT (secure!)
const authUser = await requireAuth(req);
const companyId = authUser.companyId; // From verified JWT

await supabase.from('expenses').insert({
  company_id: companyId,      // Secure - from JWT
  uploaded_by: authUser.id,   // Auto-tracked!
});
```

**Security Benefits:**
1. ✅ **Can't spoof company ID** - comes from verified JWT
2. ✅ **Automatic user tracking** - every upload has uploader ID
3. ✅ **Centralized auth** - reusable helper function
4. ✅ **401 errors** if not authenticated

---

## 🧪 Testing Phase 2B

### Before Testing:
1. Deploy to Vercel (push to GitHub)
2. Wait for deployment to complete
3. Log in to the app

### Test 1: Add Expense with Auth

**Steps:**
1. Log in to the app
2. Go to Expenses screen
3. Add a new expense (use a real project with valid UUID!)
4. Check browser Network tab

**Expected:**
- Request to `/api/add-expense` includes `authorization: Bearer ...` header
- Response: `200 OK` with expense data
- Backend logs: `[AddExpense] ✅ Authenticated user: user@example.com`

### Test 2: Add Photo with Auth

**Steps:**
1. Go to Photos screen
2. Upload a photo
3. Check Network tab

**Expected:**
- Request to `/api/save-photo` includes `authorization: Bearer ...` header
- Response: `200 OK` with photo data
- Backend logs: `[SavePhoto] ✅ Authenticated user: user@example.com`

### Test 3: Verify uploaded_by is Captured

**Run in Supabase SQL Editor:**
```sql
-- Check recent expenses
SELECT id, store, amount, uploaded_by, created_at
FROM expenses
ORDER BY created_at DESC
LIMIT 5;

-- Check recent photos
SELECT id, category, uploaded_by, created_at
FROM photos
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
- New records have `uploaded_by` populated with valid UUID
- Old records have `uploaded_by = NULL` (expected)

---

## 🐛 Known Issues

### Issue: projectId "1" Error

**Error:** `invalid input syntax for type uuid: "1"`

**Cause:** Mock data or test project with ID "1"

**Fix:**
Make sure you're selecting a **real project** with valid UUID:
```
Real UUID: 3fd6f909-5c10-45eb-98af-83eb26879eec
Invalid: "1", "test", etc.
```

---

## ✅ Phase 2B Complete Checklist

- [x] ✅ Created `api/lib/auth-helper.ts`
- [x] ✅ Updated `api/add-expense.ts`
- [x] ✅ Updated `api/save-photo.ts`
- [x] ✅ Updated frontend `addExpense` to send auth header
- [x] ✅ Updated frontend `addPhoto` to send auth header
- [ ] ⏳ Deployed to Vercel
- [ ] ⏳ Tested add expense with auth
- [ ] ⏳ Tested add photo with auth
- [ ] ⏳ Verified `uploaded_by` is populated

---

## 📊 Phase Progress

- ✅ **Phase 1:** Database migration (100%)
- ✅ **Phase 2:** tRPC context (100%)
- ✅ **Phase 2B:** Standalone API auth (100%) ← **You are here!**
- ⏳ **Phase 3:** Update GET queries (return uploader info)
- ⏳ **Phase 4:** Type updates
- ⏳ **Phase 5:** Frontend components (UploaderBadge)
- ⏳ **Phase 6:** UI integration

**Overall:** ~50% complete (backend done, frontend UI pending)

---

## 🚀 Next: Phase 3

Once Phase 2B tests pass, we'll update the GET queries:

**Phase 3: Return Uploader Info**
1. Update `api/get-expenses` to JOIN with users table
2. Update tRPC `getExpenses` to JOIN with users
3. Update `getPhotos` procedures (both standalone + tRPC)
4. Return uploader data: `{ id, name, avatar, email }`

**Time:** 15-20 minutes

---

**Deploy and test Phase 2B, then let me know the results!** 🧪
