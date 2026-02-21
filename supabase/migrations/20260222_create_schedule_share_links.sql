CREATE TABLE IF NOT EXISTS schedule_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT true,
  password TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_share_links_project ON schedule_share_links(project_id);
CREATE INDEX IF NOT EXISTS idx_schedule_share_links_token ON schedule_share_links(token);
ALTER TABLE schedule_share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read schedule share links" ON schedule_share_links;
DROP POLICY IF EXISTS "Service role full access schedule share links" ON schedule_share_links;
CREATE POLICY "Public read schedule share links" ON schedule_share_links FOR SELECT USING (true);
CREATE POLICY "Service role full access schedule share links" ON schedule_share_links FOR ALL USING (true) WITH CHECK (true);
