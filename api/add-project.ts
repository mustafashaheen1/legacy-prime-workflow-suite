import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 15,
};

// Direct API endpoint for adding a project - bypasses tRPC for better performance and reliability
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  console.log('[Add Project] Starting request...');

  try {
    const { companyId, name, budget, expenses, progress, status, image, hoursWorked, startDate, endDate, estimateId, clientId, address } = req.body;

    // Validate required fields
    if (!companyId) {
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name' });
    }

    // Validate status value
    const validStatuses = ['active', 'completed', 'on-hold', 'archived'];
    const projectStatus = status || 'active';
    if (!validStatuses.includes(projectStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    // Create Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Add Project] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Add Project] Adding project:', name, 'for company:', companyId);

    // Only use columns that exist in the projects table
    const insertData: any = {
      company_id: companyId,
      name: name,
      budget: budget || 0,
      expenses: expenses || 0,
      progress: progress || 0,
      status: projectStatus,
      image: image || null,
      hours_worked: hoursWorked || 0,
      start_date: startDate || new Date().toISOString(),
      end_date: endDate || null,
    };

    // Add estimate_id if provided (links project to estimate)
    if (estimateId) {
      insertData.estimate_id = estimateId;
    }

    // Add client_id if provided (links project to client)
    if (clientId) {
      insertData.client_id = clientId;
    }

    // Add address if provided
    if (address) {
      insertData.address = address;
    }

    const { data, error } = await supabase
      .from('projects')
      .insert(insertData)
      .select()
      .single();

    console.log('[Add Project] Database insert completed in', Date.now() - startTime, 'ms');

    if (error) {
      console.error('[Add Project] Database error:', error);
      return res.status(500).json({ error: `Failed to add project: ${error.message}` });
    }

    console.log('[Add Project] Success. Total time:', Date.now() - startTime, 'ms');

    // Convert snake_case back to camelCase for response
    const project = {
      id: data.id,
      name: data.name,
      budget: Number(data.budget) || 0,
      expenses: Number(data.expenses) || 0,
      progress: data.progress || 0,
      status: data.status as 'active' | 'completed' | 'on-hold' | 'archived',
      image: data.image || '',
      hoursWorked: Number(data.hours_worked) || 0,
      startDate: data.start_date,
      endDate: data.end_date || undefined,
      estimateId: data.estimate_id || undefined,
      clientId: data.client_id || undefined,
      address: data.address || undefined,
    };

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error: any) {
    console.error('[Add Project] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to add project',
    });
  }
}
