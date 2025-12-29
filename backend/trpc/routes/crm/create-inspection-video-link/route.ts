import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";

export const createInspectionVideoLinkProcedure = publicProcedure
  .input(
    z.object({
      token: z.string().uuid(),
      clientId: z.string().uuid(),
      companyId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
      clientName: z.string(),
      clientEmail: z.string().email().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[CRM] ===== PROCEDURE STARTED =====');
    console.log('[CRM] Creating inspection video link for:', input.clientName);
    console.log('[CRM] Token:', input.token);

    // TEMPORARY: Skip database entirely to test if this is the issue
    // Just return success immediately
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://legacy-prime-workflow-suite.vercel.app';
    const inspectionUrl = `${baseUrl}/inspection-video/${input.token}`;

    console.log('[CRM] Returning success WITHOUT database insert (test mode)');
    console.log('[CRM] ===== PROCEDURE COMPLETED =====');

    return {
      success: true,
      token: input.token,
      inspectionUrl,
      expiresAt: expiresAt.toISOString(),
    };
  });
