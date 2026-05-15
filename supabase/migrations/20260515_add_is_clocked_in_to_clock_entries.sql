-- Add is_clocked_in flag to clock_entries.
-- This column is the sole Realtime trigger for live clock-in/out visibility on the admin side.
-- Time calculations run locally on the client using clock_in and lunch_breaks timestamps.
ALTER TABLE clock_entries
  ADD COLUMN IF NOT EXISTS is_clocked_in BOOLEAN NOT NULL DEFAULT false;

-- Backfill any currently active sessions (clocked in, not yet clocked out).
UPDATE clock_entries
  SET is_clocked_in = true
  WHERE clock_out IS NULL;
