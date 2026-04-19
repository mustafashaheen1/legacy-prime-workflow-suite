-- Add new fields to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS end_time text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_appointments_project_id ON appointments(project_id);
