-- Fix client_email NOT NULL constraint
-- Run this in Supabase SQL Editor to allow null client emails

ALTER TABLE inspection_videos
ALTER COLUMN client_email DROP NOT NULL;

-- Verify the change
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'inspection_videos'
AND column_name = 'client_email';
-- Should show is_nullable = 'YES'
