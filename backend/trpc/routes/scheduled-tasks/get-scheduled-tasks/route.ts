import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { ScheduledTask } from '../../../../../types/index';

const scheduledTasksStore: ScheduledTask[] = [];

export const getScheduledTasksProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Backend] Fetching scheduled tasks for project:', input.projectId);

    // Use in-memory store for now
    // TODO: Add Supabase persistence later
    console.log('[Backend] Using in-memory store, total tasks:', scheduledTasksStore.length);

    const filteredTasks = input.projectId
      ? scheduledTasksStore.filter(task => task.projectId === input.projectId)
      : scheduledTasksStore;

    console.log('[Backend] Returning', filteredTasks.length, 'scheduled tasks for project:', input.projectId);
    return { scheduledTasks: filteredTasks };
  });

export { scheduledTasksStore };
