-- Create scheduled_tasks table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration INTEGER NOT NULL,
  work_type TEXT NOT NULL CHECK (work_type IN ('in-house', 'subcontractor')),
  notes TEXT,
  color TEXT NOT NULL,
  row INTEGER DEFAULT 0,
  row_span INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on project_id for faster queries
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_project_id ON scheduled_tasks(project_id);

-- Create index on start_date for faster date range queries
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_start_date ON scheduled_tasks(start_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_scheduled_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scheduled_tasks_updated_at
  BEFORE UPDATE ON scheduled_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_tasks_updated_at();
