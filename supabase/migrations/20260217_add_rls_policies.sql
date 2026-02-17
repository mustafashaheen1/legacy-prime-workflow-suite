-- Enable Row Level Security on schedule_phases
ALTER TABLE schedule_phases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view phases for projects in their company
CREATE POLICY "Users can view their company's schedule phases"
  ON schedule_phases
  FOR SELECT
  USING (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can create phases for projects in their company
CREATE POLICY "Users can create schedule phases for their company"
  ON schedule_phases
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can update phases for projects in their company
CREATE POLICY "Users can update their company's schedule phases"
  ON schedule_phases
  FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can delete phases for projects in their company
CREATE POLICY "Users can delete their company's schedule phases"
  ON schedule_phases
  FOR DELETE
  USING (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Update scheduled_tasks RLS policies to include phase_id checks
-- First, check if RLS is enabled (if not, enable it)
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their company's scheduled tasks" ON scheduled_tasks;
DROP POLICY IF EXISTS "Users can create scheduled tasks for their company" ON scheduled_tasks;
DROP POLICY IF EXISTS "Users can update their company's scheduled tasks" ON scheduled_tasks;
DROP POLICY IF EXISTS "Users can delete their company's scheduled tasks" ON scheduled_tasks;

-- Policy: Users can view tasks for projects in their company
CREATE POLICY "Users can view their company's scheduled tasks"
  ON scheduled_tasks
  FOR SELECT
  USING (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Policy: Users can create tasks for projects in their company
CREATE POLICY "Users can create scheduled tasks for their company"
  ON scheduled_tasks
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
    AND (
      -- If phase_id is provided, ensure it belongs to a project in user's company
      phase_id IS NULL OR
      phase_id IN (
        SELECT sp.id
        FROM schedule_phases sp
        JOIN projects p ON sp.project_id::text = p.id::text
        WHERE p.company_id = (
          SELECT company_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Policy: Users can update tasks for projects in their company
CREATE POLICY "Users can update their company's scheduled tasks"
  ON scheduled_tasks
  FOR UPDATE
  USING (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
    AND (
      -- If phase_id is provided, ensure it belongs to a project in user's company
      phase_id IS NULL OR
      phase_id IN (
        SELECT sp.id
        FROM schedule_phases sp
        JOIN projects p ON sp.project_id::text = p.id::text
        WHERE p.company_id = (
          SELECT company_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Policy: Users can delete tasks for projects in their company
CREATE POLICY "Users can delete their company's scheduled tasks"
  ON scheduled_tasks
  FOR DELETE
  USING (
    project_id IN (
      SELECT p.id::text
      FROM projects p
      WHERE p.company_id = (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Add comment explaining the security model
COMMENT ON TABLE schedule_phases IS 'Hierarchical project phases for Gantt chart. RLS ensures users can only access phases for projects in their company.';
COMMENT ON COLUMN scheduled_tasks.phase_id IS 'Reference to parent schedule phase. RLS policies ensure phase belongs to user''s company.';
COMMENT ON COLUMN scheduled_tasks.visible_to_client IS 'Controls visibility in client view. Internal tasks (in-house work) hidden by default.';
COMMENT ON COLUMN schedule_phases.visible_to_client IS 'Controls phase visibility in client view. Allows hiding sensitive planning details.';
