import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const getNotificationsProcedure = publicProcedure
  .input(
    z.object({
      unreadOnly: z.boolean().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    console.log('[Notifications] Fetching notifications:', input);
    return [];
  });
