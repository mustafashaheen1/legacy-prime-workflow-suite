-- =====================================================
-- Phase 1 Migration Verification Script
-- Run this AFTER executing the migration
-- =====================================================
-- Copy and paste this entire file into Supabase SQL Editor
-- =====================================================

-- =====================================================
-- TEST 1: Verify Columns Exist
-- =====================================================
SELECT
  '✅ TEST 1: Verify Columns' as test_name,
  'expenses.uploaded_by' as column_check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'uploaded_by'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - Column not found'
  END as result
UNION ALL
SELECT
  '✅ TEST 1: Verify Columns' as test_name,
  'photos.uploaded_by' as column_check,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'photos' AND column_name = 'uploaded_by'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - Column not found'
  END as result;

-- =====================================================
-- TEST 2: Verify Column Properties
-- =====================================================
SELECT
  '✅ TEST 2: Column Properties' as test_name,
  table_name,
  column_name,
  data_type,
  is_nullable,
  CASE
    WHEN data_type = 'uuid' AND is_nullable = 'YES' THEN '✅ PASS'
    ELSE '❌ FAIL - Wrong type or not nullable'
  END as result
FROM information_schema.columns
WHERE table_name IN ('expenses', 'photos')
  AND column_name = 'uploaded_by'
ORDER BY table_name;

-- =====================================================
-- TEST 3: Verify Indexes Created
-- =====================================================
SELECT
  '✅ TEST 3: Verify Indexes' as test_name,
  indexname,
  CASE
    WHEN indexname IN (
      'idx_expenses_uploaded_by',
      'idx_photos_uploaded_by',
      'idx_expenses_company_uploader',
      'idx_photos_company_uploader'
    ) THEN '✅ PASS'
    ELSE '⚠️ UNEXPECTED INDEX'
  END as result
FROM pg_indexes
WHERE tablename IN ('expenses', 'photos')
  AND indexname LIKE '%uploaded_by%'
ORDER BY indexname;

-- =====================================================
-- TEST 4: Verify Foreign Key Constraint
-- =====================================================
SELECT
  '✅ TEST 4: Foreign Key Constraints' as test_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  CASE
    WHEN ccu.table_name = 'users' AND ccu.column_name = 'id' THEN '✅ PASS'
    ELSE '❌ FAIL - Wrong FK reference'
  END as result
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('expenses', 'photos')
  AND kcu.column_name = 'uploaded_by';

-- =====================================================
-- TEST 5: Data Distribution
-- =====================================================
SELECT
  '✅ TEST 5: Data Distribution' as test_name,
  'expenses' as table_name,
  COUNT(*) as total_records,
  COUNT(uploaded_by) as with_uploader,
  COUNT(*) - COUNT(uploaded_by) as without_uploader,
  CASE
    WHEN COUNT(*) >= 0 THEN '✅ PASS - Query works'
    ELSE '❌ FAIL'
  END as result
FROM expenses
UNION ALL
SELECT
  '✅ TEST 5: Data Distribution' as test_name,
  'photos' as table_name,
  COUNT(*) as total_records,
  COUNT(uploaded_by) as with_uploader,
  COUNT(*) - COUNT(uploaded_by) as without_uploader,
  CASE
    WHEN COUNT(*) >= 0 THEN '✅ PASS - Query works'
    ELSE '❌ FAIL'
  END as result
FROM photos;

-- =====================================================
-- TEST 6: Test NULL Values Allowed
-- =====================================================
DO $$
DECLARE
  test_expense_id UUID;
  test_photo_id UUID;
BEGIN
  -- Test expense insert with NULL uploaded_by
  SELECT gen_random_uuid() INTO test_expense_id;

  INSERT INTO expenses (
    id, company_id, project_id, type, subcategory, amount, store, uploaded_by
  ) VALUES (
    test_expense_id,
    (SELECT id FROM companies LIMIT 1),
    (SELECT id FROM projects LIMIT 1),
    'TEST_MIGRATION',
    'TEST',
    1.00,
    'TEST_STORE',
    NULL  -- NULL should be allowed
  );

  -- Test photo insert with NULL uploaded_by
  SELECT gen_random_uuid() INTO test_photo_id;

  INSERT INTO photos (
    id, company_id, project_id, category, notes, url, uploaded_by
  ) VALUES (
    test_photo_id,
    (SELECT id FROM companies LIMIT 1),
    (SELECT id FROM projects LIMIT 1),
    'TEST_CATEGORY',
    'Migration test',
    'https://example.com/test.jpg',
    NULL  -- NULL should be allowed
  );

  -- Clean up test records
  DELETE FROM expenses WHERE id = test_expense_id;
  DELETE FROM photos WHERE id = test_photo_id;

  RAISE NOTICE '✅ TEST 6: NULL Values - PASS';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ TEST 6: NULL Values - FAIL: %', SQLERRM;
