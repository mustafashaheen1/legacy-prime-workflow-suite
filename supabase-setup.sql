-- =====================================================
-- Legacy Prime Construction - Supabase Database Setup
-- =====================================================
-- Run this SQL in the Supabase SQL Editor
-- This creates all tables, relationships, and security policies
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- COMPANIES TABLE
-- =====================================================
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo TEXT,
  brand_color TEXT DEFAULT '#3b82f6',
  license_number TEXT,
  office_phone TEXT,
  cell_phone TEXT,
  address TEXT,
  email TEXT,
  website TEXT,
  slogan TEXT,
  estimate_template TEXT,
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
  subscription_plan TEXT DEFAULT 'basic' CHECK (subscription_plan IN ('basic', 'pro', 'enterprise')),
  subscription_start_date TIMESTAMPTZ DEFAULT NOW(),
  subscription_end_date TIMESTAMPTZ,
  employee_count INTEGER DEFAULT 0,
  company_code TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  settings JSONB DEFAULT '{"features": {"crm": true, "estimates": true, "schedule": true, "expenses": true, "photos": true, "chat": true, "reports": true, "clock": true, "dashboard": true}, "maxUsers": 10, "maxProjects": 100}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('super-admin', 'admin', 'salesperson', 'field-employee', 'employee')),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  avatar TEXT,
  phone TEXT,
  address TEXT,
  hourly_rate DECIMAL(10, 2),
  rate_change_request JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PROJECTS TABLE
-- =====================================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  budget DECIMAL(12, 2) DEFAULT 0,
  expenses DECIMAL(12, 2) DEFAULT 0,
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'archived')),
  image TEXT,
  hours_worked DECIMAL(10, 2) DEFAULT 0,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CLIENTS TABLE (CRM)
-- =====================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  source TEXT CHECK (source IN ('Google', 'Referral', 'Ad', 'Phone Call')),
  status TEXT DEFAULT 'Lead' CHECK (status IN ('Lead', 'Project', 'Completed')),
  last_contacted TEXT,
  last_contact_date TIMESTAMPTZ,
  next_follow_up_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- EXPENSES TABLE
-- =====================================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  store TEXT NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PHOTOS TABLE
-- =====================================================
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  notes TEXT,
  url TEXT NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TASKS TABLE
-- =====================================================
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date TIMESTAMPTZ,
  reminder TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CLOCK ENTRIES TABLE
-- =====================================================
CREATE TABLE clock_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  location JSONB NOT NULL,
  work_performed TEXT,
  category TEXT,
  lunch_breaks JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ESTIMATES TABLE
-- =====================================================
CREATE TABLE estimates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subtotal DECIMAL(12, 2) DEFAULT 0,
  tax_rate DECIMAL(5, 2) DEFAULT 0,
  tax_amount DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE estimate_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  estimate_id UUID REFERENCES estimates(id) ON DELETE CASCADE,
  price_list_item_id TEXT,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  custom_price DECIMAL(10, 2),
  total DECIMAL(12, 2) NOT NULL,
  budget DECIMAL(12, 2),
  budget_unit_price DECIMAL(10, 2),
  notes TEXT,
  custom_name TEXT,
  custom_unit TEXT,
  custom_category TEXT,
  is_separator BOOLEAN DEFAULT false,
  separator_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- DAILY LOGS TABLE
-- =====================================================
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  equipment_note TEXT,
  material_note TEXT,
  official_note TEXT,
  subs_note TEXT,
  employees_note TEXT,
  work_performed TEXT,
  issues TEXT,
  general_notes TEXT,
  shared_with TEXT[], -- Array of user IDs
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_log_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_log_id UUID REFERENCES daily_logs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  completed BOOLEAN DEFAULT false
);

CREATE TABLE daily_log_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_log_id UUID REFERENCES daily_logs(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  author TEXT NOT NULL,
  notes TEXT
);

-- =====================================================
-- CALL LOGS TABLE (AI Receptionist)
-- =====================================================
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  caller_name TEXT NOT NULL,
  caller_phone TEXT NOT NULL,
  caller_email TEXT,
  call_date TIMESTAMPTZ DEFAULT NOW(),
  call_duration TEXT,
  call_type TEXT CHECK (call_type IN ('incoming', 'outgoing')),
  status TEXT CHECK (status IN ('answered', 'missed', 'voicemail')),
  is_qualified BOOLEAN DEFAULT false,
  qualification_score INTEGER,
  notes TEXT,
  transcript TEXT,
  project_type TEXT,
  budget TEXT,
  start_date TEXT,
  property_type TEXT,
  added_to_crm BOOLEAN DEFAULT false,
  scheduled_follow_up TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CHAT CONVERSATIONS & MESSAGES
