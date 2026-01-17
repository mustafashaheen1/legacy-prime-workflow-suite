-- =====================================================
-- Migration: Add client_id and address to projects table
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Add client_id column to projects table (links project directly to a client)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Add address column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS address TEXT;

-- Create index for faster lookups by client_id
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);

-- =====================================================
-- Verification: Run this to verify columns were added
-- =====================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'projects'
-- AND column_name IN ('client_id', 'address');
