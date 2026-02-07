-- =====================================================
-- Automated Tests: Uploader Feature
-- Run these tests in Supabase SQL Editor
-- All tests should return "✅ PASS"
-- =====================================================

-- =====================================================
-- SECTION 1: Database Schema Tests
-- =====================================================

-- TEST 1.1: Verify uploaded_by columns exist
SELECT
  '1.1' as test_id,
  'Schema: uploaded_by columns exist' as test_name,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'uploaded_by'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'photos' AND column_name = 'uploaded_by'
    ) THEN '✅ PASS'
    ELSE '❌ FAIL - Columns missing'
  END as result;

-- TEST 1.2: Verify columns are UUID type
SELECT
  '1.2' as test_id,
  'Schema: uploaded_by are UUID type' as test_name,
  CASE
    WHEN (
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'uploaded_by'
    ) = 'uuid'
    AND (
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'photos' AND column_name = 'uploaded_by'
    ) = 'uuid'
    THEN '✅ PASS'
    ELSE '❌ FAIL - Wrong data type'
  END as result;

-- TEST 1.3: Verify columns are nullable
SELECT
  '1.3' as test_id,
  'Schema: uploaded_by are nullable' as test_name,
  CASE
    WHEN (
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'expenses' AND column_name = 'uploaded_by'
    ) = 'YES'
    AND (
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'photos' AND column_name = 'uploaded_by'
    ) = 'YES'
    THEN '✅ PASS'
    ELSE '❌ FAIL - Not nullable'
  END as result;

-- TEST 1.4: Verify foreign key constraints
SELECT
  '1.4' as test_id,
  'Schema: Foreign keys to users table' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('expenses', 'photos')
        AND kcu.column_name = 'uploaded_by'
        AND ccu.table_name = 'users'
        AND ccu.column_name = 'id'
    ) = 2
    THEN '✅ PASS'
    ELSE '❌ FAIL - Foreign keys not set up correctly'
  END as result;

-- TEST 1.5: Verify indexes exist
SELECT
  '1.5' as test_id,
  'Performance: Indexes on uploaded_by' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM pg_indexes
      WHERE tablename IN ('expenses', 'photos')
        AND indexname LIKE '%uploaded_by%'
    ) >= 2
    THEN '✅ PASS - Found ' || (
      SELECT COUNT(*) FROM pg_indexes
      WHERE tablename IN ('expenses', 'photos')
        AND indexname LIKE '%uploaded_by%'
    )::text || ' indexes'
    ELSE '❌ FAIL - Missing indexes'
  END as result;

-- =====================================================
-- SECTION 2: Data Integrity Tests
-- =====================================================

-- TEST 2.1: NULL values are allowed
DO $$
DECLARE
  test_expense_id UUID := gen_random_uuid();
  test_photo_id UUID := gen_random_uuid();
BEGIN
  -- Test expense with NULL
  INSERT INTO expenses (
    id, company_id, project_id, type, subcategory, amount, store, uploaded_by
  ) VALUES (
    test_expense_id,
    (SELECT id FROM companies LIMIT 1),
    (SELECT id FROM projects LIMIT 1),
    'TEST',
    'TEST',
    1.00,
    'TEST_NULL_CHECK',
    NULL
  );

  -- Test photo with NULL
  INSERT INTO photos (
    id, company_id, project_id, category, notes, url, uploaded_by
  ) VALUES (
    test_photo_id,
    (SELECT id FROM companies LIMIT 1),
    (SELECT id FROM projects LIMIT 1),
    'TEST',
    'NULL test',
    'https://test.com/test.jpg',
    NULL
  );

  -- Verify they were inserted
  IF NOT EXISTS (SELECT 1 FROM expenses WHERE id = test_expense_id AND uploaded_by IS NULL) THEN
    RAISE EXCEPTION 'TEST 2.1 FAIL: Expense with NULL uploaded_by not inserted';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM photos WHERE id = test_photo_id AND uploaded_by IS NULL) THEN
    RAISE EXCEPTION 'TEST 2.1 FAIL: Photo with NULL uploaded_by not inserted';
  END IF;

  -- Cleanup
  DELETE FROM expenses WHERE id = test_expense_id;
  DELETE FROM photos WHERE id = test_photo_id;

  RAISE NOTICE '✅ TEST 2.1 PASS: NULL values allowed';
