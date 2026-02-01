-- Fix project_files category constraint to include all valid categories
-- Run this in your Supabase SQL Editor

-- Drop the old check constraint
ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_category_check;

-- Add the updated check constraint with all valid categories
ALTER TABLE project_files
  ADD CONSTRAINT project_files_category_check
  CHECK (category IN (
    'receipts',
    'photos',
    'reports',
    'plans',
    'estimates',
    'documentation',
    'videos',
    'other',
    'permits',
    'inspections',
    'agreements'
  ));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'project_files'::regclass
  AND conname = 'project_files_category_check';
