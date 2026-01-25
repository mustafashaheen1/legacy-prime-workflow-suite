-- Create registration_tokens table for tracking invitation tokens
CREATE TABLE IF NOT EXISTS registration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ
);

-- Create index on token for fast lookups
CREATE INDEX IF NOT EXISTS idx_registration_tokens_token ON registration_tokens(token);

-- Create index on company_id
CREATE INDEX IF NOT EXISTS idx_registration_tokens_company ON registration_tokens(company_id);