-- =====================================================
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('individual', 'group')),
  participants TEXT[] NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  text TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice', 'image', 'file')),
  content TEXT,
  file_name TEXT,
  duration INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- REPORTS TABLE
-- =====================================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('administrative', 'financial', 'time-tracking', 'expenses', 'custom')),
  generated_date TIMESTAMPTZ DEFAULT NOW(),
  project_ids TEXT[],
  projects_count INTEGER,
  total_budget DECIMAL(12, 2),
  total_expenses DECIMAL(12, 2),
  total_hours DECIMAL(10, 2),
  file_url TEXT,
  notes TEXT,
  date_range JSONB,
  employee_ids TEXT[],
  employee_data JSONB,
  expenses_by_category JSONB,
  projects JSONB
);

-- =====================================================
-- PROJECT FILES TABLE
-- =====================================================
CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('receipts', 'photos', 'reports', 'plans', 'estimates', 'documentation', 'other')),
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uri TEXT NOT NULL,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  annotations JSONB
);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  client_name TEXT NOT NULL,
  method TEXT CHECK (method IN ('cash', 'check', 'credit-card', 'wire-transfer', 'other')),
  notes TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CHANGE ORDERS TABLE
-- =====================================================
CREATE TABLE change_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SUBCONTRACTORS TABLE
-- =====================================================
CREATE TABLE subcontractors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  trade TEXT NOT NULL,
  rating DECIMAL(3, 2),
  hourly_rate DECIMAL(10, 2),
  availability TEXT CHECK (availability IN ('available', 'busy', 'unavailable')),
  certifications TEXT[],
  address TEXT,
  insurance_expiry DATE,
  notes TEXT,
  avatar TEXT,
  is_active BOOLEAN DEFAULT true,
  approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_date TIMESTAMPTZ,
  registration_token TEXT UNIQUE,
  registration_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE business_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('license', 'insurance', 'w9', 'certificate', 'other')),
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uri TEXT NOT NULL,
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  expiry_date DATE,
  verified BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_date TIMESTAMPTZ,
  notes TEXT
);

-- =====================================================
-- ESTIMATE REQUESTS TABLE
-- =====================================================
CREATE TABLE estimate_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  request_date TIMESTAMPTZ DEFAULT NOW(),
  description TEXT NOT NULL,
  required_by TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'responded', 'declined')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SUBCONTRACTOR PROPOSALS TABLE
