-- =====================================================
-- Fix for RLS Infinite Recursion Issue
-- =====================================================
-- Run this in Supabase SQL Editor to fix the policy issue
-- =====================================================

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view their own company" ON companies;
DROP POLICY IF EXISTS "Users can update their own company" ON companies;
DROP POLICY IF EXISTS "Users can view users in their company" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;

-- Create simpler, non-recursive policies

-- Companies: Allow authenticated users to view companies
-- (We'll add more granular control later)
CREATE POLICY "Allow authenticated users to view companies" ON companies
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update companies" ON companies
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert companies" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Users: Allow authenticated users to view users
CREATE POLICY "Allow authenticated users to view users" ON users
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update users" ON users
  FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert users" ON users
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Note: These are permissive policies for development
-- In production, you'll want to add company_id checks
-- using auth.jwt() -> 'company_id' claims instead of subqueries

-- =====================================================
-- Alternative: Temporary disable RLS for testing
-- =====================================================
-- Uncomment these if you want to test without RLS first:

-- ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- DONE! Now test your connection again
-- =====================================================
