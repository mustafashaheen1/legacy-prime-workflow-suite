import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { sendNotification } from './lib/sendNotification.js';

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


  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time window.
    // Lower bound: 5 minutes in the past — catches reminders whose time has just
    // passed (e.g. user sets 7:10 reminder at 7:08, cron next fires at 7:10 but
    // AddTaskModal.toISOString() rounded up by a few seconds, pushing due_date_time
    // to 7:10:xx which is already behind 'now' when the cron queries at 7:10:00).
    // reminder_sent guard prevents double-firing for the same task.
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    

    // Query tasks that need reminders
    // - reminder is true
    // - reminder_sent is false (prevents duplicate fires)
    // - due_date_time is within [now-5min, now+30min]
    const { data: tasks, error } = await supabase
      .from('daily_tasks')
      .select('*')
      .eq('reminder', true)
      .eq('reminder_sent', false)
      .not('due_date_time', 'is', null)
      .gte('due_date_time', fiveMinutesAgo.toISOString())
      .lte('due_date_time', now.toISOString());

    if (error) {
      return res.status(500).json({ error: error.message });
    }


    const remindedTasks = [];

    // Process each task
    for (const task of tasks || []) {
      console.log('Processing task:', {
        id: task.id,
        title: task.title,
        dueDateTime: task.due_date_time
      });

      // Atomically claim this task — only one concurrent caller wins.
      // Adding .eq('reminder_sent', false) means if another instance already
      // set it to true, this UPDATE matches 0 rows and we skip sending.
      const { data: claimed, error: updateError } = await supabase
        .from('daily_tasks')
        .update({ reminder_sent: true })
        .eq('id', task.id)
        .eq('reminder_sent', false)
        .select('id');

      if (updateError) {
        continue;
      }

      if (!claimed || claimed.length === 0) {
=        continue;
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


    return res.status(200).json({
      success: true,
      remindedTasks,
      count: remindedTasks.length
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
