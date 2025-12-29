-- Add missing columns to existing estimates table

-- Add items column (JSONB)
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS items JSONB;

-- Add created_at and updated_at columns
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Verify the columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'estimates'
ORDER BY ordinal_position;
