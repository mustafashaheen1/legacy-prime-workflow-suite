-- Add custom_permissions column to users table.
-- Stores per-user feature overrides as a JSONB map of { featureKey: boolean }.
-- Example: { "dashboard": false, "crm": true }
-- A key present and set to false DISABLES that feature for the user.
-- A key present and set to true ENABLES that feature even if the role doesn't grant it.
-- Missing keys fall back to the role's default permission set.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB NOT NULL DEFAULT '{}';
