-- Add estimate_id column to projects table to link projects to their original estimates
-- This allows us to display the estimate that was used to create the project

ALTER TABLE projects
ADD COLUMN estimate_id TEXT REFERENCES estimates(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_projects_estimate_id ON projects(estimate_id);

-- Add comment
COMMENT ON COLUMN projects.estimate_id IS 'Reference to the original estimate that was used to create this project';
