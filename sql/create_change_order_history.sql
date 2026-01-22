-- Change Order History Table
-- Run this in Supabase SQL Editor to create audit tracking for change orders

CREATE TABLE IF NOT EXISTS change_order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'updated')),
  previous_status TEXT CHECK (previous_status IN ('pending', 'approved', 'rejected')),
  new_status TEXT CHECK (new_status IN ('pending', 'approved', 'rejected')),
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_change_order_history_change_order ON change_order_history(change_order_id);
CREATE INDEX IF NOT EXISTS idx_change_order_history_timestamp ON change_order_history(timestamp DESC);

-- Enable Row Level Security
ALTER TABLE change_order_history ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view change order history
CREATE POLICY "Users can view change order history"
  ON change_order_history FOR SELECT
  USING (true);

-- Policy to allow users to insert change order history
CREATE POLICY "Users can insert change order history"
  ON change_order_history FOR INSERT
  WITH CHECK (true);

-- Grant access to service role
GRANT ALL ON change_order_history TO service_role;
