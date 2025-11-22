import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const createSubcontractorProcedure = publicProcedure
  .input(
    z.object({
      name: z.string(),
      companyName: z.string(),
      email: z.string().email(),
      phone: z.string(),
      trade: z.string(),
      rating: z.number().optional(),
      hourlyRate: z.number().optional(),
      availability: z.enum(['available', 'busy', 'unavailable']),
      certifications: z.array(z.string()).optional(),
      address: z.string().optional(),
      insuranceExpiry: z.string().optional(),
      notes: z.string().optional(),
      avatar: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const subcontractor = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      createdAt: new Date().toISOString(),
      isActive: true,
    };

    console.log('[Subcontractor] Created subcontractor:', subcontractor.name);
    return subcontractor;
  });
