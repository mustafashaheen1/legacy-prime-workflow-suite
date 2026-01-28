-- Create daily_tasks table
CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  reminder BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_tasks_company_id ON daily_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_id ON daily_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_due_date ON daily_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_completed ON daily_tasks(completed);

-- Add RLS (Row Level Security) policies
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view tasks for their company
CREATE POLICY "Users can view their company's daily tasks"
  ON daily_tasks
  FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- Policy: Users can create tasks for their company
CREATE POLICY "Users can create daily tasks for their company"
  ON daily_tasks
  FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- Policy: Users can update tasks for their company
CREATE POLICY "Users can update their company's daily tasks"
  ON daily_tasks
  FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- Policy: Users can delete tasks for their company
CREATE POLICY "Users can delete their company's daily tasks"
  ON daily_tasks
  FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE id = auth.uid()
  ));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_daily_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER daily_tasks_updated_at
  BEFORE UPDATE ON daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_tasks_updated_at();
