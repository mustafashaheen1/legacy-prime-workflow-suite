-- =====================================================
-- Migration: Backfill users.is_active + add DEFAULT
-- Date: 2026-02-26
-- Problem: Admin/super-admin accounts created before the
--   approval workflow existed may have is_active = NULL,
--   causing notifyCompanyAdmins to skip them entirely
--   (.eq('is_active', true) never matches NULL).
-- Fix: Set DEFAULT TRUE so future inserts are always
--   active, then backfill NULL rows for privileged roles.
-- =====================================================

-- 1. Ensure the column has a DEFAULT so new rows never land as NULL.
ALTER TABLE users
  ALTER COLUMN is_active SET DEFAULT TRUE;

-- 2. Backfill: any admin or super-admin whose is_active is NULL
--    should be considered active (they were created before the
--    approval system existed and have been using the app).
UPDATE users
SET    is_active = TRUE
WHERE  is_active IS NULL
  AND  role IN ('admin', 'super-admin');

-- 3. Safety net: mark remaining NULL rows (e.g. pending employees
--    created before the column existed) as inactive so the approval
--    gate still applies to them.
UPDATE users
SET    is_active = FALSE
WHERE  is_active IS NULL;
