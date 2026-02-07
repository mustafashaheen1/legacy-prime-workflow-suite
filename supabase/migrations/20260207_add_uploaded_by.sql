-- =====================================================
-- Migration: Add uploaded_by to expenses and photos
-- Date: 2026-02-07
-- Purpose: Track who uploaded each expense and photo
-- Feature: Show uploader profile on expenses & photos
-- =====================================================

-- =====================================================
-- PART 1: Add Columns (Zero Downtime - Nullable)
-- =====================================================

-- Add uploaded_by column to expenses table
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add uploaded_by column to photos table
ALTER TABLE photos
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add column comments for documentation
COMMENT ON COLUMN expenses.uploaded_by IS 'User who uploaded/created this expense record';
COMMENT ON COLUMN photos.uploaded_by IS 'User who uploaded this photo';

-- =====================================================
-- PART 2: Add Indexes (Performance Optimization)
-- =====================================================

-- Index for expenses uploaded_by (speeds up JOINs and filtering)
CREATE INDEX IF NOT EXISTS idx_expenses_uploaded_by
  ON expenses(uploaded_by)
  WHERE uploaded_by IS NOT NULL;

-- Index for photos uploaded_by (speeds up JOINs and filtering)
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_by
  ON photos(uploaded_by)
  WHERE uploaded_by IS NOT NULL;

-- Composite index for common query pattern (company + uploader)
CREATE INDEX IF NOT EXISTS idx_expenses_company_uploader
  ON expenses(company_id, uploaded_by);

CREATE INDEX IF NOT EXISTS idx_photos_company_uploader
  ON photos(company_id, uploaded_by);

-- =====================================================
-- PART 3: RLS Policies (Security)
-- =====================================================

-- Note: These policies allow users to see expenses/photos uploaded by anyone
-- in their company. Adjust if you need stricter access control.

-- Expenses: Users can view expenses in their company (including uploader info)
-- This policy already exists via company_id, but we ensure it includes uploaded_by
DO $$
BEGIN
  -- Check if policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'expenses'
    AND policyname = 'expenses_company_access'
  ) THEN
    CREATE POLICY "expenses_company_access" ON expenses
      FOR SELECT USING (
        company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
      );
  END IF;
END $$;

-- Photos: Users can view photos in their company (including uploader info)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'photos'
    AND policyname = 'photos_company_access'
  ) THEN
    CREATE POLICY "photos_company_access" ON photos
      FOR SELECT USING (
        company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
      );
  END IF;
END $$;

-- =====================================================
-- PART 4: Backfill Historical Data (OPTIONAL)
-- =====================================================

-- Option A: Leave historical records as NULL (recommended for first deployment)
-- The frontend will handle NULL gracefully by showing "Unknown" or hiding the badge

-- Option B: Backfill with first admin user (run this AFTER deployment if needed)
-- Uncomment the following lines if you want to backfill:

/*
-- Backfill expenses with first admin user per company
UPDATE expenses e
SET uploaded_by = (
  SELECT u.id
  FROM users u
  WHERE u.company_id = e.company_id
    AND u.role IN ('super-admin', 'admin')
  ORDER BY u.created_at ASC
  LIMIT 1
)
WHERE uploaded_by IS NULL;

-- Backfill photos with first admin user per company
UPDATE photos p
SET uploaded_by = (
  SELECT u.id
  FROM users u
  WHERE u.company_id = p.company_id
    AND u.role IN ('super-admin', 'admin')
  ORDER BY u.created_at ASC
  LIMIT 1
)
WHERE uploaded_by IS NULL;
*/

-- Option C: Backfill with system user (create a "System" user first)
-- This is useful if you want to attribute historical data to a special account

/*
-- First, create a system user (run once):
-- INSERT INTO users (name, email, role, company_id, is_active)
-- SELECT 'System', 'system@legacy-prime.com', 'admin', id, false
-- FROM companies
-- WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'system@legacy-prime.com');

-- Then backfill:
-- UPDATE expenses SET uploaded_by = (SELECT id FROM users WHERE email = 'system@legacy-prime.com' AND company_id = expenses.company_id) WHERE uploaded_by IS NULL;
-- UPDATE photos SET uploaded_by = (SELECT id FROM users WHERE email = 'system@legacy-prime.com' AND company_id = photos.company_id) WHERE uploaded_by IS NULL;
*/

-- =====================================================
-- PART 5: Verification Queries (Run after migration)
-- =====================================================

-- Check expenses table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'expenses' AND column_name = 'uploaded_by';

-- Check photos table structure
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'photos' AND column_name = 'uploaded_by';

-- Check indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('expenses', 'photos')
--   AND indexname LIKE '%uploaded_by%';

-- Count records with/without uploader
-- SELECT
--   'expenses' as table_name,
--   COUNT(*) as total_records,
--   COUNT(uploaded_by) as with_uploader,
--   COUNT(*) - COUNT(uploaded_by) as without_uploader
-- FROM expenses
-- UNION ALL
-- SELECT
--   'photos' as table_name,
--   COUNT(*) as total_records,
--   COUNT(uploaded_by) as with_uploader,
--   COUNT(*) - COUNT(uploaded_by) as without_uploader
-- FROM photos;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run verification queries above
-- 2. Proceed to Phase 2: Update tRPC context
-- 3. Proceed to Phase 3: Update backend procedures
-- =====================================================
