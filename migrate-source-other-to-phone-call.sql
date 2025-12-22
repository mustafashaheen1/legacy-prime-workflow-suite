-- Migration: Update source from 'Other' to 'Phone Call'
-- This migration updates existing client records and the database constraint

-- Step 1: Drop the old constraint FIRST (so we can update the records)
ALTER TABLE clients
DROP CONSTRAINT IF EXISTS clients_source_check;

-- Step 2: Update existing client records from 'Other' to 'Phone Call'
UPDATE clients
SET source = 'Phone Call'
WHERE source = 'Other';

-- Step 3: Add the new constraint with 'Phone Call' instead of 'Other'
ALTER TABLE clients
ADD CONSTRAINT clients_source_check
CHECK (source IN ('Google', 'Referral', 'Ad', 'Phone Call'));
