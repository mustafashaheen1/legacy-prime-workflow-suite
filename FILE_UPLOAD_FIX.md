# File Upload Issue - Diagnosis and Fix

## Issue
On the `/register-subcontractor/[token]` page, clicking to upload files (License, Insurance, W-9, Certificate, Other) does nothing - no console logs, no feedback, no error messages.

## Root Cause
The database migrations have not been run yet. The required table `registration_tokens` does not exist in the Supabase database.

### Why This Breaks File Upload

1. When you click "Send Invite" button:
   - API tries to insert a record into `registration_tokens` table
   - If table doesn't exist, invitation fails silently or with error

2. When subcontractor opens the registration link:
   - Page calls `/api/validate-subcontractor-token`
   - API tries to query `registration_tokens` table
   - If table doesn't exist, validation fails
   - Page may load but in invalid state

3. When subcontractor tries to upload a file:
   - Component calls `/api/upload-subcontractor-business-file`
   - API tries to validate token against `registration_tokens` table
   - If table doesn't exist, upload fails immediately
   - No console logs because the API returns error before file processing starts

## Solution

Run the database migrations to create the required tables and columns.

### Step 1: Open Supabase Dashboard

Go to: https://supabase.com/dashboard/project/qwzhaexlnlfovrwzamop

### Step 2: Run SQL Migrations

See detailed instructions in `MIGRATION_INSTRUCTIONS.md`

**Quick version:**
1. Go to SQL Editor in Supabase dashboard
2. Run the SQL from `/supabase/migrations/registration_tokens.sql`
3. Run the SQL from `/supabase/migrations/subcontractor_registration.sql`
4. Verify migrations succeeded

### Step 3: Test the Flow

After running migrations:

1. Go to `/subcontractors` page
2. Click "Send Invite" button (green button next to "Add Subcontractor")
3. Email client should open with registration link
4. Copy the registration link
5. Open link in browser
6. Page should load with "Step 1 of 3" form
7. Try uploading a file (e.g., License)
8. Should see:
   - Upload progress indicator
   - Success message
   - File appears in the list

## What Changed

### Better Error Messages

I've added better error handling to show when database needs migrations:

**In registration page** ([token].tsx):
- Now shows alert: "Setup Required - The database needs to be configured. Please contact the administrator to run the database migrations."

**In validate-token API**:
- Now returns 500 error with message: "Database not configured. Please run migrations."
- Includes reference to MIGRATION_INSTRUCTIONS.md

**In upload-file API**:
- Now checks for "table doesn't exist" errors
- Returns clear error message with instructions

### Added Console Logging

All APIs now log:
- When they start
- What table they're querying
- Errors with full details
- Success/failure status

This will help debug any future issues.

## Files Modified

1. `/app/register-subcontractor/[token].tsx`
   - Added console logging in validateToken
   - Added check for database setup errors
   - Shows helpful alert if database not configured

2. `/api/validate-subcontractor-token.ts`
   - Added console logging
   - Added check for "table doesn't exist" errors
   - Returns 500 with clear message if migrations needed

3. `/api/upload-subcontractor-business-file.ts`
   - Added console logging in token validation
   - Added check for database setup errors
   - Returns clear error message

## Files Created

1. `/MIGRATION_INSTRUCTIONS.md`
   - Step-by-step guide to run migrations
   - Includes all SQL code
   - Verification steps
   - Troubleshooting

2. `/api/check-database-schema.ts`
   - Utility endpoint to check if migrations are needed
   - Can call GET /api/check-database-schema to see status
   - Returns what needs to be done

## Testing After Fix

Once migrations are run, test this complete flow:

### 1. Send Invitation
```
1. Go to /subcontractors
2. Click "Send Invite"
3. Email client opens
4. Copy registration URL from email body
```

### 2. Register Subcontractor
```
1. Open registration URL in browser
2. Fill Step 1 (Personal Info):
   - Name: John Smith
   - Company: Smith Construction
   - Email: john@example.com
   - Phone: 5551234567 (10 digits)
   - Trade: Electrician
   - License: ABC123
   - Address: 123 Main St
   - Notes: Test registration
3. Click "Next"
```

### 3. Upload Files
```
1. On Step 2, upload each file type:
   - License (PDF or image)
   - Insurance (PDF or image)
   - W-9 Form (PDF)
   - Certificate (PDF or image)
   - Other (any file type)
2. Each upload should:
   - Show progress spinner
   - Show "File uploaded successfully" alert
   - Display file in the list with name, size, type
   - Show delete button (trash icon)
3. Click "Next"
```

### 4. Review and Submit
```
1. On Step 3:
   - Verify all personal info is correct
   - Verify all 5 files are listed
2. Click "Submit Registration"
3. Should see success message
4. Go back to /subcontractors page
5. Verify new subcontractor appears with:
   - All personal details
   - Status "Pending Approval"
   - All 5 uploaded files accessible
```

## Current Status

- ✅ All code is written and updated
- ✅ Error handling added
- ✅ Console logging added
- ✅ Migration instructions created
- ⏳ **WAITING**: Database migrations need to be run
- ⏳ **WAITING**: Testing after migrations

## Next Action Required

**Run the database migrations following the instructions in MIGRATION_INSTRUCTIONS.md**

Once migrations are complete, the file upload will work properly.
