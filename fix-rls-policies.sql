-- Temporary fix: Drop the restrictive RLS policies and replace with service role bypass
-- Run this in Supabase SQL Editor to fix the timeout issue

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow public to validate token" ON inspection_videos;
DROP POLICY IF EXISTS "Allow public to complete upload" ON inspection_videos;
DROP POLICY IF EXISTS "Companies can view own videos" ON inspection_videos;
DROP POLICY IF EXISTS "Companies can create inspection links" ON inspection_videos;

-- Disable RLS temporarily to test if this is the issue
ALTER TABLE inspection_videos DISABLE ROW LEVEL SECURITY;

-- Note: If this fixes the timeout, we know it's an RLS issue
-- We can then re-enable with better policies that work with service role key