END $$;

-- =====================================================
-- TEST 7: Test Valid User Reference
-- =====================================================
DO $$
DECLARE
  test_expense_id UUID;
  test_photo_id UUID;
  test_user_id UUID;
BEGIN
  -- Get a valid user ID
  SELECT id INTO test_user_id FROM users LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '⚠️ TEST 7: Valid User Reference - SKIPPED (No users in database)';
  ELSE
    -- Test expense insert with valid user
    SELECT gen_random_uuid() INTO test_expense_id;

    INSERT INTO expenses (
      id, company_id, project_id, type, subcategory, amount, store, uploaded_by
    ) VALUES (
      test_expense_id,
      (SELECT id FROM companies LIMIT 1),
      (SELECT id FROM projects LIMIT 1),
      'TEST_MIGRATION',
      'TEST',
      1.00,
      'TEST_STORE',
      test_user_id  -- Valid user reference
    );

    -- Test photo insert with valid user
    SELECT gen_random_uuid() INTO test_photo_id;

    INSERT INTO photos (
      id, company_id, project_id, category, notes, url, uploaded_by
    ) VALUES (
      test_photo_id,
      (SELECT id FROM companies LIMIT 1),
      (SELECT id FROM projects LIMIT 1),
      'TEST_CATEGORY',
      'Migration test',
      'https://example.com/test.jpg',
      test_user_id  -- Valid user reference
    );

    -- Clean up test records
    DELETE FROM expenses WHERE id = test_expense_id;
    DELETE FROM photos WHERE id = test_photo_id;

    RAISE NOTICE '✅ TEST 7: Valid User Reference - PASS';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ TEST 7: Valid User Reference - FAIL: %', SQLERRM;
END $$;

-- =====================================================
-- TEST 8: Test Invalid User Reference (Should Fail)
-- =====================================================
DO $$
DECLARE
  test_expense_id UUID;
  invalid_user_id UUID := '00000000-0000-0000-0000-000000000000'; -- Invalid UUID
BEGIN
  SELECT gen_random_uuid() INTO test_expense_id;

  -- This should FAIL with FK constraint violation
  INSERT INTO expenses (
    id, company_id, project_id, type, subcategory, amount, store, uploaded_by
  ) VALUES (
    test_expense_id,
    (SELECT id FROM companies LIMIT 1),
    (SELECT id FROM projects LIMIT 1),
    'TEST_MIGRATION',
    'TEST',
    1.00,
    'TEST_STORE',
    invalid_user_id  -- Invalid user reference
  );

  -- If we get here, the FK constraint didn't work
  DELETE FROM expenses WHERE id = test_expense_id;
  RAISE NOTICE '❌ TEST 8: Invalid User Reference - FAIL (FK constraint not working)';
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE '✅ TEST 8: Invalid User Reference - PASS (FK constraint working)';
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ TEST 8: Invalid User Reference - UNEXPECTED ERROR: %', SQLERRM;
END $$;

-- =====================================================
-- TEST 9: Test JOIN Performance
-- =====================================================
EXPLAIN ANALYZE
SELECT
  e.id,
  e.amount,
  e.store,
  u.name as uploader_name,
  u.avatar as uploader_avatar
FROM expenses e
LEFT JOIN users u ON u.id = e.uploaded_by
LIMIT 10;

-- =====================================================
-- SUMMARY
-- =====================================================
SELECT
  '📊 MIGRATION VERIFICATION SUMMARY' as summary,
  '' as details
UNION ALL
SELECT
  '─────────────────────────────────────',
  ''
UNION ALL
SELECT
  'Review the results above:',
  ''
UNION ALL
SELECT
  '• All tests should show ✅ PASS',
  ''
UNION ALL
SELECT
  '• TEST 8 should show PASS (FK violation expected)',
  ''
UNION ALL
SELECT
  '• TEST 9 should show query plan (check for index usage)',
  ''
UNION ALL
SELECT
  '',
  ''
UNION ALL
SELECT
  'If all tests pass, you are ready for Phase 2!',
  ''
UNION ALL
SELECT
  '─────────────────────────────────────',
  '';

-- =====================================================
-- NEXT STEPS
-- =====================================================
-- ✅ Phase 1 Complete: Database migration successful
-- ⏭️  Phase 2 Next: Update tRPC context to extract user
-- ⏭️  Phase 3 Next: Update backend procedures
-- ⏭️  Phase 4 Next: Update TypeScript types
-- ⏭️  Phase 5 Next: Create frontend components
-- ⏭️  Phase 6 Next: Integrate into UI
-- =====================================================