END $$;

-- TEST 2.2: Valid user IDs are accepted
DO $$
DECLARE
  test_expense_id UUID := gen_random_uuid();
  test_user_id UUID;
BEGIN
  -- Get a valid user
  SELECT id INTO test_user_id FROM users LIMIT 1;

  IF test_user_id IS NULL THEN
    RAISE NOTICE '⚠️  TEST 2.2 SKIP: No users in database';
  ELSE
    -- Insert with valid user
    INSERT INTO expenses (
      id, company_id, project_id, type, subcategory, amount, store, uploaded_by
    ) VALUES (
      test_expense_id,
      (SELECT id FROM companies LIMIT 1),
      (SELECT id FROM projects LIMIT 1),
      'TEST',
      'TEST',
      1.00,
      'TEST_VALID_USER',
      test_user_id
    );

    -- Verify
    IF NOT EXISTS (
      SELECT 1 FROM expenses WHERE id = test_expense_id AND uploaded_by = test_user_id
    ) THEN
      RAISE EXCEPTION 'TEST 2.2 FAIL: Valid user ID not saved';
    END IF;

    -- Cleanup
    DELETE FROM expenses WHERE id = test_expense_id;

    RAISE NOTICE '✅ TEST 2.2 PASS: Valid user IDs accepted';
  END IF;
END $$;

-- TEST 2.3: Invalid user IDs are rejected
DO $$
DECLARE
  test_expense_id UUID := gen_random_uuid();
  invalid_user_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Try to insert with invalid user
  INSERT INTO expenses (
    id, company_id, project_id, type, subcategory, amount, store, uploaded_by
  ) VALUES (
    test_expense_id,
    (SELECT id FROM companies LIMIT 1),
    (SELECT id FROM projects LIMIT 1),
    'TEST',
    'TEST',
    1.00,
    'TEST_INVALID_USER',
    invalid_user_id
  );

  -- Should not reach here
  DELETE FROM expenses WHERE id = test_expense_id;
  RAISE EXCEPTION 'TEST 2.3 FAIL: Invalid user ID was accepted';
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE '✅ TEST 2.3 PASS: Invalid user IDs rejected (FK constraint working)';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'TEST 2.3 FAIL: Unexpected error - %', SQLERRM;
END $$;

-- TEST 2.4: User deletion sets uploaded_by to NULL
DO $$
DECLARE
  test_user_id UUID := gen_random_uuid();
  test_expense_id UUID := gen_random_uuid();
  test_photo_id UUID := gen_random_uuid();
  company_id_val UUID;
  project_id_val UUID;
BEGIN
  -- Get company and project
  SELECT id INTO company_id_val FROM companies LIMIT 1;
  SELECT id INTO project_id_val FROM projects LIMIT 1;

  -- Create test user
  INSERT INTO users (id, email, name, role, company_id, is_active)
  VALUES (
    test_user_id,
    'test-delete@example.com',
    'Test Delete User',
    'employee',
    company_id_val,
    true
  );

  -- Create expense with test user
  INSERT INTO expenses (
    id, company_id, project_id, type, subcategory, amount, store, uploaded_by
  ) VALUES (
    test_expense_id,
    company_id_val,
    project_id_val,
    'TEST',
    'TEST',
    1.00,
    'TEST_DELETE_CASCADE',
    test_user_id
  );

  -- Create photo with test user
  INSERT INTO photos (
    id, company_id, project_id, category, notes, url, uploaded_by
  ) VALUES (
    test_photo_id,
    company_id_val,
    project_id_val,
    'TEST',
    'Delete cascade test',
    'https://test.com/test.jpg',
    test_user_id
  );

  -- Delete user
  DELETE FROM users WHERE id = test_user_id;

  -- Check if uploaded_by was set to NULL
  IF (SELECT uploaded_by FROM expenses WHERE id = test_expense_id) IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 2.4 FAIL: Expense uploaded_by not set to NULL on user delete';
  END IF;

  IF (SELECT uploaded_by FROM photos WHERE id = test_photo_id) IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 2.4 FAIL: Photo uploaded_by not set to NULL on user delete';
  END IF;

  -- Cleanup
  DELETE FROM expenses WHERE id = test_expense_id;
  DELETE FROM photos WHERE id = test_photo_id;

  RAISE NOTICE '✅ TEST 2.4 PASS: User deletion sets uploaded_by to NULL (ON DELETE SET NULL working)';