-- =====================================================
CREATE TABLE subcontractor_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  estimate_request_id UUID REFERENCES estimate_requests(id) ON DELETE CASCADE,
  subcontractor_id UUID REFERENCES subcontractors(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  timeline TEXT NOT NULL,
  proposal_date TIMESTAMPTZ DEFAULT NOW(),
  description TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected', 'negotiating')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('estimate-received', 'proposal-submitted', 'payment-received', 'change-order', 'general')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CUSTOM PRICE LIST ITEMS TABLE
-- =====================================================
CREATE TABLE custom_price_list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  labor_cost DECIMAL(10, 2),
  material_cost DECIMAL(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CUSTOM CATEGORIES TABLE
-- =====================================================
CREATE TABLE custom_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AI CHAT SESSIONS TABLE
-- =====================================================
CREATE TABLE ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Users
CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_email ON users(email);

-- Projects
CREATE INDEX idx_projects_company_id ON projects(company_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Clients
CREATE INDEX idx_clients_company_id ON clients(company_id);
CREATE INDEX idx_clients_status ON clients(status);

-- Expenses
CREATE INDEX idx_expenses_company_id ON expenses(company_id);
CREATE INDEX idx_expenses_project_id ON expenses(project_id);
CREATE INDEX idx_expenses_date ON expenses(date);

-- Photos
CREATE INDEX idx_photos_company_id ON photos(company_id);
CREATE INDEX idx_photos_project_id ON photos(project_id);

-- Tasks
CREATE INDEX idx_tasks_company_id ON tasks(company_id);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);

-- Clock Entries
CREATE INDEX idx_clock_entries_company_id ON clock_entries(company_id);
CREATE INDEX idx_clock_entries_employee_id ON clock_entries(employee_id);
CREATE INDEX idx_clock_entries_project_id ON clock_entries(project_id);
CREATE INDEX idx_clock_entries_clock_in ON clock_entries(clock_in);

-- Estimates
CREATE INDEX idx_estimates_company_id ON estimates(company_id);
CREATE INDEX idx_estimates_project_id ON estimates(project_id);

-- Daily Logs
CREATE INDEX idx_daily_logs_company_id ON daily_logs(company_id);
CREATE INDEX idx_daily_logs_project_id ON daily_logs(project_id);
CREATE INDEX idx_daily_logs_date ON daily_logs(log_date);

-- Chat
CREATE INDEX idx_chat_conversations_company_id ON chat_conversations(company_id);
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);

-- Call Logs
CREATE INDEX idx_call_logs_company_id ON call_logs(company_id);
CREATE INDEX idx_call_logs_call_date ON call_logs(call_date);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_log_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_log_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE change_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontractor_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_price_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - Allow users to access their company's data
-- =====================================================

-- Companies: Users can view their own company
CREATE POLICY "Users can view their own company" ON companies
  FOR SELECT USING (
    id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their own company" ON companies
  FOR UPDATE USING (
    id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Users: Users can view users in their company
CREATE POLICY "Users can view users in their company" ON users
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (id = auth.uid());

-- Projects: Users can access projects in their company
CREATE POLICY "Users can view projects in their company" ON projects
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Clients: Users can access clients in their company
CREATE POLICY "Users can manage clients in their company" ON clients
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Expenses: Users can access expenses in their company
CREATE POLICY "Users can manage expenses in their company" ON expenses
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Photos: Users can access photos in their company
CREATE POLICY "Users can manage photos in their company" ON photos
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Tasks: Users can access tasks in their company
CREATE POLICY "Users can manage tasks in their company" ON tasks
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Clock Entries: Users can access clock entries in their company
CREATE POLICY "Users can manage clock entries in their company" ON clock_entries
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Estimates: Users can access estimates in their company
CREATE POLICY "Users can manage estimates in their company" ON estimates
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Estimate Items: Users can access estimate items in their company
CREATE POLICY "Users can manage estimate items" ON estimate_items
  FOR ALL USING (
    estimate_id IN (
      SELECT id FROM estimates WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Daily Logs: Users can access daily logs in their company
CREATE POLICY "Users can manage daily logs in their company" ON daily_logs
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Daily Log Tasks
CREATE POLICY "Users can manage daily log tasks" ON daily_log_tasks
  FOR ALL USING (
    daily_log_id IN (
      SELECT id FROM daily_logs WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Daily Log Photos
CREATE POLICY "Users can manage daily log photos" ON daily_log_photos
  FOR ALL USING (
    daily_log_id IN (
      SELECT id FROM daily_logs WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Call Logs: Users can access call logs in their company
CREATE POLICY "Users can manage call logs in their company" ON call_logs
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Chat Conversations: Users can access conversations they're part of
CREATE POLICY "Users can view their conversations" ON chat_conversations
  FOR SELECT USING (
    auth.uid()::text = ANY(participants) AND
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "Users can create conversations" ON chat_conversations
  FOR INSERT WITH CHECK (
    auth.uid()::text = ANY(participants) AND
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Chat Messages: Users can access messages in their conversations
CREATE POLICY "Users can view messages in their conversations" ON chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE auth.uid()::text = ANY(participants)
    )
  );

CREATE POLICY "Users can send messages" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE auth.uid()::text = ANY(participants)
    )
  );

-- Reports: Users can access reports in their company
CREATE POLICY "Users can manage reports in their company" ON reports
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Project Files: Users can access files in their company
CREATE POLICY "Users can manage project files in their company" ON project_files
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Payments: Users can access payments in their company
CREATE POLICY "Users can manage payments in their company" ON payments
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Change Orders: Users can access change orders in their company
CREATE POLICY "Users can manage change orders in their company" ON change_orders
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Subcontractors: Users can access subcontractors in their company
CREATE POLICY "Users can manage subcontractors in their company" ON subcontractors
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Business Files
CREATE POLICY "Users can manage business files" ON business_files
  FOR ALL USING (
    subcontractor_id IN (
      SELECT id FROM subcontractors WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Estimate Requests: Users can access estimate requests in their company
CREATE POLICY "Users can manage estimate requests in their company" ON estimate_requests
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Subcontractor Proposals: Users can access proposals in their company
CREATE POLICY "Users can manage proposals in their company" ON subcontractor_proposals
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Notifications: Users can access their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Custom Price List Items: Users can access items in their company
CREATE POLICY "Users can manage custom price list items" ON custom_price_list_items
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Custom Categories: Users can access categories in their company
CREATE POLICY "Users can manage custom categories" ON custom_categories
  FOR ALL USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- AI Chat Sessions: Users can access their own sessions
CREATE POLICY "Users can manage their own AI chat sessions" ON ai_chat_sessions
  FOR ALL USING (
    user_id = auth.uid() AND
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- =====================================================
-- FUNCTIONS FOR AUTOMATIC TIMESTAMPS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_chat_sessions_updated_at BEFORE UPDATE ON ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Next steps:
-- 1. Set up Supabase Auth
-- 2. Configure Storage buckets for file uploads
-- 3. Install @supabase/supabase-js in your app
-- 4. Update your app code to use Supabase instead of AsyncStorage
-- =====================================================
