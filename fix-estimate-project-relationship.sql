-- Fix the bidirectional relationship between projects and estimates
-- When a project was created from an estimate (project.estimate_id is set),
-- update the estimate to point back to that project

UPDATE estimates e
SET project_id = p.id::text
FROM projects p
WHERE p.estimate_id = e.id
  AND (e.project_id IS NULL OR e.project_id != p.id::text);

-- Verify the fix
-- This should show matching project_id and estimate_id relationships
SELECT
  p.id as project_id,
  p.name as project_name,
  p.estimate_id,
  e.id as estimate_id,
  e.name as estimate_name,
  e.project_id as estimate_project_id,
  CASE
    WHEN p.id::text = e.project_id THEN 'MATCHED ✓'
    ELSE 'MISMATCHED ✗'
  END as status
FROM projects p
LEFT JOIN estimates e ON p.estimate_id = e.id
WHERE p.estimate_id IS NOT NULL;
