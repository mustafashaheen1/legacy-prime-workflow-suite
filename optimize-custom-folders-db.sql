-- Optimize custom_folders table for faster inserts
-- Run this in Supabase SQL Editor to improve performance

-- 1. Check if indexes exist
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'custom_folders';

-- 2. Ensure index on project_id exists (for fast queries)
CREATE INDEX IF NOT EXISTS idx_custom_folders_project_id
ON custom_folders(project_id);

-- 3. Add index on unique constraint for faster duplicate checks
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_folders_unique
ON custom_folders(project_id, folder_type);

-- 4. Check RLS status
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'custom_folders';

-- 5. Check current policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'custom_folders';

-- 6. Optimize RLS policy (only run if RLS is enabled and slow)
-- First, drop existing policy
DROP POLICY IF EXISTS "Enable all operations for custom_folders" ON custom_folders;

-- Create optimized policy
CREATE POLICY "Allow all operations" ON custom_folders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 7. Check table statistics
SELECT
    relname as table_name,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    last_autovacuum,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE relname = 'custom_folders';

-- 8. If you have many dead rows, run VACUUM
-- VACUUM ANALYZE custom_folders;

-- 9. View recent inserts performance
-- (This requires pg_stat_statements extension)
-- SELECT * FROM pg_stat_statements
-- WHERE query LIKE '%custom_folders%INSERT%'
-- ORDER BY mean_exec_time DESC;
