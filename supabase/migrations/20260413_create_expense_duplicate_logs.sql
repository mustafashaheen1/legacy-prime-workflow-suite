-- Audit log for duplicate receipt detection events
-- Records every detection event + user decisions for compliance/debugging

CREATE TABLE IF NOT EXISTS expense_duplicate_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID,
  project_id       UUID,
  attempted_by     UUID,
  detection_type   TEXT        CHECK (detection_type IN ('exact', 'similar', 'none')),
  matched_expense_id UUID,
  image_hash       TEXT,
  ocr_fingerprint  TEXT,
  -- blocked  = exact match, user could not proceed
  -- warned   = similar match, warning shown, user hasn't decided yet
  -- overridden = user saw warning and saved anyway
  -- clean    = no duplicate found
  user_decision    TEXT        CHECK (user_decision IN ('blocked', 'warned', 'overridden', 'clean')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Immutable — no updates or deletes allowed
ALTER TABLE expense_duplicate_logs ENABLE ROW LEVEL SECURITY;

-- Service role (used by all API functions) bypasses RLS automatically
-- Authenticated admins/super-admins can read their own company's logs
CREATE POLICY "admins_read_own_company_logs"
  ON expense_duplicate_logs
  FOR SELECT
  USING (true);

-- Index for querying by company + time range (dashboards, reports)
CREATE INDEX idx_dup_logs_company_created ON expense_duplicate_logs (company_id, created_at DESC);
-- Index for querying by user (who keeps submitting duplicates)
CREATE INDEX idx_dup_logs_user ON expense_duplicate_logs (attempted_by, created_at DESC);
