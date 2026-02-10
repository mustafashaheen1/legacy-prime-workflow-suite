-- Add completed_at timestamp to daily_tasks table
-- This tracks when a task was actually marked as completed

ALTER TABLE daily_tasks
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN daily_tasks.completed_at IS 'Timestamp when the task was marked as completed';

-- Create index for querying completed tasks by completion date
CREATE INDEX IF NOT EXISTS idx_daily_tasks_completed_at
ON daily_tasks(completed_at)
WHERE completed_at IS NOT NULL;

-- Add completed and completed_at to scheduled_tasks table
ALTER TABLE scheduled_tasks
ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

ALTER TABLE scheduled_tasks
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add comments
COMMENT ON COLUMN scheduled_tasks.completed IS 'Whether the scheduled task is completed';
COMMENT ON COLUMN scheduled_tasks.completed_at IS 'Timestamp when the scheduled task was marked as completed';

-- Create index for scheduled tasks completion tracking
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_completed
ON scheduled_tasks(completed)
WHERE completed = true;

CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_completed_at
ON scheduled_tasks(completed_at)
WHERE completed_at IS NOT NULL;

-- Function to automatically set completed_at when completed is set to true
CREATE OR REPLACE FUNCTION set_completed_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- If task is being marked as completed and doesn't have completed_at yet
  IF NEW.completed = true AND OLD.completed = false AND NEW.completed_at IS NULL THEN
    NEW.completed_at = NOW();
  END IF;

  -- If task is being unmarked as completed, clear completed_at
  IF NEW.completed = false AND OLD.completed = true THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for both tables
DROP TRIGGER IF EXISTS trigger_set_completed_at_daily_tasks ON daily_tasks;
CREATE TRIGGER trigger_set_completed_at_daily_tasks
  BEFORE UPDATE ON daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at_timestamp();

DROP TRIGGER IF EXISTS trigger_set_completed_at_scheduled_tasks ON scheduled_tasks;
CREATE TRIGGER trigger_set_completed_at_scheduled_tasks
  BEFORE UPDATE ON scheduled_tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_completed_at_timestamp();
