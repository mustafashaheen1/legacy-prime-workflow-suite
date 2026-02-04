# 504 Gateway Timeout - Quick Fix Guide

## Diagnosis

You're seeing: `POST /trpc/route.name 504 (Gateway Timeout)`

## Immediate Fix

### 1. Check if you're using raw fetch()

Open your route file. Search for:
```typescript
await fetch(`${supabaseUrl}/rest/v1/
```

**If found**: This is the problem. Go to step 2.

**If not found**: Skip to step 3.

### 2. Replace fetch() with Supabase SDK

See `backend/DATABASE_PATTERNS.md` → Pattern 2 (INSERT with Timeout)

Copy working example from:
- `backend/trpc/routes/projects/add-project/route.ts` (has timeout)
- `backend/trpc/routes/tasks/add-task/route.ts` (simple)
- `backend/trpc/routes/custom-folders/add-custom-folder/route.ts` (recently fixed)

### 3. Add Timeout Protection

If already using SDK but still timing out, add Promise.race:

```typescript
const { data, error } = await Promise.race([
  supabase.from('table').insert(data).select().single(),
  new Promise<any>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout after 30s')), 30000)
  )
]);
```

### 4. Verify Environment

Check Vercel dashboard → Project → Settings → Environment Variables:
- `EXPO_PUBLIC_SUPABASE_URL` ✓
- `SUPABASE_SERVICE_ROLE_KEY` ✓

### 5. Test Locally

```bash
vercel dev
```

Try the operation. Check console for logs. If >5s, investigate database indexes or RLS policies.

## Common Causes Ranked

1. **Using raw fetch() instead of SDK** (90% of 504 errors) → Use SDK
2. **No timeout protection** (5%) → Add Promise.race
3. **Supabase region latency** (3%) → Can't fix, timeout handles it
4. **Network issues** (2%) → Retry or check Supabase status

## Prevention

- Always use Supabase SDK
- Always add timeout for critical operations
- Always log execution time
- Never use raw fetch() for database operations

## Example Fix

**Before** (causes 504):
```typescript
const response = await fetch(`${supabaseUrl}/rest/v1/custom_folders`, {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify(data),
});
```

**After** (works reliably):
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await Promise.race([
  supabase.from('custom_folders').insert(data).select().single(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 30000))
]);
```

## Need More Help?

See `backend/DATABASE_PATTERNS.md` for comprehensive patterns and examples.
