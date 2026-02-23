-- Drop and recreate notifications table.
-- Safe: the previous system stored notifications only in AsyncStorage (device-local),
-- so no server-side data exists to preserve.
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL,
  type        TEXT        NOT NULL CHECK (type IN (
    'estimate-received',
    'proposal-submitted',
    'payment-received',
    'change-order',
    'general',
    'task-reminder'
  )),
  title       TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  data        JSONB,
  read        BOOLEAN     NOT NULL DEFAULT FALSE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id    ON notifications(user_id);
CREATE INDEX idx_notifications_company_id ON notifications(company_id);
-- Partial index: fast unread-count queries
CREATE INDEX idx_notifications_unread     ON notifications(user_id, created_at DESC) WHERE read = FALSE;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access notifications" ON notifications;
CREATE POLICY "Service role full access notifications"
  ON notifications FOR ALL
  USING (true)
  WITH CHECK (true);

-- Drop and recreate push_tokens table.
DROP TABLE IF EXISTS push_tokens CASCADE;

CREATE TABLE push_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL,
  platform    TEXT        NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_tokens_token_key UNIQUE (token)
);

CREATE INDEX idx_push_tokens_user_id    ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_company_id ON push_tokens(company_id);
-- Used when broadcasting to all active tokens for a user
CREATE INDEX idx_push_tokens_active     ON push_tokens(user_id, is_active) WHERE is_active = TRUE;

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access push_tokens" ON push_tokens;
CREATE POLICY "Service role full access push_tokens"
  ON push_tokens FOR ALL
  USING (true)
  WITH CHECK (true);
