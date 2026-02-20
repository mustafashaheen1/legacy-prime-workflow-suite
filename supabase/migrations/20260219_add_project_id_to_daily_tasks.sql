ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_daily_tasks_project_id ON daily_tasks(project_id);
