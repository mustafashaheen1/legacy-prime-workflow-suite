-- Migration: Set initial last_contacted and last_contact_date for existing clients
-- This migration updates clients that don't have these fields set

-- Update clients that don't have last_contacted or last_contact_date
-- Use created_at as the initial contact date if available, otherwise use current time
UPDATE clients
SET
  last_contacted = COALESCE(
    last_contacted,
    'Initial contact - ' || TO_CHAR(COALESCE(created_at, NOW()), 'Mon DD, YYYY')
  ),
  last_contact_date = COALESCE(
    last_contact_date,
    COALESCE(created_at, NOW())
  )
WHERE last_contacted IS NULL OR last_contact_date IS NULL;