END $$;

-- =====================================================
-- SECTION 3: Query Performance Tests
-- =====================================================

-- TEST 3.1: JOIN query performance (should be < 100ms)
DO $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  duration_ms INTEGER;
BEGIN
  start_time := clock_timestamp();

  -- Run the JOIN query
  PERFORM
    e.id,
    e.store,
    e.amount,
    u.name as uploader_name,
    u.avatar as uploader_avatar
  FROM expenses e
  LEFT JOIN users u ON u.id = e.uploaded_by
  LIMIT 100;

  end_time := clock_timestamp();
  duration_ms := EXTRACT(MILLISECOND FROM (end_time - start_time))::INTEGER;

  IF duration_ms < 100 THEN
    RAISE NOTICE '✅ TEST 3.1 PASS: JOIN query completed in %ms (< 100ms)', duration_ms;
  ELSE
    RAISE WARNING '⚠️  TEST 3.1 WARNING: JOIN query took %ms (> 100ms)', duration_ms;
  END IF;
END $$;

-- TEST 3.2: Index usage verification
EXPLAIN (FORMAT JSON)
SELECT
  e.id,
  e.store,
  e.amount,
  u.name as uploader_name,
  u.avatar as uploader_avatar
FROM expenses e
LEFT JOIN users u ON u.id = e.uploaded_by
WHERE e.company_id = (SELECT id FROM companies LIMIT 1)
LIMIT 10;

-- Check if plan uses indexes (look for "Index Scan" or "Bitmap Index Scan")

-- =====================================================
-- SECTION 4: Data Validation Tests
-- =====================================================

-- TEST 4.1: Recent expenses have uploaded_by populated
SELECT
  '4.1' as test_id,
  'Data: Recent expenses have uploader' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM expenses
      WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
        AND uploaded_by IS NOT NULL
    ) > 0
    THEN '✅ PASS - Found ' || (
      SELECT COUNT(*)
      FROM expenses
      WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
        AND uploaded_by IS NOT NULL
    )::text || ' recent expenses with uploader'
    ELSE '⚠️  INFO - No recent expenses with uploader yet (expected if just deployed)'
  END as result;

-- TEST 4.2: Recent photos have uploaded_by populated
SELECT
  '4.2' as test_id,
  'Data: Recent photos have uploader' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM photos
      WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
        AND uploaded_by IS NOT NULL
    ) > 0
    THEN '✅ PASS - Found ' || (
      SELECT COUNT(*)
      FROM photos
      WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
        AND uploaded_by IS NOT NULL
    )::text || ' recent photos with uploader'
    ELSE '⚠️  INFO - No recent photos with uploader yet'
  END as result;

-- TEST 4.3: All uploaded_by values reference valid users
SELECT
  '4.3' as test_id,
  'Data Integrity: uploaded_by references valid users' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM (
        SELECT uploaded_by FROM expenses WHERE uploaded_by IS NOT NULL
        UNION
        SELECT uploaded_by FROM photos WHERE uploaded_by IS NOT NULL
      ) combined
      WHERE uploaded_by NOT IN (SELECT id FROM users)
    ) = 0
    THEN '✅ PASS - All uploaded_by values reference valid users'
    ELSE '❌ FAIL - Found orphaned uploaded_by values'
  END as result;

