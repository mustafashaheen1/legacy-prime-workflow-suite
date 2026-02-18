-- Add completed and completed_at columns to scheduled_tasks
ALTER TABLE scheduled_tasks
ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for faster queries on completed tasks
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_completed ON scheduled_tasks(completed);

-- Add comment explaining the fields
COMMENT ON COLUMN scheduled_tasks.completed IS 'Whether the task/phase has been completed';
COMMENT ON COLUMN scheduled_tasks.completed_at IS 'Timestamp when the task was marked as completed';
