import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';
import { ChangeOrder } from '@/types';

const changeOrdersStore: ChangeOrder[] = [];

export const getChangeOrdersProcedure = publicProcedure
  .input(
    z.object({
      projectId: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Backend] Fetching change orders for project:', input.projectId);
    
    const filteredChangeOrders = input.projectId 
      ? changeOrdersStore.filter(co => co.projectId === input.projectId)
      : changeOrdersStore;
    
    return { changeOrders: filteredChangeOrders };
  });

export { changeOrdersStore };
