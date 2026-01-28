import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, userId, title, dueDate, reminder, notes } = req.body;

    if (!companyId || !userId || !title || !dueDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('daily_tasks')
      .insert([
        {
          company_id: companyId,
          user_id: userId,
          title,
          due_date: dueDate,
          reminder: reminder || false,
          completed: false,
          notes: notes || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating daily task:', error);
      return res.status(500).json({ error: error.message });
    }

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
    console.error('Unexpected error in add-daily-task:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
