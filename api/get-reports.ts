import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// API endpoint to fetch reports from the database
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, limit = '50' } = req.query;

    if (!companyId || typeof companyId !== 'string') {
      return res.status(400).json({ error: 'Missing required parameter: companyId' });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Get Reports] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const queryLimit = Math.min(parseInt(limit as string, 10) || 50, 100);

    console.log('[Get Reports] Fetching reports for company:', companyId, 'limit:', queryLimit);

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('company_id', companyId)
      .order('generated_date', { ascending: false })
      .limit(queryLimit);

    if (error) {
      console.error('[Get Reports] Database error:', error);
      return res.status(500).json({ error: `Failed to fetch reports: ${error.message}` });
    }

    console.log('[Get Reports] Found', data?.length || 0, 'reports');

    // Convert snake_case to camelCase for frontend
    const reports = (data || []).map((report: any) => ({
      id: report.id,
      name: report.name,
      type: report.type,
      generatedDate: report.generated_date,
      projectIds: report.project_ids || [],
      projectsCount: report.projects_count || 0,
      totalBudget: report.total_budget || 0,
      totalExpenses: report.total_expenses || 0,
      totalHours: report.total_hours || 0,
      fileUrl: report.file_url || undefined,
      notes: report.notes || undefined,
      dateRange: report.date_range || undefined,
      employeeIds: report.employee_ids || [],
      employeeData: report.employee_data || undefined,
      expensesByCategory: report.expenses_by_category || undefined,
      projects: report.projects || undefined,
      createdAt: report.created_at,
    }));

    return res.status(200).json({
      success: true,
      reports,
    });
  } catch (error: any) {
    console.error('[Get Reports] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch reports' });
  }
}
