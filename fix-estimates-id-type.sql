-- Fix estimates table to use TEXT for project_id (matching app's string IDs)

-- Drop foreign key constraint if it exists
ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_project_id_fkey;

-- Change project_id from UUID to TEXT
ALTER TABLE estimates ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;

-- Change id from UUID to TEXT (for estimate IDs like "estimate-1767014147635")
ALTER TABLE estimates ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'estimates'
ORDER BY ordinal_position;
