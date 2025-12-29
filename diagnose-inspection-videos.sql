-- Diagnostic queries for inspection_videos table
-- Run these in Supabase SQL Editor to diagnose the timeout issue

-- 1. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'inspection_videos';
-- Expected: rowsecurity should be 'false'

-- 2. Check all indexes on the table
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'inspection_videos';
-- Should have index on token (UNIQUE)

-- 3. Check foreign key constraints
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'inspection_videos'::regclass;
-- Shows all constraints including foreign keys

-- 4. Check if there are any triggers that might slow down INSERT
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'inspection_videos';

-- 5. Try a simple INSERT to see if it works
-- (This will insert a test record - you can delete it after)
INSERT INTO inspection_videos (
    token,
    client_id,
    company_id,
    client_name,
    client_email,
    status,
    notes,
    expires_at
)
VALUES (
    gen_random_uuid(),
    (SELECT id FROM clients LIMIT 1),  -- Get first client
    (SELECT id FROM companies LIMIT 1), -- Get first company
    'Test Client',
    'test@example.com',
    'pending',
    'Diagnostic test insert',
    NOW() + INTERVAL '14 days'
)
RETURNING id, token, created_at;
-- If this hangs, we know it's a database-level issue

-- 6. Clean up test record (run this after test insert succeeds)
-- DELETE FROM inspection_videos WHERE notes = 'Diagnostic test insert';
