-- Add time-related columns to daily_tasks table
ALTER TABLE daily_tasks
ADD COLUMN IF NOT EXISTS due_time TIME,
ADD COLUMN IF NOT EXISTS due_date_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- Create index for reminder queries
CREATE INDEX IF NOT EXISTS idx_daily_tasks_reminder ON daily_tasks(reminder, reminder_sent, due_date_time);

-- Add comment for documentation
COMMENT ON COLUMN daily_tasks.due_time IS 'Time component of the due date (HH:MM format)';
COMMENT ON COLUMN daily_tasks.due_date_time IS 'Combined date and time for precise reminder scheduling';
COMMENT ON COLUMN daily_tasks.reminder_sent IS 'Tracks whether the reminder notification has been sent';
