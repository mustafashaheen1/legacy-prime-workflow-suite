import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[add-daily-task] Request body:', JSON.stringify(req.body));

  try {
    const { companyId, userId, title, dueDate, reminder, notes } = req.body;

    // Validate required fields
    if (!title || !dueDate) {
      console.log('[add-daily-task] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: title and dueDate' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[add-daily-task] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Use provided IDs or fallback to a default/placeholder
    const finalCompanyId = companyId || null;
    const finalUserId = userId || null;

    console.log('[add-daily-task] Inserting task:', { title, dueDate, companyId: finalCompanyId, userId: finalUserId });

    const { data, error } = await supabase
      .from('daily_tasks')
      .insert({
        company_id: finalCompanyId,
        user_id: finalUserId,
        title,
        due_date: dueDate,
        reminder: reminder || false,
        completed: false,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[add-daily-task] Database error:', error.message, error.code, error.details);
      return res.status(500).json({
        error: error.message,
        code: error.code,
        details: error.details
      });
    }

    console.log('[add-daily-task] Task created successfully:', data.id);

    // Convert snake_case to camelCase for response
    const task = {
      id: data.id,
      companyId: data.company_id,
      userId: data.user_id,
      title: data.title,
      dueDate: data.due_date,
      reminder: data.reminder,
      completed: data.completed,
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return res.status(200).json(task);
  } catch (error: any) {
    console.error('[add-daily-task] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
