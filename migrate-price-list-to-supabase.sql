-- Migration: Create price_list_items table and populate with data

-- Step 1: Create the price_list_items table
CREATE TABLE IF NOT EXISTS price_list_items (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  unit TEXT NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  labor_cost DECIMAL(10, 2),
  material_cost DECIMAL(10, 2),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_price_list_category ON price_list_items(category);
CREATE INDEX IF NOT EXISTS idx_price_list_company ON price_list_items(company_id);
CREATE INDEX IF NOT EXISTS idx_price_list_custom ON price_list_items(is_custom);

-- Step 2: Create categories table for better organization
CREATE TABLE IF NOT EXISTS price_list_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert price list categories
INSERT INTO price_list_categories (id, name, sort_order) VALUES
('cat-1', 'Pre-Construction', 1),
('cat-2', 'Foundation and Waterproofing', 2),
('cat-3', 'Storm drainage & footing drainage', 3),
('cat-4', 'Lumber and hardware material', 4),
('cat-5', 'Frame Labor only', 5),
('cat-6', 'Roof material & labor', 6),
('cat-7', 'Windows and exterior doors', 7),
('cat-8', 'Siding', 8),
('cat-9', 'Plumbing', 9),
('cat-10', 'Fire sprinklers', 10),
('cat-11', 'Fire Alarm', 11),
('cat-12', 'Mechanical/HVAC', 12),
('cat-13', 'Electrical', 13),
('cat-14', 'Insulation', 14),
('cat-15', 'Drywall', 15),
('cat-16', 'Flooring & Carpet & Tile', 16),
('cat-17', 'Interior Doors', 17),
('cat-18', 'Mill/Trim Work', 18),
('cat-19', 'Painting', 19),
('cat-20', 'Cabinets', 20),
('cat-21', 'Countertops', 21),
('cat-22', 'Appliances', 22),
('cat-23', 'Masonry', 23),
('cat-24', 'Stairs', 24),
('cat-25', 'Gutters', 25),
('cat-26', 'Decks & patios', 26),
('cat-27', 'Grading & Site Work', 27),
('cat-28', 'Concrete', 28),
('cat-29', 'Specialty Items', 29)
ON CONFLICT (id) DO NOTHING;
