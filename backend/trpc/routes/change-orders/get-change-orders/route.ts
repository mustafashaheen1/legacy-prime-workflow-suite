import { publicProcedure } from '../../../create-context.js';
import { z } from 'zod';
import { ChangeOrder } from '../../../../../types/index';

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
