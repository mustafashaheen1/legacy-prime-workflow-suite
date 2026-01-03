-- Team Chat Database Schema
-- This schema enables real-time team messaging with role-based access control

-- =====================================================
-- 1. TEAM_USERS TABLE
-- =====================================================
-- Stores team members with their roles and profile information
-- Note: This extends the existing authentication system

CREATE TABLE IF NOT EXISTS team_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  avatar_url TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_team_users_email ON team_users(email);
CREATE INDEX IF NOT EXISTS idx_team_users_role ON team_users(role);
CREATE INDEX IF NOT EXISTS idx_team_users_active ON team_users(is_active);

-- =====================================================
-- 2. TEAM_CONVERSATIONS TABLE
-- =====================================================
-- Stores conversations between team members
-- Supports both individual (1-on-1) and group chats

CREATE TABLE IF NOT EXISTS team_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  type TEXT NOT NULL CHECK (type IN ('individual', 'group')),
  created_by UUID REFERENCES team_users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_team_conversations_type ON team_conversations(type);
CREATE INDEX IF NOT EXISTS idx_team_conversations_updated ON team_conversations(updated_at DESC);

-- =====================================================
-- 3. TEAM_CONVERSATION_PARTICIPANTS TABLE
-- =====================================================
-- Maps users to conversations (many-to-many relationship)

CREATE TABLE IF NOT EXISTS team_conversation_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES team_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES team_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(conversation_id, user_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_participants_conversation ON team_conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_participants_user ON team_conversation_participants(user_id);

-- =====================================================
-- 4. TEAM_MESSAGES TABLE
-- =====================================================
-- Stores all chat messages with support for different message types

CREATE TABLE IF NOT EXISTS team_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES team_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES team_users(id),
  type TEXT NOT NULL CHECK (type IN ('text', 'image', 'file', 'voice')),
  content TEXT,
  file_name TEXT,
  file_url TEXT,
  duration INTEGER, -- For voice messages (in seconds)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT false
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON team_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON team_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON team_messages(created_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Enable RLS on all tables
ALTER TABLE team_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

-- Users can read all active team members
CREATE POLICY "Users can view active team members"
  ON team_users FOR SELECT
  USING (is_active = true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON team_users FOR UPDATE
  USING (id = auth.uid());

-- Users can view conversations they participate in
CREATE POLICY "Users can view their conversations"
  ON team_conversations FOR SELECT
  USING (
    id IN (
      SELECT conversation_id
      FROM team_conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- Users can create conversations
CREATE POLICY "Users can create conversations"
  ON team_conversations FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Users can view participants in their conversations
CREATE POLICY "Users can view conversation participants"
  ON team_conversation_participants FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id
      FROM team_conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- Users can join conversations they're invited to
CREATE POLICY "Users can join conversations"
  ON team_conversation_participants FOR INSERT
  WITH CHECK (true); -- Controlled by application logic

-- Users can read messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
  ON team_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT conversation_id
      FROM team_conversation_participants
      WHERE user_id = auth.uid()
    )
    AND is_deleted = false
  );

-- Users can send messages to their conversations
CREATE POLICY "Users can send messages to their conversations"
  ON team_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
      SELECT conversation_id
      FROM team_conversation_participants
      WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
  ON team_messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for team_users
CREATE TRIGGER update_team_users_updated_at
  BEFORE UPDATE ON team_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for team_conversations
CREATE TRIGGER update_team_conversations_updated_at
  BEFORE UPDATE ON team_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Update conversation last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE team_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON team_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- =====================================================
-- SAMPLE DATA (for development/testing)
-- =====================================================

-- Insert sample admin user
-- INSERT INTO team_users (id, email, name, role, avatar_url) VALUES
--   ('11111111-1111-1111-1111-111111111111', 'admin@legacyprime.com', 'Admin User', 'admin', 'https://i.pravatar.cc/150?img=12');

-- Insert sample employees
-- INSERT INTO team_users (email, name, role, avatar_url) VALUES
--   ('john.doe@legacyprime.com', 'John Doe', 'employee', 'https://i.pravatar.cc/150?img=1'),
--   ('jane.smith@legacyprime.com', 'Jane Smith', 'employee', 'https://i.pravatar.cc/150?img=5'),
--   ('mike.johnson@legacyprime.com', 'Mike Johnson', 'employee', 'https://i.pravatar.cc/150?img=3');
