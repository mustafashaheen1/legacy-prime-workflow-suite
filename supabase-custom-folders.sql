-- Create custom_folders table for project-specific custom folders
CREATE TABLE IF NOT EXISTS custom_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  folder_type TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  description TEXT DEFAULT 'Custom folder',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique folder types per project
  UNIQUE(project_id, folder_type)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_custom_folders_project_id ON custom_folders(project_id);

-- Enable RLS (Row Level Security)
ALTER TABLE custom_folders ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth setup)
CREATE POLICY "Enable all operations for custom_folders" ON custom_folders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_custom_folders_updated_at
  BEFORE UPDATE ON custom_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
