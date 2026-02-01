-- Add clock_entry_id column to expenses table
-- This links labor expenses to their originating clock entries
-- Run this in your Supabase SQL Editor

-- Add clock_entry_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses'
    AND column_name = 'clock_entry_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN clock_entry_id TEXT;

    -- Create index for better query performance
    CREATE INDEX idx_expenses_clock_entry_id ON expenses(clock_entry_id);

    RAISE NOTICE 'Added clock_entry_id column and index to expenses table';
  ELSE
    RAISE NOTICE 'clock_entry_id column already exists';
  END IF;
END $$;

-- Verify hourly_rate column exists in users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
    AND column_name = 'hourly_rate'
  ) THEN
    ALTER TABLE users ADD COLUMN hourly_rate NUMERIC(10, 2) DEFAULT NULL;
    RAISE NOTICE 'Added hourly_rate column to users table';
  ELSE
    RAISE NOTICE 'hourly_rate column already exists';
  END IF;
END $$;

-- Verify the columns were added
SELECT
  'expenses' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'expenses'
  AND column_name = 'clock_entry_id'
UNION ALL
SELECT
  'users' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name = 'hourly_rate';
