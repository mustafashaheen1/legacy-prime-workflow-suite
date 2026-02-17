-- Add phase_id and visible_to_client columns to scheduled_tasks
ALTER TABLE scheduled_tasks
ADD COLUMN IF NOT EXISTS phase_id TEXT REFERENCES schedule_phases(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS visible_to_client BOOLEAN DEFAULT true;

-- Create index on phase_id for faster queries
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_phase_id ON scheduled_tasks(phase_id);

-- Backfill: Create phases from existing categories
-- This creates one phase per unique (category, color, project_id) combination
INSERT INTO schedule_phases (id, project_id, name, color, order_index, visible_to_client)
SELECT DISTINCT
  'phase-' || LOWER(REGEXP_REPLACE(category, '[^a-zA-Z0-9]', '-', 'g')) || '-' || project_id AS id,
  project_id,
  category AS name,
  color,
  0 AS order_index,
  true AS visible_to_client
FROM scheduled_tasks
WHERE phase_id IS NULL
  AND category IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Link existing tasks to their corresponding phases
UPDATE scheduled_tasks
SET phase_id = 'phase-' || LOWER(REGEXP_REPLACE(category, '[^a-zA-Z0-9]', '-', 'g')) || '-' || project_id
WHERE phase_id IS NULL
  AND category IS NOT NULL;

-- Set visible_to_client based on work_type (internal work hidden from clients by default)
UPDATE scheduled_tasks
SET visible_to_client = CASE
  WHEN work_type = 'in-house' THEN false
  ELSE true
END
WHERE visible_to_client IS NULL;
