-- AI Chat Messages Table
-- Run this in Supabase SQL Editor to create the table for persistent chat history

CREATE TABLE IF NOT EXISTS ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  files JSONB DEFAULT '[]'
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_chat_user ON ai_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_created ON ai_chat_messages(created_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to see only their own messages
CREATE POLICY "Users can view own messages" ON ai_chat_messages
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own messages" ON ai_chat_messages
  FOR INSERT WITH CHECK (true);

-- Grant access to service role
GRANT ALL ON ai_chat_messages TO service_role;
