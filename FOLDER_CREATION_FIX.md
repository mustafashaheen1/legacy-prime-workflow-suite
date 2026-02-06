# Custom Folder Creation 504 Timeout - Fix Guide

## Problem
Creating custom folders fails with **504 Gateway Timeout** error after ~10 seconds.

## Root Cause
You're on **Vercel Hobby Plan** which has a **10-second timeout limit** for serverless functions. The database insert operation is taking longer than this limit.

---

## Quick Fixes (Try in Order)

### Fix 1: Test Database Performance (RECOMMENDED FIRST)

Run this diagnostic script to measure how long the insert actually takes:

```bash
node test-custom-folder-performance.js
```

This will show you:
- Connection speed to Supabase
- Insert operation time
- Whether you're hitting the timeout

**If insert time > 8 seconds:** Your database is too slow → Try Fix 2 or 3
**If insert time < 5 seconds:** The issue is with Vercel deployment → Try Fix 4

---

### Fix 2: Disable RLS (Row Level Security) Temporarily

RLS policies can slow down inserts significantly. Test if this is the issue:

1. Go to your Supabase dashboard → SQL Editor
2. Run this command:

```sql
ALTER TABLE custom_folders DISABLE ROW LEVEL SECURITY;
```

3. Try creating a folder again
4. **If it works:** RLS was the problem. See "Fix 3: Optimize RLS Policies"
5. **If it still fails:** Continue to Fix 4

**⚠️ Warning:** Disabling RLS removes security restrictions. Only use for testing.

---

### Fix 3: Optimize RLS Policies

If disabling RLS fixed it, recreate with optimized policies:

```sql
-- Re-enable RLS
ALTER TABLE custom_folders ENABLE ROW LEVEL SECURITY;

-- Drop existing policy
DROP POLICY IF EXISTS "Enable all operations for custom_folders" ON custom_folders;

-- Create optimized policy (uses simpler check)
CREATE POLICY "Allow all authenticated operations" ON custom_folders
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

---

### Fix 4: Deploy Changes

The backend has been optimized with:
- Better logging to identify slow operations
- Reduced timeout to 8s (matching Vercel's 10s limit with buffer)
- Improved error messages

Deploy these changes:

```bash
git add .
git commit -m "Optimize custom folder creation for Vercel hobby plan"
git push
```

Then test folder creation again and check Vercel logs for detailed timing information.

---

### Fix 5: Upgrade Vercel Plan (If All Else Fails)

If database operations genuinely take 10+ seconds:

**Option A: Upgrade to Vercel Pro**
- Cost: $20/month per team member
- Benefit: 60-second timeout limit
- Link: https://vercel.com/pricing

**Option B: Optimize Database Region**
- Check if your Supabase database region matches your Vercel deployment region
- Supabase Dashboard → Settings → General → Region
- Closer regions = faster connections

---

## Verification

After applying fixes, verify the solution works:

1. **Check Deployment Logs:**
   - Go to Vercel Dashboard → Deployments → Latest → Functions
   - Look for log entries with timing information:
     ```
     [Custom Folders] ⏱️ Client created (elapsed: XXX ms)
     [Custom Folders] ✅ SUCCESS - Folder created: ... (total time: XXX ms)
     ```

2. **Test in Production:**
   - Go to your deployed app
   - Navigate to a project → Files
   - Click "Create New Folder"
   - Enter a folder name and submit
   - Should complete in < 8 seconds

3. **Check for Errors:**
   - If it fails, check browser console for detailed error message
   - Check Vercel function logs for full execution trace

---

## Current Configuration

**Backend:**
- Location: `backend/trpc/routes/custom-folders/add-custom-folder/route.ts`
- Timeout: 8 seconds
- Logging: Enhanced with timing information

**Deployment:**
- Platform: Vercel
- Plan: Hobby (10s function limit)
- Config: `api/index.ts` and `vercel.json`

**Database:**
- Provider: Supabase
- Table: `custom_folders`
- RLS: Enabled (may cause slowness)
- Index: On `project_id` column

---

## Need More Help?

1. **Run the diagnostic script first:**
   ```bash
   node test-custom-folder-performance.js
   ```

2. **Check Vercel logs:**
   - Vercel Dashboard → Deployments → Latest → Functions
   - Look for `/trpc/customFolders.addCustomFolder` entries

3. **Check Supabase logs:**
   - Supabase Dashboard → Logs Explorer
   - Filter by timestamp when folder creation failed

4. **Check this file for common patterns:**
   ```
   backend/DATABASE_PATTERNS.md
   backend/TROUBLESHOOTING_504.md
   ```

---

## Prevention

To prevent this issue in the future:

1. Always test database operations locally before deploying
2. Monitor function execution times in Vercel logs
3. Keep database queries under 5 seconds for good UX
4. Use the diagnostic script after making database schema changes
5. Consider upgrading to Vercel Pro if you frequently hit timeouts

---

## Summary of Changes Made

✅ Updated `backend/trpc/routes/custom-folders/add-custom-folder/route.ts`:
   - Added detailed timing logs
   - Reduced timeout from 30s to 8s
   - Improved error messages
   - Added duplicate folder detection

✅ Updated `api/index.ts`:
   - Changed maxDuration from 60s to 10s
   - Added comment explaining hobby plan limitation

✅ Updated `vercel.json`:
   - Standardized all function timeouts to 10s

✅ Created diagnostic script:
   - `test-custom-folder-performance.js`
   - Measures database operation speed
   - Provides recommendations

---

**Next Step:** Run `node test-custom-folder-performance.js` to diagnose the exact cause.
