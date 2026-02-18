# Run Database Migrations - Quick Start

## ✅ Easiest Method: Supabase Dashboard SQL Editor

### Step 1: Open SQL Editor

1. Go to: https://supabase.com/dashboard/project/qwzhaexlnlfovrwzamop/sql
2. Click "New Query"

### Step 2: Run Migration 1 - Create schedule_phases table

Copy and paste the entire contents of:
`supabase/migrations/20260217_create_schedule_phases.sql`

Click "Run" (or press Cmd+Enter)

✅ You should see: "Success. No rows returned"

### Step 3: Run Migration 2 - Add phase_id column

Copy and paste the entire contents of:
`supabase/migrations/20260217_add_phase_to_scheduled_tasks.sql`

Click "Run"

✅ You should see: "Success. X rows returned" (where X = number of existing tasks)

### Step 4: Run Migration 3 - Add RLS policies

Copy and paste the entire contents of:
`supabase/migrations/20260217_add_rls_policies.sql`

Click "Run"

✅ You should see: "Success. No rows returned"

### Step 5: Verify Migrations

Run this query to verify everything worked:

```sql
-- Check schedule_phases table exists
SELECT COUNT(*) as phase_count FROM schedule_phases;

-- Check phase_id was added to scheduled_tasks
SELECT COUNT(*) as tasks_with_phases
FROM scheduled_tasks
WHERE phase_id IS NOT NULL;

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('schedule_phases', 'scheduled_tasks');
```

Expected results:
- `phase_count`: Should match number of unique task categories
- `tasks_with_phases`: Should equal total number of tasks
- `rowsecurity`: Should be `true` for both tables

---

## 🔧 Alternative Method: Using psql Command Line

If you prefer command line:

```bash
# Install PostgreSQL client (if not installed)
brew install postgresql@14

# Get your database password from:
# https://supabase.com/dashboard/project/qwzhaexlnlfovrwzamop/settings/database

# Run migrations
psql -h db.qwzhaexlnlfovrwzamop.supabase.co -U postgres -d postgres -p 5432 \
  -f supabase/migrations/20260217_create_schedule_phases.sql

psql -h db.qwzhaexlnlfovrwzamop.supabase.co -U postgres -d postgres -p 5432 \
  -f supabase/migrations/20260217_add_phase_to_scheduled_tasks.sql

psql -h db.qwzhaexlnlfovrwzamop.supabase.co -U postgres -d postgres -p 5432 \
  -f supabase/migrations/20260217_add_rls_policies.sql
```

---

## ⚠️ Important Notes

1. **Backup First**: These migrations are safe (additive only), but it's good practice
2. **Production Database**: This will run on your production database
3. **Idempotent**: Safe to run multiple times (uses `IF NOT EXISTS`)
4. **No Downtime**: Migrations run instantly, no app downtime

---

## 🚨 Troubleshooting

### "relation already exists"
Already migrated! This is fine, migrations are idempotent.

### "permission denied"
Check you're logged into the correct Supabase project.

### "column already exists"
Already migrated! Safe to ignore.

---

## Next Steps After Migrations

1. ✅ Migrations complete
2. 🔄 Restart dev server: `npm run start -- --clear`
3. 📱 Open app and go to Schedule tab
4. 🎉 New Gantt Chart should appear!

If you see the old schedule instead, check that:
- `.env.local` has `EXPO_PUBLIC_ENABLE_GANTT_V2=true`
- Dev server was restarted after adding the flag
