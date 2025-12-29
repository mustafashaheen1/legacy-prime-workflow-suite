-- PostgreSQL function to insert estimates (bypasses PostgREST schema cache)
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION insert_estimate(
  p_id TEXT,
  p_project_id TEXT,
  p_name TEXT,
  p_items TEXT,
  p_subtotal NUMERIC,
  p_tax_rate NUMERIC,
  p_tax_amount NUMERIC,
  p_total NUMERIC,
  p_status TEXT,
  p_created_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
  id TEXT,
  project_id TEXT,
  name TEXT,
  items JSONB,
  subtotal NUMERIC,
  tax_rate NUMERIC,
  tax_amount NUMERIC,
  total NUMERIC,
  status TEXT,
  created_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  INSERT INTO estimates (
    id,
    project_id,
    name,
    items,
    subtotal,
    tax_rate,
    tax_amount,
    total,
    status,
    created_date
  ) VALUES (
    p_id,
    p_project_id,
    p_name,
    p_items::JSONB,
    p_subtotal,
    p_tax_rate,
    p_tax_amount,
    p_total,
    p_status,
    p_created_date
  )
  RETURNING
    estimates.id,
    estimates.project_id,
    estimates.name,
    estimates.items,
    estimates.subtotal,
    estimates.tax_rate,
    estimates.tax_amount,
    estimates.total,
    estimates.status,
    estimates.created_date,
    estimates.created_at,
    estimates.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
