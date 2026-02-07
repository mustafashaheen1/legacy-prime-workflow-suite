# Phase 1: Database Migration Guide

**Feature:** Show Uploader Profile on Expenses & Photos
**Migration Date:** February 7, 2026
**Status:** ✅ Ready to Deploy
**Risk Level:** 🟢 Low (Zero Downtime)

---

## 📋 Pre-Migration Checklist

Before running the migration, verify:

- [ ] You have access to Supabase Dashboard
- [ ] You have `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] You're running this in **staging/dev environment first** (recommended)
- [ ] You have a database backup (Supabase auto-backups daily, but verify)
- [ ] All team members are aware of the maintenance window (optional - zero downtime)

---

## 🚀 Running the Migration

### Option 1: Supabase Dashboard (Recommended for First Time)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Navigate to **SQL Editor** (left sidebar)

2. **Load Migration File**
   - Click **"+ New Query"**
   - Copy the contents of `supabase/migrations/20260207_add_uploaded_by.sql`
   - Paste into the SQL editor

3. **Review the SQL**
   - Read through the migration (it's heavily commented)
   - Understand what each section does
   - Note: Backfill sections are commented out (safe)

4. **Execute Migration**
   - Click **"Run"** button (or press `Cmd/Ctrl + Enter`)
   - Wait for confirmation message
   - Should complete in 1-5 seconds (depending on data volume)

5. **Verify Success**
   - You should see: `Success. No rows returned`
   - No error messages
   - Scroll down to verification section

### Option 2: Supabase CLI (For CI/CD or Advanced Users)

```bash
# If you have Supabase CLI installed:
cd /Users/codercrew/Downloads/legacy-prime-workflow-suite

# Login to Supabase (if not already)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Push migration to remote database
supabase db push

# Or manually run the migration:
supabase db execute --file supabase/migrations/20260207_add_uploaded_by.sql
```

---

## ✅ Post-Migration Verification

### Step 1: Verify Columns Exist

Run this query in **SQL Editor**:

```sql
-- Check expenses table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'expenses' AND column_name = 'uploaded_by';

-- Check photos table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'photos' AND column_name = 'uploaded_by';
```

**Expected Output:**
```
column_name  | data_type | is_nullable | column_default
-------------|-----------|-------------|---------------
uploaded_by  | uuid      | YES         | NULL
```

### Step 2: Verify Indexes Created

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('expenses', 'photos')
  AND indexname LIKE '%uploaded_by%'
ORDER BY indexname;
```

**Expected Output:**
```
indexname                          | indexdef
-----------------------------------|------------------------------------------
idx_expenses_company_uploader      | CREATE INDEX idx_expenses_company_uploader ON public.expenses USING btree (company_id, uploaded_by)
idx_expenses_uploaded_by           | CREATE INDEX idx_expenses_uploaded_by ON public.expenses USING btree (uploaded_by) WHERE (uploaded_by IS NOT NULL)
idx_photos_company_uploader        | CREATE INDEX idx_photos_company_uploader ON public.photos USING btree (company_id, uploaded_by)
idx_photos_uploaded_by             | CREATE INDEX idx_photos_uploaded_by ON public.photos USING btree (uploaded_by) WHERE (uploaded_by IS NOT NULL)
```

### Step 3: Check Data Distribution

```sql
-- Count records with/without uploader info
SELECT
  'expenses' as table_name,
  COUNT(*) as total_records,
  COUNT(uploaded_by) as with_uploader,
  COUNT(*) - COUNT(uploaded_by) as without_uploader,
  ROUND(100.0 * COUNT(uploaded_by) / NULLIF(COUNT(*), 0), 2) as percentage_with_uploader
FROM expenses
UNION ALL
SELECT
  'photos' as table_name,
  COUNT(*) as total_records,
  COUNT(uploaded_by) as with_uploader,
  COUNT(*) - COUNT(uploaded_by) as without_uploader,
  ROUND(100.0 * COUNT(uploaded_by) / NULLIF(COUNT(*), 0), 2) as percentage_with_uploader
FROM photos;
```

**Expected Output (Before Backend Deployment):**
```
table_name | total_records | with_uploader | without_uploader | percentage_with_uploader
-----------|---------------|---------------|------------------|-------------------------
expenses   | 150           | 0             | 150              | 0.00
photos     | 342           | 0             | 342              | 0.00
```

