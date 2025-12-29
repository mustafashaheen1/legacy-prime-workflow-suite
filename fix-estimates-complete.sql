-- Fix estimates table - handle dependent policies

-- Step 1: Drop dependent policies
DROP POLICY IF EXISTS "Users can manage estimate items" ON estimate_items;

-- Step 2: Drop any other policies that might depend on estimates.id
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE tablename = 'estimate_items'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- Step 3: Drop foreign key constraint
ALTER TABLE estimates DROP CONSTRAINT IF EXISTS estimates_project_id_fkey;

-- Step 4: Drop foreign key from estimate_items if exists
ALTER TABLE IF EXISTS estimate_items DROP CONSTRAINT IF EXISTS estimate_items_estimate_id_fkey;

-- Step 5: Change estimates.id from UUID to TEXT
ALTER TABLE estimates ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- Step 6: Change estimates.project_id from UUID to TEXT  
ALTER TABLE estimates ALTER COLUMN project_id TYPE TEXT USING project_id::TEXT;

-- Step 7: Make company_id nullable
ALTER TABLE estimates ALTER COLUMN company_id DROP NOT NULL;

-- Step 8: If estimate_items exists, update its estimate_id column type
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estimate_items') THEN
        ALTER TABLE estimate_items ALTER COLUMN estimate_id TYPE TEXT USING estimate_id::TEXT;
    END IF;
END $$;

-- Step 9: Recreate RLS policy for estimates
DROP POLICY IF EXISTS "Allow all operations on estimates" ON estimates;
CREATE POLICY "Allow all operations on estimates" 
    ON estimates FOR ALL 
    USING (true) WITH CHECK (true);

-- Step 10: Recreate RLS policy for estimate_items if table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'estimate_items') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Users can manage estimate items" ON estimate_items';
        EXECUTE 'CREATE POLICY "Users can manage estimate items" ON estimate_items FOR ALL USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'estimates'
ORDER BY ordinal_position;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
