-- Add RLS policies to allow admins to manage users in their company

-- Allow admins to update any user in their company
CREATE POLICY "Admins can update users in their company" ON users
  FOR UPDATE USING (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super-admin')
    )
  );

-- Allow admins to delete users in their company
CREATE POLICY "Admins can delete users in their company" ON users
  FOR DELETE USING (
    company_id IN (
      SELECT company_id FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'super-admin')
    )
  );
