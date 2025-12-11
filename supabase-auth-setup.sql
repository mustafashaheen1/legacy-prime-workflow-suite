-- =====================================================
-- Supabase Auth Configuration
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- Enable email confirmations (Optional - for production)
-- For development, you can disable this in Settings → Authentication → Email Auth

-- =====================================================
-- Create function to handle auth user creation
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- This function is called after a new auth.users row is inserted
  -- We use it to ensure user metadata is synced

  -- The actual user profile is created by the application
  -- This trigger just ensures consistency

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new auth users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- Update RLS policies for better auth integration
-- =====================================================

-- Allow users to insert their own user record after signup
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON users;
CREATE POLICY "Allow users to insert their own profile" ON users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Allow users to update their own profile" ON users;
CREATE POLICY "Allow users to update their own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Companies can be inserted by authenticated users (for company signup)
DROP POLICY IF EXISTS "Allow company creation" ON companies;
CREATE POLICY "Allow company creation" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- =====================================================
-- Create indexes for better performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(id);
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(company_code);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================
-- Grant necessary permissions
-- =====================================================

-- Ensure authenticated users can query companies table
GRANT SELECT ON companies TO authenticated;
GRANT INSERT ON companies TO authenticated;
GRANT UPDATE ON companies TO authenticated;

-- Ensure authenticated users can query users table
GRANT SELECT ON users TO authenticated;
GRANT INSERT ON users TO authenticated;
GRANT UPDATE ON users TO authenticated;

-- =====================================================
-- DONE!
-- =====================================================
-- Next steps:
-- 1. Configure email templates in Supabase dashboard
-- 2. Set up email provider (optional for production)
-- 3. Test signup and login flows
-- =====================================================
