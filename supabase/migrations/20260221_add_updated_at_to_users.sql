-- Add updated_at column to public users table.
-- The approve-user API writes this field on approval but the column was missing,
-- causing a 500 error when admins tried to approve employee signup requests.
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing rows
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;
