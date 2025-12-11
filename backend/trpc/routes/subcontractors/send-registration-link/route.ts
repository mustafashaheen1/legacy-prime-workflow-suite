import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";

export const sendRegistrationLinkProcedure = publicProcedure
  .input(
    z.object({
      email: z.string().email().optional(),
      phone: z.string().optional(),
      name: z.string().optional(),
      method: z.enum(['email', 'sms']),
    })
  )
  .mutation(async ({ input }) => {
    const token = `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const registrationLink = `${process.env.EXPO_PUBLIC_APP_URL || 'https://rork.app'}/subcontractor-register/${token}`;

    console.log('[Subcontractor] Generated registration link:', registrationLink);
    console.log('[Subcontractor] Method:', input.method);

    if (input.method === 'email' && input.email) {
      console.log('[Subcontractor] Sending registration link to email:', input.email);
    } else if (input.method === 'sms' && input.phone) {
      console.log('[Subcontractor] Sending registration link to phone:', input.phone);
    }

    return {
      token,
      registrationLink,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  });
