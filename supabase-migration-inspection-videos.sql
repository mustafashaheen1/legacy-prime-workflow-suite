-- Create inspection_videos table for video inspection feature
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS inspection_videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token UUID NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  video_url TEXT,
  video_duration INTEGER,
  video_size BIGINT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_inspection_videos_token ON inspection_videos(token);
CREATE INDEX IF NOT EXISTS idx_inspection_videos_client_id ON inspection_videos(client_id);
CREATE INDEX IF NOT EXISTS idx_inspection_videos_company_id ON inspection_videos(company_id);
CREATE INDEX IF NOT EXISTS idx_inspection_videos_status ON inspection_videos(status);
CREATE INDEX IF NOT EXISTS idx_inspection_videos_created_at ON inspection_videos(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists, then create it
DROP TRIGGER IF EXISTS update_inspection_videos_updated_at ON inspection_videos;

CREATE TRIGGER update_inspection_videos_updated_at
  BEFORE UPDATE ON inspection_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE inspection_videos ENABLE ROW LEVEL SECURITY;

-- RLS Policies (drop if exist, then create)
DROP POLICY IF EXISTS "Allow public to validate token" ON inspection_videos;
CREATE POLICY "Allow public to validate token"
  ON inspection_videos
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow public to complete upload" ON inspection_videos;
CREATE POLICY "Allow public to complete upload"
  ON inspection_videos
  FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Companies can view own videos" ON inspection_videos;
CREATE POLICY "Companies can view own videos"
  ON inspection_videos
  FOR SELECT
  USING (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id')::uuid);

DROP POLICY IF EXISTS "Companies can create inspection links" ON inspection_videos;
CREATE POLICY "Companies can create inspection links"
  ON inspection_videos
  FOR INSERT
  WITH CHECK (company_id = (current_setting('request.jwt.claims', true)::json->>'company_id')::uuid);

COMMENT ON TABLE inspection_videos IS 'Stores video inspection requests and uploaded videos';
COMMENT ON COLUMN inspection_videos.token IS 'Unique token used in the public inspection link';
COMMENT ON COLUMN inspection_videos.status IS 'Status of inspection: pending or completed';
COMMENT ON COLUMN inspection_videos.video_url IS 'S3 key/path to the uploaded video';
COMMENT ON COLUMN inspection_videos.expires_at IS 'When the inspection link expires (typically 14 days)';
