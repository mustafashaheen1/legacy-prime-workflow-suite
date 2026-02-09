-- ============================================
-- ESTIMATE REQUESTS TABLE
-- ============================================
-- Purpose: Store estimate requests sent to subcontractors
-- Platforms: iOS, Android, Web
-- ============================================

CREATE TABLE IF NOT EXISTS estimate_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES subcontractors(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Request Details
  description TEXT NOT NULL CHECK (char_length(description) >= 10),
  required_by DATE,
  notes TEXT,

  -- Status Tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'viewed', 'responded', 'declined', 'cancelled')),

  -- Timestamps
  request_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Metadata
  notification_sent BOOLEAN DEFAULT FALSE,
  notification_type TEXT -- 'sms', 'email', 'push', 'all'
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_estimate_requests_project_id ON estimate_requests(project_id);
CREATE INDEX idx_estimate_requests_subcontractor_id ON estimate_requests(subcontractor_id);
CREATE INDEX idx_estimate_requests_company_id ON estimate_requests(company_id);
CREATE INDEX idx_estimate_requests_status ON estimate_requests(status);
CREATE INDEX idx_estimate_requests_requested_by ON estimate_requests(requested_by);
CREATE INDEX idx_estimate_requests_created_at ON estimate_requests(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE estimate_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Company members can view their company's requests
CREATE POLICY "estimate_requests_select_policy"
  ON estimate_requests
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
    )
  );

-- Policy: Company members can create requests
CREATE POLICY "estimate_requests_insert_policy"
  ON estimate_requests
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
    )
  );

-- Policy: Request creator can update their requests
CREATE POLICY "estimate_requests_update_policy"
  ON estimate_requests
  FOR UPDATE
  USING (
    requested_by = auth.uid() OR
    company_id IN (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super-admin')
    )
  );

-- Policy: Only admins can delete requests
CREATE POLICY "estimate_requests_delete_policy"
  ON estimate_requests
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_id
      FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'super-admin')
    )
  );

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_estimate_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_requests_updated_at
  BEFORE UPDATE ON estimate_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_requests_updated_at();

-- ============================================
-- TRIGGER: Mark as sent when status changes
-- ============================================
CREATE OR REPLACE FUNCTION update_estimate_request_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Update sent_at when status changes to 'sent'
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    NEW.sent_at = NOW();
  END IF;

  -- Update viewed_at when status changes to 'viewed'
  IF NEW.status = 'viewed' AND OLD.status != 'viewed' THEN
    NEW.viewed_at = NOW();
  END IF;

  -- Update responded_at when status changes to 'responded'
  IF NEW.status = 'responded' AND OLD.status != 'responded' THEN
    NEW.responded_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER estimate_request_status_timestamps
  BEFORE UPDATE ON estimate_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_estimate_request_status_timestamps();

-- ============================================
-- HELPER VIEW: Estimate Requests with Details
-- ============================================
CREATE OR REPLACE VIEW estimate_requests_detailed AS
SELECT
  er.*,
  p.name AS project_name,
  p.address AS project_address,
  s.name AS subcontractor_name,
  s.phone AS subcontractor_phone,
  s.email AS subcontractor_email,
  s.trade AS subcontractor_trade,
  u.name AS requester_name,
  u.email AS requester_email,
  c.name AS company_name
FROM estimate_requests er
LEFT JOIN projects p ON er.project_id = p.id
LEFT JOIN subcontractors s ON er.subcontractor_id = s.id
LEFT JOIN users u ON er.requested_by = u.id
LEFT JOIN companies c ON er.company_id = c.id;

-- Grant access to view
GRANT SELECT ON estimate_requests_detailed TO authenticated;