**After Backend Deployment (new uploads will populate):**
```
table_name | total_records | with_uploader | without_uploader | percentage_with_uploader
-----------|---------------|---------------|------------------|-------------------------
expenses   | 155           | 5             | 150              | 3.23
photos     | 350           | 8             | 342              | 2.29
```

### Step 4: Test Foreign Key Constraint

```sql
-- This should succeed (NULL is allowed)
INSERT INTO expenses (id, company_id, project_id, type, subcategory, amount, store, uploaded_by)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM companies LIMIT 1),
  (SELECT id FROM projects LIMIT 1),
  'Test',
  'Test Subcategory',
  100.00,
  'Test Store',
  NULL  -- NULL is allowed
);

-- Clean up test record
DELETE FROM expenses WHERE store = 'Test Store' AND type = 'Test';
```

**Expected:** No errors

### Step 5: Verify RLS Policies

```sql
-- Check policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('expenses', 'photos')
  AND policyname LIKE '%company_access%';
```

**Expected:** Policies should exist (may vary based on your existing setup)

---

## 🔄 Rollback Plan (If Needed)

If something goes wrong, you can rollback:

```sql
-- ⚠️ WARNING: Only run this if you need to rollback!

-- Remove indexes
DROP INDEX IF EXISTS idx_expenses_uploaded_by;
DROP INDEX IF EXISTS idx_photos_uploaded_by;
DROP INDEX IF EXISTS idx_expenses_company_uploader;
DROP INDEX IF EXISTS idx_photos_company_uploader;

-- Remove columns
ALTER TABLE expenses DROP COLUMN IF EXISTS uploaded_by;
ALTER TABLE photos DROP COLUMN IF EXISTS uploaded_by;

-- Remove policies (if you added them)
DROP POLICY IF EXISTS "expenses_company_access" ON expenses;
DROP POLICY IF EXISTS "photos_company_access" ON photos;
```

---

## 📊 Performance Impact

**Expected Impact:** ✅ **Negligible**

- **Indexes:** Added with `IF NOT EXISTS` - safe for re-runs
- **Columns:** Nullable - no data rewrite needed
- **Existing queries:** Unaffected (column is ignored until backend updated)
- **Query performance:** JOINs will be fast due to indexed foreign keys

**Index sizes (approximate):**
- ~100 bytes per record with uploaded_by set
- For 10,000 expenses: ~1MB index size
- For 50,000 photos: ~5MB index size

---

## 🎯 What Happens Next?

After this migration:

1. ✅ **Database is ready** for uploader tracking
2. ⏳ **Existing records** have `uploaded_by = NULL` (safe - shows "Unknown")
3. ⏳ **New records** still have `uploaded_by = NULL` until backend is updated (Phase 2-3)
4. ⏳ **UI changes** not yet deployed (Phase 5-6)

**Nothing breaks** - this migration is backward compatible.

---

## 🐛 Troubleshooting

### Error: "relation 'users' does not exist"

**Solution:** Your database might not have a `users` table. Check:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

If `users` doesn't exist, you need to run the main schema setup first.

### Error: "permission denied for table expenses"

**Solution:** You need admin/service role access. Make sure you're using the service role key.

### Error: "index already exists"

**Solution:** Safe to ignore - migration uses `IF NOT EXISTS` clauses. The migration is idempotent.

### Migration runs but no columns added

**Solution:** Check if columns already exist:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'expenses';
SELECT column_name FROM information_schema.columns WHERE table_name = 'photos';
```

---

## 📝 Migration Log

Keep a record of when you ran this:

```
Migration: 20260207_add_uploaded_by.sql
Ran on: [DATE/TIME]
Environment: [Dev/Staging/Production]
Database: [Supabase Project Name]
Executed by: [Your Name]
Status: [Success/Failed]
Notes: [Any issues or observations]
```

---

## ✅ Phase 1 Complete Checklist

Before moving to Phase 2, verify:

- [ ] Migration executed successfully (no errors)
- [ ] Columns exist on both tables (`uploaded_by`)
- [ ] Indexes created (4 total)
- [ ] Foreign key constraints working
- [ ] RLS policies in place
- [ ] Data distribution query runs
- [ ] No performance degradation
- [ ] Team notified of schema changes

---

## 🚦 Ready for Phase 2?

Once all checkboxes are complete, you're ready for:

**Phase 2: Fix tRPC Context** (Extract user from auth)

This will enable automatic user tracking in all procedures.

---

**Questions or Issues?**
- Check Supabase Dashboard → Database → Logs
- Review `supabase/migrations/20260207_add_uploaded_by.sql` comments
- Test in staging before production
