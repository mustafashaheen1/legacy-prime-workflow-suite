-- AI user memory table for cross-session context retention.
-- Alex (the AI assistant) saves key facts about each user — preferences, working
-- patterns, project types, recurring clients — so conversations feel continuous
-- across sessions rather than starting from scratch every time.
--
-- One row per (user_id, key). Upsert on conflict to update existing memories.

CREATE TABLE IF NOT EXISTS ai_user_memory (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL,
  company_id UUID        NOT NULL,
  key        TEXT        NOT NULL,
  value      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS ai_user_memory_user_id_idx ON ai_user_memory(user_id);

-- RLS: users can only read/write their own memory rows.
ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own memory"
  ON ai_user_memory
  FOR ALL
  USING (auth.uid() = user_id);

-- Service role bypasses RLS — API routes use service key so this is fine.
