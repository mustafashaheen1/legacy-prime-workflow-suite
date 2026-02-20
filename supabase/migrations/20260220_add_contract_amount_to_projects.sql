-- Add contract_amount column to projects table
-- This stores the total amount sold/agreed with the client (separate from internal budget)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS contract_amount DECIMAL(15, 2);

-- Index not needed for this column (not queried as a filter)
-- Comment for clarity
COMMENT ON COLUMN projects.contract_amount IS 'Total contract/sale amount agreed with the client. Distinct from budget (internal cost target).';
