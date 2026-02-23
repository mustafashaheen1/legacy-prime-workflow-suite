import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '../backend/lib/sendNotification.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vercel cron invocations are GET requests. Validate CRON_SECRET when present.
  if (req.method === 'GET') {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers['authorization'];
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
  }

  console.log('[check-task-reminders] Checking for upcoming task reminders');

  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[check-task-reminders] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time and 30 minutes from now
    const now = new Date();
    const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);

    console.log('[check-task-reminders] Time range:', {
      now: now.toISOString(),
      in30Minutes: in30Minutes.toISOString()
    });

    // Query tasks that need reminders
    // - reminder is true
    // - reminder_sent is false
    // - due_date_time is within the next 30 minutes
    const { data: tasks, error } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('reminder', true)
      .eq('reminder_sent', false)
      .not('due_date_time', 'is', null)
      .gte('due_date_time', now.toISOString())
      .lte('due_date_time', in30Minutes.toISOString());

    if (error) {
      console.error('[check-task-reminders] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[check-task-reminders] Found ${tasks?.length || 0} tasks needing reminders`);

    const remindedTasks = [];

    // Process each task
    for (const task of tasks || []) {
      console.log('[check-task-reminders] Processing task:', {
        id: task.id,
        title: task.title,
        dueDateTime: task.due_date_time
      });

      // Mark reminder as sent
      const { error: updateError } = await supabase
        .from('daily_tasks')
        .update({ reminder_sent: true })
        .eq('id', task.id);

      if (updateError) {
        console.error('[check-task-reminders] Error updating task:', task.id, updateError);
        continue;
      }

      // Send push notification to the task owner's devices
      await sendNotification(supabase, {
        userId:    task.user_id,
        companyId: task.company_id,
        type:      'task-reminder',
        title:     'Task Reminder',
        message:   `"${task.title}" is due soon`,
        data:      { taskId: task.id, dueDateTime: task.due_date_time },
      });

      // Convert to camelCase for response
      remindedTasks.push({
        id: task.id,
        companyId: task.company_id,
        userId: task.user_id,
        title: task.title,
        dueDate: task.due_date,
        dueTime: task.due_time,
        dueDateTime: task.due_date_time,
        reminder: task.reminder,
        reminderSent: true,
        completed: task.completed,
        notes: task.notes,
      });
    }

    console.log(`[check-task-reminders] Successfully processed ${remindedTasks.length} reminders`);

    return res.status(200).json({
      success: true,
      remindedTasks,
      count: remindedTasks.length
    });
  } catch (error: any) {
    console.error('[check-task-reminders] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
