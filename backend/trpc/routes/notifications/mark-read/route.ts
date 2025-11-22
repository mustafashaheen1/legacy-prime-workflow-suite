import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const markNotificationReadProcedure = publicProcedure
  .input(
    z.object({
      notificationId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Notification] Marked as read:', input.notificationId);
    return { success: true };
  });
