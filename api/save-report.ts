import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Direct API endpoint for saving a report to the database
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Save Report] Starting request...');

  try {
    const {
      companyId,
      name,
      type,
      projectIds,
      projectsCount,
      totalBudget,
      totalExpenses,
      totalHours,
      fileUrl,
      notes,
      dateRange,
      employeeIds,
      employeeData,
      expensesByCategory,
      projects,
    } = req.body;

    // Validate required fields
    if (!companyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }
    if (!type) {
      return res.status(400).json({ error: 'Missing required field: type' });
    }

    // Validate report type
    const validTypes = ['administrative', 'financial', 'time-tracking', 'expenses', 'custom'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Save Report] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Save Report] Saving report:', name, 'for company:', companyId);

    const { data, error } = await supabase
      .from('reports')
      .insert({
        company_id: companyId,
        name: name,
        type: type,
        generated_date: new Date().toISOString(),
        project_ids: projectIds || [],
        projects_count: projectsCount || 0,
        total_budget: totalBudget || 0,
        total_expenses: totalExpenses || 0,
        total_hours: totalHours || 0,
        file_url: fileUrl || null,
        notes: notes || null,
        date_range: dateRange || null,
        employee_ids: employeeIds || [],
        employee_data: employeeData || null,
        expenses_by_category: expensesByCategory || null,
        projects: projects || null,
      })
      .select()
      .single();

    console.log('[Save Report] Database insert completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Save Report] Database error:', error);
      return res.status(500).json({ error: `Failed to save report: ${error.message}` });
    }

    console.log('[Save Report] Success. Total time:', Date.now() - startTime, 'ms');

    // Convert snake_case back to camelCase for response
    const report = {
      id: data.id,
      name: data.name,
      type: data.type,
      generatedDate: data.generated_date,
      projectIds: data.project_ids || [],
      projectsCount: data.projects_count || 0,
      totalBudget: data.total_budget || 0,
      totalExpenses: data.total_expenses || 0,
      totalHours: data.total_hours || 0,
      fileUrl: data.file_url || undefined,
      notes: data.notes || undefined,
      dateRange: data.date_range || undefined,
      employeeIds: data.employee_ids || [],
      employeeData: data.employee_data || undefined,
      expensesByCategory: data.expenses_by_category || undefined,
      projects: data.projects || undefined,
      createdAt: data.created_at,
    };

    return res.status(200).json({
      success: true,
      report,
    });
  } catch (error: any) {
    console.error('[Save Report] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to save report',
    });
  }
}
