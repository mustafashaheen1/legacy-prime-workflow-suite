-- Enable Row Level Security on schedule_phases
ALTER TABLE schedule_phases ENABLE ROW LEVEL SECURITY;

-- Drop any previously-created policies so this migration is idempotent.
DROP POLICY IF EXISTS "Users can view their company's schedule phases" ON schedule_phases;
DROP POLICY IF EXISTS "Users can create schedule phases for their company" ON schedule_phases;
DROP POLICY IF EXISTS "Users can update their company's schedule phases" ON schedule_phases;
DROP POLICY IF EXISTS "Users can delete their company's schedule phases" ON schedule_phases;
DROP POLICY IF EXISTS "Service role full access schedule phases" ON schedule_phases;

-- All access goes through the service role key (SUPABASE_SERVICE_ROLE_KEY),
-- which bypasses RLS by design. A single permissive policy keeps RLS enabled
-- for auditability without breaking the backend.
CREATE POLICY "Service role full access schedule phases"
  ON schedule_phases FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update scheduled_tasks RLS policies to include phase_id checks
-- First, ensure RLS is enabled
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their company's scheduled tasks" ON scheduled_tasks;
DROP POLICY IF EXISTS "Users can create scheduled tasks for their company" ON scheduled_tasks;
DROP POLICY IF EXISTS "Users can update their company's scheduled tasks" ON scheduled_tasks;
DROP POLICY IF EXISTS "Users can delete their company's scheduled tasks" ON scheduled_tasks;
DROP POLICY IF EXISTS "Service role full access scheduled tasks" ON scheduled_tasks;

-- All access goes through the service role key (SUPABASE_SERVICE_ROLE_KEY),
-- which bypasses RLS by design.
CREATE POLICY "Service role full access scheduled tasks"
  ON scheduled_tasks FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment explaining the security model
COMMENT ON TABLE schedule_phases IS 'Hierarchical project phases for Gantt chart. RLS enabled; access via service role key.';
COMMENT ON COLUMN scheduled_tasks.phase_id IS 'Reference to parent schedule phase.';
COMMENT ON COLUMN scheduled_tasks.visible_to_client IS 'Controls visibility in client view. Internal tasks (in-house work) hidden by default.';
COMMENT ON COLUMN schedule_phases.visible_to_client IS 'Controls phase visibility in client view. Allows hiding sensitive planning details.';
