-- Create payments table for tracking client payments received per project.
-- Previously the tRPC routes were stubs returning empty arrays; this table
-- gives them a real persistence layer.
CREATE TABLE IF NOT EXISTS payments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id      UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount          DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  date            DATE        NOT NULL,
  client_id       UUID,
  client_name     TEXT        NOT NULL DEFAULT '',
  method          TEXT        NOT NULL DEFAULT 'other'
                              CHECK (method IN ('cash', 'check', 'credit-card', 'wire-transfer', 'other')),
  notes           TEXT,
  receipt_url     TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_project_id ON payments(project_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by the backend with SUPABASE_SERVICE_ROLE_KEY).
CREATE POLICY "Service role full access payments"
  ON payments FOR ALL
  USING (true)
  WITH CHECK (true);
