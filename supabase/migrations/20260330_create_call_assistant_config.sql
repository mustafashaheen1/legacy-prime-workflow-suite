CREATE TABLE IF NOT EXISTS call_assistant_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID UNIQUE NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  greeting TEXT NOT NULL DEFAULT 'Thank you for calling us. How can I help you today?',
  project_question TEXT NOT NULL DEFAULT 'What type of project do you need help with?',
  budget_question TEXT NOT NULL DEFAULT 'What is your budget for this project?',
  auto_add_to_crm BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
