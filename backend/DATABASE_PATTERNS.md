# Database Patterns Guide

## ⚠️ CRITICAL: Never Use Raw HTTP Fetch for Database Operations

This guide was created after the `addCustomFolder` route experienced repeated 504 timeouts because it was "fixed" by replacing the Supabase SDK with raw HTTP fetch. **This is an anti-pattern.**

## Why This Guide Exists

User feedback: "This issue has been happening every single time I have to store anything in the db"

Root cause: Inconsistent database access patterns led to unreliable INSERT operations and 504 timeouts.

---

## Standard Patterns

### Pattern 1: Standard INSERT (Use This for Most Cases)

**When to use**: Default for all INSERT operations

**Example**: From `backend/trpc/routes/tasks/add-task/route.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

export const addTaskProcedure = publicProcedure
  .input(z.object({ /* ... */ }))
  .mutation(async ({ input }) => {
    // Always create client INSIDE handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Database not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('table_name')
      .insert({ /* data */ })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('No data returned from insert');
    }

    return { success: true, data };
  });
```

**Key points**:
- ✅ Use `createClient` from '@supabase/supabase-js'
- ✅ Create client INSIDE mutation handler
- ✅ Always use `.select().single()` to return inserted data
- ✅ Check both `error` AND `!data`
- ✅ Use try-catch for unexpected errors

**Reference files**:
- `backend/trpc/routes/tasks/add-task/route.ts`
- `backend/trpc/routes/crm/add-client/route.ts`
- `backend/trpc/routes/expenses/add-expense/route.ts`
- `backend/trpc/routes/photo-categories/add-photo-category/route.ts`

---

### Pattern 2: INSERT with Timeout Protection (Use for Critical Operations)

**When to use**: For operations that have experienced timeouts or are mission-critical

**Example**: From `backend/trpc/routes/projects/add-project/route.ts`

```typescript
const insertStart = Date.now();

const { data, error } = await Promise.race([
  supabase
    .from('table_name')
    .insert({ /* data */ })
    .select()
    .single(),
  new Promise<any>((_, reject) =>
    setTimeout(() => reject(new Error('Insert query timeout after 30 seconds')), 30000)
  )
]);

const insertDuration = Date.now() - insertStart;
console.log('[Route] Insert completed in', insertDuration, 'ms');
```

**Key points**:
- ✅ All benefits of Pattern 1
- ✅ Explicit 30-second timeout
- ✅ Logs execution time
- ✅ Fails fast if Supabase hangs

**Reference files**:
- `backend/trpc/routes/projects/add-project/route.ts`
- `backend/trpc/routes/custom-folders/add-custom-folder/route.ts`

---

### Pattern 3: Optimized INSERT (Advanced)

**When to use**: Performance-critical operations where you can pre-generate IDs

**Example**: From `backend/trpc/routes/price-list/add-price-list-item/route.ts`

```typescript
import { randomUUID } from 'crypto';

const itemId = randomUUID();
const now = new Date().toISOString();

const { error } = await supabase
  .from('table_name')
  .insert({
    id: itemId,
    created_at: now,
    /* other data */
  });

// Return pre-generated data (no .select() needed)
return {
  success: true,
  item: { id: itemId, createdAt: now, /* other fields */ }
};
```

**Key points**:
- ✅ Only one query (faster than Pattern 1)
- ✅ No `.select()` needed
- ✅ Best performance
- ⚠️ Requires table to allow custom ID insertion

**Reference file**: `backend/trpc/routes/price-list/add-price-list-item/route.ts`

---

## Anti-Patterns to AVOID

### ❌ DON'T: Use Raw HTTP Fetch

```typescript
// WRONG - This causes 504 timeouts
const response = await fetch(`${supabaseUrl}/rest/v1/table`, {
  method: 'POST',
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
  body: JSON.stringify(data),
});
```

**Why this fails**:
- No connection pooling
- No retry logic
- More prone to cold starts
- Manual header management
- Harder to debug
- **All 504 errors in this codebase came from this pattern**

### ❌ DON'T: Create Client at Module Level

```typescript
// WRONG - Causes issues in serverless
const supabase = createClient(url, key);

export const procedure = publicProcedure.mutation(async () => {
  await supabase.from('table').insert(data); // Bad!
});
```

**Why this fails**: Serverless environments may reuse the module but with stale connections.

### ❌ DON'T: Skip Error Checking

```typescript
// WRONG - Always check error AND data
const { data } = await supabase.from('table').insert(data);
return data; // Might be null even without error!
```

---

## Troubleshooting 504 Errors

### Step 1: Check Your Pattern

**Are you using raw `fetch()`?**
→ STOP. Replace with Supabase SDK (Pattern 1 or 2)

**Are you using `.select().single()`?**
→ Good! If still timing out, add timeout protection (Pattern 2)

### Step 2: Add Timeout Protection

If Pattern 1 times out, upgrade to Pattern 2:
- Add Promise.race with 30-second timeout
- Log execution time
- Monitor logs for slow queries

### Step 3: Check Environment Variables

```typescript
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Database not configured');
}
```

Verify in Vercel dashboard:
- `EXPO_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Step 4: Test Locally

```bash
vercel dev
```

Check console logs for timing. If >5 seconds, something is wrong.

---

## Decision Tree

```
Need to INSERT data?
│
├─ Is it a critical operation or has it timed out before?
│  ├─ YES → Use Pattern 2 (with timeout)
│  └─ NO → Use Pattern 1 (standard)
│
├─ Need maximum performance and can pre-generate IDs?
│  └─ Use Pattern 3 (optimized)
│
└─ DON'T use raw fetch() under any circumstances
```

---

## Quick Reference

**Standard INSERT** (most common):
```typescript
const { data, error } = await supabase
  .from('table').insert(data).select().single();
```

**With timeout** (for critical ops):
```typescript
const { data, error } = await Promise.race([
  supabase.from('table').insert(data).select().single(),
  new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
]);
```

**Optimized** (advanced):
```typescript
const id = randomUUID();
const { error } = await supabase.from('table').insert({ id, ...data });
return { id, ...data }; // No .select() needed
```

---

## When in Doubt

1. Find a similar working route in `backend/trpc/routes/`
2. Copy its pattern exactly
3. Adjust table name and fields
4. Test thoroughly
5. Monitor logs for timing

**Remember**: All working INSERT routes use Supabase SDK. Routes that used `fetch()` had 504 errors.