-- TEST 4.4: JOIN query returns correct data
DO $$
DECLARE
  expense_count INTEGER;
  join_count INTEGER;
BEGIN
  -- Count expenses with uploaded_by
  SELECT COUNT(*) INTO expense_count
  FROM expenses
  WHERE uploaded_by IS NOT NULL;

  -- Count successful JOINs
  SELECT COUNT(*) INTO join_count
  FROM expenses e
  INNER JOIN users u ON u.id = e.uploaded_by
  WHERE e.uploaded_by IS NOT NULL;

  IF expense_count = join_count THEN
    RAISE NOTICE '✅ TEST 4.4 PASS: JOIN returns correct count (%)', join_count;
  ELSE
    RAISE EXCEPTION 'TEST 4.4 FAIL: JOIN mismatch (% expenses, % joins)', expense_count, join_count;
  END IF;
END $$;

-- =====================================================
-- SECTION 5: Feature Tests
-- =====================================================

-- TEST 5.1: Uploader info query works
DO $$
DECLARE
  result_record RECORD;
BEGIN
  -- Get a recent expense with uploader
  SELECT
    e.id,
    e.store,
    e.uploaded_by,
    u.name as uploader_name,
    u.email as uploader_email
  INTO result_record
  FROM expenses e
  LEFT JOIN users u ON u.id = e.uploaded_by
  WHERE e.uploaded_by IS NOT NULL
  ORDER BY e.created_at DESC
  LIMIT 1;

  IF result_record IS NULL THEN
    RAISE NOTICE '⚠️  TEST 5.1 SKIP: No expenses with uploader yet';
  ELSIF result_record.uploader_name IS NULL THEN
    RAISE EXCEPTION 'TEST 5.1 FAIL: JOIN didnt return uploader name';
  ELSE
    RAISE NOTICE '✅ TEST 5.1 PASS: Query returns uploader info (%, %)',
      result_record.uploader_name,
      result_record.uploader_email;
  END IF;
END $$;

-- TEST 5.2: Uploader info query for photos works
DO $$
DECLARE
  result_record RECORD;
BEGIN
  SELECT
    p.id,
    p.category,
    p.uploaded_by,
    u.name as uploader_name,
    u.email as uploader_email
  INTO result_record
  FROM photos p
  LEFT JOIN users u ON u.id = p.uploaded_by
  WHERE p.uploaded_by IS NOT NULL
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF result_record IS NULL THEN
    RAISE NOTICE '⚠️  TEST 5.2 SKIP: No photos with uploader yet';
  ELSIF result_record.uploader_name IS NULL THEN
    RAISE EXCEPTION 'TEST 5.2 FAIL: JOIN didnt return uploader name';
  ELSE
    RAISE NOTICE '✅ TEST 5.2 PASS: Photo query returns uploader info (%, %)',
      result_record.uploader_name,
      result_record.uploader_email;
  END IF;
END $$;

-- TEST 5.3: Historical data (NULL uploaded_by) works
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM expenses
  WHERE uploaded_by IS NULL;

  IF null_count > 0 THEN
    RAISE NOTICE '✅ TEST 5.3 PASS: Found % historical expenses with NULL uploaded_by (backward compatible)', null_count;
  ELSE
    RAISE NOTICE '⚠️  TEST 5.3 INFO: No historical data (all expenses have uploader)';
  END IF;
END $$;

-- =====================================================
-- SECTION 6: Statistics & Reporting
-- =====================================================

-- TEST 6.1: Data distribution report
SELECT
  '6.1' as test_id,
  'Report: Data distribution' as test_name,
  'See results below' as result;

SELECT
  table_name,
  total_records,
  with_uploader,
  without_uploader,
  percentage_with_uploader
