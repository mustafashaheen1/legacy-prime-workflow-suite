# File Upload Not Working - Here's What You Need to Do

## The Problem

You tried uploading a license file on the `/register-subcontractor/[token]` page and nothing happened. No console logs, no errors, nothing.

## Why It's Not Working

**The database migrations haven't been run yet.**

The code expects a table called `registration_tokens` to exist in your Supabase database, but it doesn't exist yet. This table is needed to:
1. Store invitation tokens when you click "Send Invite"
2. Validate tokens when subcontractor opens the registration link
3. Track file uploads during registration

Without this table, the entire flow breaks silently.

## The Fix (Simple - Takes 2 Minutes)

### Step 1: Open Your Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project: `qwzhaexlnlfovrwzamop`
3. Click "SQL Editor" in the left sidebar

### Step 2: Create the registration_tokens Table

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

Click "Run" (or press Cmd+Enter on Mac, Ctrl+Enter on Windows)

You should see: "Success. No rows returned"

### Step 3: Update Existing Tables

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
ALTER TABLE business_files
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS registration_token TEXT;

-- Allow null subcontractor_id for files uploaded during registration
ALTER TABLE business_files
ALTER COLUMN subcontractor_id DROP NOT NULL;

-- Create index on registration_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_subcontractors_registration_token ON subcontractors(registration_token) WHERE registration_token IS NOT NULL;
```

Click "Run"

You should see: "Success. No rows returned"

### Step 4: Test It

Now go back to your app and test the complete flow:

1. **Send Invitation**
   - Go to `/subcontractors` page
   - Click the green "Send Invite" button (next to "Add Subcontractor")
   - Your email client should open with a pre-filled email
   - Copy the registration link from the email body

2. **Open Registration Page**
   - Paste the link in your browser
   - You should see "Step 1 of 3" registration form
   - Console should show: `[Registration] Validating token: sub_reg_...`
   - Console should show: `[Registration] Token is valid, ready for registration`

3. **Upload a File**
   - Click "Choose File" under "License"
   - Select a PDF or image file
   - You should see:
     - Console log: `[BusinessFileUpload] Starting upload...`
     - Progress spinner in the upload button
     - Console log: `[BusinessFileUpload] Got upload URL, uploading to S3...`
     - Console log: `[BusinessFileUpload] File uploaded successfully`
     - Success alert: "File uploaded successfully"
     - File appears in the list below with name, size, and delete button

4. **Complete Registration**
   - Fill in all required fields in Step 1
   - Upload files in Step 2
   - Review and submit in Step 3
   - Go to `/subcontractors` page
   - Your new subcontractor should appear with all details and files

## How to Check If Migrations Are Needed

You can call this API endpoint to check: `GET /api/check-database-schema`

It will tell you:
- Which tables exist
- Which columns are missing
- What needs to be done

## Files for Reference

- **Migration SQL Files:**
  - `/supabase/migrations/registration_tokens.sql`
  - `/supabase/migrations/subcontractor_registration.sql`

- **Detailed Instructions:**
  - `/MIGRATION_INSTRUCTIONS.md` (step-by-step with screenshots description)

- **Technical Details:**
  - `/FILE_UPLOAD_FIX.md` (diagnosis and what changed)

## What I've Already Done

1. ✅ Created all the API endpoints
2. ✅ Created the registration page UI
3. ✅ Created the file upload component
4. ✅ Added proper validation (email, phone)
5. ✅ Fixed all the labels (License, Insurance, W-9 Form, Certificate, Other)
6. ✅ Added extensive console logging for debugging
7. ✅ Added error handling for database issues
8. ✅ Created migration SQL files
9. ✅ Created instructions and documentation

## What You Need to Do

**Just run the 2 SQL queries above in your Supabase dashboard. That's it!**

After that, the entire flow will work:
- Sending invitations
- Opening registration links
- Uploading files
- Completing registration
- Viewing subcontractor details

## Questions?

If you get any errors when running the SQL:

1. **"relation does not exist"** - This means a required table (like `companies` or `users`) doesn't exist. The app might not be fully set up yet.

2. **"permission denied"** - Make sure you're logged into the correct Supabase project and have admin access.

3. **"column already exists"** - This is fine! The SQL uses `IF NOT EXISTS` so it will skip columns that already exist.

If you still have issues, check the console logs in your browser and share them.
