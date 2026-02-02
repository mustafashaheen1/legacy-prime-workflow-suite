-- Migration: Create file_share_links table for shortened file URLs
-- Run this in your Supabase SQL Editor

-- Create file_share_links table
CREATE TABLE IF NOT EXISTS file_share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  subcontractor_id TEXT,
  s3_key TEXT NOT NULL,
  s3_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint to ensure short_code is unique
  CONSTRAINT file_share_links_short_code_key UNIQUE (short_code)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_file_share_links_short_code ON file_share_links(short_code);
CREATE INDEX IF NOT EXISTS idx_file_share_links_company ON file_share_links(company_id);
CREATE INDEX IF NOT EXISTS idx_file_share_links_project ON file_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_file_share_links_expires ON file_share_links(expires_at);

-- Enable Row Level Security
ALTER TABLE file_share_links ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow public read for file share links (anyone with the link can access)
DROP POLICY IF EXISTS "Allow public read for file share links" ON file_share_links;
CREATE POLICY "Allow public read for file share links"
  ON file_share_links FOR SELECT
  USING (true);

-- RLS Policy: Only company members can create file share links
DROP POLICY IF EXISTS "Company members can create file share links" ON file_share_links;
CREATE POLICY "Company members can create file share links"
  ON file_share_links FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid()
    )
  );

-- RLS Policy: Service role has full access (for API endpoints)
DROP POLICY IF EXISTS "Service role has full access to file_share_links" ON file_share_links;
CREATE POLICY "Service role has full access to file_share_links"
  ON file_share_links
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE file_share_links IS 'Stores shortened URLs for file sharing (estimate requests, project files)';

-- Verify the table was created
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'file_share_links'
ORDER BY ordinal_position;
