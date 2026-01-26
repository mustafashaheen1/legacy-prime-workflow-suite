# Database Migration Instructions

## Problem
The file upload on `/register-subcontractor/[token]` page is not working because the required database tables and columns don't exist yet.

## Solution
Run the SQL migrations in your Supabase dashboard.

## Steps

### 1. Access Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/qwzhaexlnlfovrwzamop
2. Log in to your Supabase account
3. Click on "SQL Editor" in the left sidebar

### 2. Run Migration 1: Create registration_tokens Table

Click "New Query" and paste this SQL:

```sql
-- Create registration_tokens table for tracking invitation tokens
CREATE TABLE IF NOT EXISTS registration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_registration_tokens_token ON registration_tokens(token);

-- Create index on company_id
CREATE INDEX IF NOT EXISTS idx_registration_tokens_company ON registration_tokens(company_id);
```

Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)

### 3. Run Migration 2: Update Existing Tables

Create another new query and paste this SQL:

```sql
-- Add registration fields to subcontractors table
ALTER TABLE subcontractors
ADD COLUMN IF NOT EXISTS registration_token TEXT,
ADD COLUMN IF NOT EXISTS registration_token_expiry TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS registration_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS invited_by UUID,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS license_number TEXT;

-- Add unique constraint to registration_token if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subcontractors_registration_token_key'
  ) THEN
    ALTER TABLE subcontractors ADD CONSTRAINT subcontractors_registration_token_key UNIQUE (registration_token);
  END IF;
END $$;

-- Add s3_key column to business_files table if it doesn't exist
-- (table already exists, just ensuring s3_key column is present for file deletion)
ALTER TABLE business_files
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS registration_token TEXT;

-- Allow null subcontractor_id for files uploaded during registration
ALTER TABLE business_files
ALTER COLUMN subcontractor_id DROP NOT NULL;

-- Create index on registration_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_subcontractors_registration_token ON subcontractors(registration_token) WHERE registration_token IS NOT NULL;
```

Click "Run" or press Cmd+Enter (Mac) / Ctrl+Enter (Windows)

### 4. Verify Migrations

After running both migrations, verify they were successful:

```sql
-- Check if registration_tokens table exists
SELECT COUNT(*) FROM registration_tokens;

-- Check if new columns exist in business_files
SELECT column_name FROM information_schema.columns
WHERE table_name = 'business_files'
AND column_name IN ('s3_key', 'registration_token');

-- Check if new columns exist in subcontractors
SELECT column_name FROM information_schema.columns
WHERE table_name = 'subcontractors'
AND column_name IN ('registration_token', 'registration_completed', 'invited_by', 'license_number');
```

All queries should return results without errors.

## After Running Migrations

Once migrations are complete:

1. The "Send Invite" button will work properly
2. The registration link will load correctly
3. File uploads will work on the registration page
4. Subcontractors will be created with all their data

## Troubleshooting

**If you get a foreign key constraint error:**
- Make sure the `companies` and `users` tables exist
- If they don't, the app might not be fully set up yet

**If you get a "permission denied" error:**
- Make sure you're logged in to the correct Supabase project
- Make sure you have admin access to the project

**If you get a "column already exists" error:**
- This is fine! The migrations use `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`
- The migration will skip columns that already exist

## Files Referenced

The migration SQL files can be found at:
- `/supabase/migrations/registration_tokens.sql`
- `/supabase/migrations/subcontractor_registration.sql`
