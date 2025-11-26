import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const completeRegistrationProcedure = publicProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string(),
      companyName: z.string(),
      email: z.string().email(),
      phone: z.string(),
      trade: z.string(),
      license: z.string().optional(),
      address: z.string().optional(),
      insuranceExpiry: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const subcontractor = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      companyName: input.companyName,
      email: input.email,
      phone: input.phone,
      trade: input.trade,
      certifications: input.license ? [input.license] : [],
      address: input.address,
      insuranceExpiry: input.insuranceExpiry,
      notes: input.notes,
      availability: 'available' as const,
      createdAt: new Date().toISOString(),
      isActive: true,
      approved: false,
      registrationToken: input.token,
      registrationCompleted: true,
      businessFiles: [],
    };

    console.log('[Subcontractor] Registration completed:', subcontractor.name);
    return subcontractor;
  });
