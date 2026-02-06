# Custom Folder Creation - Debugging Summary

## The Problem
Creating custom folders returns **504 Gateway Timeout** after exactly 10 seconds with **zero logs** from backend code.

## What We've Tested

### ✅ Works Fine
- **GET queries** via tRPC (`getCustomFolders`) - Completes in ~150ms
- **Local database inserts** - Completes in ~850ms
- **Database performance** - Supabase is fast and responsive
- **Frontend code** - Properly calls the mutation
- **Database schema** - Table exists and is configured correctly

### ❌ Broken
- **ALL tRPC POST mutations** - Timeout after 10s
  - `customFolders.addCustomFolder` - ❌ Timeout
  - `photoCategories.addPhotoCategory` - ❌ Timeout
  - Other mutations (not tested but likely same issue)

### What Doesn't Appear in Logs
```
[Custom Folders Module] ✓ Module loaded  ← NEVER APPEARS
[Custom Folders] ========== MUTATION CALLED ==========  ← NEVER APPEARS
```

This means the **module never loads** or the **mutation never executes**.

## Changes Made

### Attempt 1: Optimize Backend Code
- ✅ Added detailed timing logs
- ✅ Reduced timeout from 30s to 8s
- ✅ Improved error messages
- ❌ **Result:** Still times out, no logs appear

### Attempt 2: Fix Vercel Configuration
- ✅ Updated `api/index.ts` maxDuration to 10s
- ✅ Updated `vercel.json` function timeouts to 10s
- ❌ **Result:** Still times out

### Attempt 3: Disable RLS
- ✅ Disabled Row Level Security on `custom_folders` table
- ❌ **Result:** Still times out (RLS was NOT the problem)

### Attempt 4: Remove Timeout Middleware
- ✅ Removed `timeout(60000)` from Hono
- ❌ **Result:** Still times out

## Current Hypothesis

The issue is **NOT**:
- ❌ Database performance
- ❌ RLS policies
- ❌ Timeout configuration mismatch
- ❌ Backend code logic

The issue **IS**:
- ✅ Something at the **tRPC server level** for POST requests
- ✅ Module loading or routing issue specific to mutations
- ✅ Possibly an issue with `@hono/trpc-server` handling POST

## Evidence

1. **Logs stop at middleware:**
   ```
   [tRPC Middleware] About to call tRPC server...
   ... 10 seconds of silence ...
   Vercel Runtime Timeout Error
   ```

2. **No backend code executes:**
   - Module-level logs don't appear
   - Function-level logs don't appear
   - Even direct Supabase SDK calls work fine locally

3. **Pattern is consistent:**
   - GET queries: ✅ Work
   - POST mutations: ❌ Hang

## Next Steps

### Test 1: Direct Vercel Function (No tRPC)
Created `/api/test-folder-direct.ts` that bypasses tRPC entirely.

**If this works:** Problem is tRPC-specific
**If this fails:** Problem is broader (Supabase, Vercel config, etc.)

### Test 2: Simple POST Endpoint
Created `/api/test-simple-post.ts` that doesn't touch Supabase at all.

**If this works:** Problem is Supabase operations in POST context
**If this fails:** Problem is POST requests in general

## Deployment Info

- **Region:** iad1 (Washington D.C.)
- **Plan:** Pro
- **Runtime:** Node.js (via @hono/node-server/vercel)
- **Max Duration:** 10 seconds (hobby limit, even though on Pro plan)
- **Function Memory:** 2048 MB

## Files Modified

1. `backend/trpc/routes/custom-folders/add-custom-folder/route.ts`
2. `backend/hono.ts`
3. `api/index.ts`
4. `vercel.json`
5. `api/test-folder-direct.ts` (new)
6. `api/test-simple-post.ts` (new)

## Next Actions

1. Wait for deployment to complete
2. Test both new endpoints
3. Check Vercel logs for detailed output
4. Based on results, either:
   - Fix tRPC configuration if direct endpoints work
   - Investigate Vercel/Supabase connection if all POST fails
   - Escalate to Vercel support if fundamental issue
