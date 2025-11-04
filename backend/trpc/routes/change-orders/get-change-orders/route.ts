import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';

export const getChangeOrdersProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Backend] Fetching change orders for project:', input.projectId);
    
    return { changeOrders: [] };
  });
