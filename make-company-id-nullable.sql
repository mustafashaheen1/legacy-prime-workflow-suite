-- Make company_id nullable in estimates table
ALTER TABLE estimates ALTER COLUMN company_id DROP NOT NULL;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
