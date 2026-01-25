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
ADD COLUMN IF NOT EXISTS s3_key TEXT;

-- Create index on registration_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_subcontractors_registration_token ON subcontractors(registration_token) WHERE registration_token IS NOT NULL;
