import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, userId } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: 'Missing companyId' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase
      .from('daily_tasks')
      .select('*')
      .eq('company_id', companyId)
      .order('due_date', { ascending: true });

    // Optionally filter by userId if provided
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching daily tasks:', error);
      return res.status(500).json({ error: error.message });
    }

    // Convert snake_case to camelCase for response
    const tasks = (data || []).map((task: any) => ({
      id: task.id,
      companyId: task.company_id,
      userId: task.user_id,
      title: task.title,
      dueDate: task.due_date,
      dueTime: task.due_time,
      dueDateTime: task.due_date_time,
      reminder: task.reminder,
      reminderSent: task.reminder_sent,
      completed: task.completed,
      notes: task.notes,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    }));

    return res.status(200).json(tasks);
  } catch (error: any) {
    console.error('Unexpected error in get-daily-tasks:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
