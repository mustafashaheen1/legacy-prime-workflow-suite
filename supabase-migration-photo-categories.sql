-- =====================================================
-- Migration: Add photo_categories table
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Create photo_categories table for company-specific photo categories
CREATE TABLE IF NOT EXISTS photo_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)  -- Prevent duplicate category names per company
);

-- Create index for faster lookups by company_id
CREATE INDEX IF NOT EXISTS idx_photo_categories_company_id ON photo_categories(company_id);

-- =====================================================
-- Seed default categories for all existing companies
-- =====================================================

-- Insert default photo categories for each company that exists
INSERT INTO photo_categories (company_id, name)
SELECT
  c.id as company_id,
  category.name
FROM
  companies c
CROSS JOIN (
  VALUES
    ('Foundation'),
    ('Framing'),
    ('Electrical'),
    ('Plumbing'),
    ('HVAC'),
    ('Drywall'),
    ('Painting'),
    ('Flooring'),
    ('Exterior'),
    ('Landscaping'),
    ('Other')
) AS category(name)
ON CONFLICT (company_id, name) DO NOTHING;

-- =====================================================
-- Verification: Run this to verify categories were added
-- =====================================================
-- SELECT c.name as company_name, pc.name as category_name
-- FROM photo_categories pc
-- JOIN companies c ON c.id = pc.company_id
-- ORDER BY c.name, pc.name;
