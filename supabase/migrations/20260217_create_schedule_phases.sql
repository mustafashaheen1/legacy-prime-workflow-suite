-- Create schedule_phases table for hierarchical project phase organization
CREATE TABLE IF NOT EXISTS schedule_phases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_phase_id TEXT REFERENCES schedule_phases(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL,
  visible_to_client BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_schedule_phases_project_id ON schedule_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_schedule_phases_parent_id ON schedule_phases(parent_phase_id);
CREATE INDEX IF NOT EXISTS idx_schedule_phases_order ON schedule_phases(project_id, order_index);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_schedule_phases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER schedule_phases_updated_at
  BEFORE UPDATE ON schedule_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_schedule_phases_updated_at();
