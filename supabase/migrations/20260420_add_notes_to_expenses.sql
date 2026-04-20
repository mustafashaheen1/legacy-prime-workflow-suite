-- Add notes column to expenses table for optional expense notes
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS notes TEXT;
