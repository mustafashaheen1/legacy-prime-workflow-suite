-- Allow unauthenticated (anon) users to read the companies table.
-- Required for the employee signup flow: the user must look up a company
-- by company_code before they have an authenticated session.
-- Without this, the lookup returns 0 rows and shows a false "not found" error.
DROP POLICY IF EXISTS "Allow public company code lookup" ON companies;
CREATE POLICY "Allow public company code lookup"
  ON companies
  FOR SELECT
  TO anon
  USING (true);