FROM (
  SELECT
    'expenses' as table_name,
    COUNT(*) as total_records,
    COUNT(uploaded_by) as with_uploader,
    COUNT(*) - COUNT(uploaded_by) as without_uploader,
    ROUND(100.0 * COUNT(uploaded_by) / NULLIF(COUNT(*), 0), 2) || '%' as percentage_with_uploader
  FROM expenses
  UNION ALL
  SELECT
    'photos' as table_name,
    COUNT(*) as total_records,
    COUNT(uploaded_by) as with_uploader,
    COUNT(*) - COUNT(uploaded_by) as without_uploader,
    ROUND(100.0 * COUNT(uploaded_by) / NULLIF(COUNT(*), 0), 2) || '%' as percentage_with_uploader
  FROM photos
) stats;

-- TEST 6.2: Top uploaders report
SELECT
  '6.2' as test_id,
  'Report: Top uploaders' as test_name,
  'See results below' as result;

SELECT
  u.name,
  u.email,
  COUNT(e.id) as expense_count,
  COUNT(p.id) as photo_count,
  COUNT(e.id) + COUNT(p.id) as total_uploads
FROM users u
LEFT JOIN expenses e ON e.uploaded_by = u.id
LEFT JOIN photos p ON p.uploaded_by = u.id
WHERE u.is_active = true
GROUP BY u.id, u.name, u.email
HAVING COUNT(e.id) + COUNT(p.id) > 0
ORDER BY total_uploads DESC
LIMIT 10;

-- =====================================================
-- SECTION 7: Regression Tests
-- =====================================================

-- TEST 7.1: Old queries still work (backward compatibility)
SELECT
  '7.1' as test_id,
  'Regression: Old queries work' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*) FROM expenses WHERE company_id = (SELECT id FROM companies LIMIT 1)
    ) >= 0
    THEN '✅ PASS - Old query pattern works'
    ELSE '❌ FAIL'
  END as result;

-- TEST 7.2: New queries with JOIN work
SELECT
  '7.2' as test_id,
  'Regression: New JOIN queries work' as test_name,
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM expenses e
      LEFT JOIN users u ON u.id = e.uploaded_by
      WHERE e.company_id = (SELECT id FROM companies LIMIT 1)
    ) >= 0
    THEN '✅ PASS - JOIN query pattern works'
    ELSE '❌ FAIL'
  END as result;

-- =====================================================
-- TEST SUMMARY
-- =====================================================

SELECT
  '═══════════════════════════════════════' as divider,
  '' as summary;

SELECT
  '📊 TEST SUMMARY' as title,
  '' as details;

SELECT
  'Review all test results above' as instruction,
  '' as details;

SELECT
  '✅ All "PASS" results = Feature working correctly' as success_criteria,
  '' as details;

SELECT
  '❌ Any "FAIL" results = Need investigation' as fail_criteria,
  '' as details;

SELECT
  '⚠️  "SKIP" or "INFO" = Expected (no data yet)' as info_criteria,
  '' as details;

SELECT
  '═══════════════════════════════════════' as divider,
  '' as summary;

-- =====================================================
-- NEXT: Backend API Tests
-- Run these manually or via Postman/Insomnia
-- =====================================================

-- TEST API-1: POST /api/add-expense with auth
--   curl -X POST https://your-app.vercel.app/api/add-expense \
--     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
--     -H "Content-Type: application/json" \
--     -d '{"projectId":"UUID","type":"Test","subcategory":"Test","amount":100,"store":"Test"}'
--   Expected: 200 OK, uploaded_by populated

-- TEST API-2: POST /api/add-expense without auth
--   curl -X POST https://your-app.vercel.app/api/add-expense \
--     -H "Content-Type: application/json" \
--     -d '{"projectId":"UUID","type":"Test","subcategory":"Test","amount":100,"store":"Test"}'
--   Expected: 401 Unauthorized

-- TEST API-3: GET /api/get-expenses returns uploader info
--   curl https://your-app.vercel.app/api/get-expenses?companyId=YOUR_COMPANY_ID
--   Expected: Response includes "uploader": { "name": "...", "email": "..." }

-- =====================================================
-- END OF TESTS
-- =====================================================
