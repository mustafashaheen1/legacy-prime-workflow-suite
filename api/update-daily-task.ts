import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { taskId, updates } = req.body;

    if (!taskId) {
      return res.status(400).json({ error: 'Missing taskId' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Convert camelCase to snake_case for database
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.reminder !== undefined) dbUpdates.reminder = updates.reminder;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    // Handle completion status and timestamp
    if (updates.completed !== undefined) {
      dbUpdates.completed = updates.completed;
      // Automatically set/clear completed_at timestamp
      dbUpdates.completed_at = updates.completed ? new Date().toISOString() : null;
    }

    const { data, error } = await supabase
      .from('daily_tasks')
      .update(dbUpdates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating daily task:', error);
      return res.status(500).json({ error: error.message });
    }

    // Convert snake_case to camelCase for response
    const task = {
      id: data.id,
      companyId: data.company_id,
      userId: data.user_id,
      title: data.title,
      dueDate: data.due_date,
      dueTime: data.due_time,
      dueDateTime: data.due_date_time,
      reminder: data.reminder,
      reminderSent: data.reminder_sent,
      completed: data.completed,
      completedAt: data.completed_at, // Include completion timestamp
      notes: data.notes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return res.status(200).json(task);
  } catch (error: any) {
    console.error('Unexpected error in update-daily-task:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
