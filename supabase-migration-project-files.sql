-- Migration for project_files table
-- Run this in your Supabase SQL Editor

-- First, check if the table exists and add missing columns
DO $$
BEGIN
  -- Add url column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_files' AND column_name = 'url') THEN
    ALTER TABLE project_files ADD COLUMN url TEXT;
  END IF;

  -- Add s3_key column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_files' AND column_name = 's3_key') THEN
    ALTER TABLE project_files ADD COLUMN s3_key TEXT;
  END IF;

  -- Add notes column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_files' AND column_name = 'notes') THEN
    ALTER TABLE project_files ADD COLUMN notes TEXT;
  END IF;

  -- Add upload_date column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_files' AND column_name = 'upload_date') THEN
    ALTER TABLE project_files ADD COLUMN upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;

  -- Add file_type column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_files' AND column_name = 'file_type') THEN
    ALTER TABLE project_files ADD COLUMN file_type TEXT NOT NULL DEFAULT 'unknown';
  END IF;

  -- Add file_size column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_files' AND column_name = 'file_size') THEN
    ALTER TABLE project_files ADD COLUMN file_size BIGINT DEFAULT 0;
  END IF;

  -- Add category column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_files' AND column_name = 'category') THEN
    ALTER TABLE project_files ADD COLUMN category TEXT NOT NULL DEFAULT 'documentation';
  END IF;

  -- Add name column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_files' AND column_name = 'name') THEN
    ALTER TABLE project_files ADD COLUMN name TEXT NOT NULL DEFAULT 'Untitled';
  END IF;
END $$;

-- Create indexes for better query performance (IF NOT EXISTS handles duplicates)
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_company_id ON project_files(company_id);
CREATE INDEX IF NOT EXISTS idx_project_files_category ON project_files(category);
CREATE INDEX IF NOT EXISTS idx_project_files_upload_date ON project_files(upload_date DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_project_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_files_updated_at ON project_files;

CREATE TRIGGER update_project_files_updated_at
  BEFORE UPDATE ON project_files
  FOR EACH ROW
  EXECUTE FUNCTION update_project_files_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow service role full access (for API endpoints)
DROP POLICY IF EXISTS "Service role has full access to project_files" ON project_files;
CREATE POLICY "Service role has full access to project_files"
  ON project_files
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE project_files IS 'Stores uploaded project documents (permits, inspections, agreements, etc.)';
