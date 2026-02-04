-- Drop existing table and trigger if they exist
DROP TRIGGER IF EXISTS update_custom_folders_updated_at ON custom_folders;
DROP TABLE IF EXISTS custom_folders CASCADE;

-- Create custom_folders table (simplified without trigger)
CREATE TABLE custom_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id TEXT NOT NULL,
  folder_type TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  description TEXT DEFAULT 'Custom folder',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, folder_type)
);

-- Create index for faster queries
CREATE INDEX idx_custom_folders_project_id ON custom_folders(project_id);

-- Enable RLS
ALTER TABLE custom_folders ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Enable all operations for custom_folders" ON custom_folders
  FOR ALL
  USING (true)
  WITH CHECK (true);
