-- Create estimates table
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS estimates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  items JSONB NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  tax_rate NUMERIC(5, 4) NOT NULL,
  tax_amount NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  created_date TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_estimates_project_id ON estimates(project_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_created_date ON estimates(created_date DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_estimates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_estimates_updated_at_trigger ON estimates;

CREATE TRIGGER update_estimates_updated_at_trigger
  BEFORE UPDATE ON estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_estimates_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow all operations on estimates" ON estimates;

CREATE POLICY "Allow all operations on estimates"
  ON estimates
  FOR ALL
  USING (true)
  WITH CHECK (true);
