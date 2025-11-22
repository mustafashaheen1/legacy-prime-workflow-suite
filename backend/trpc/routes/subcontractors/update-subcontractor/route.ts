import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const updateSubcontractorProcedure = publicProcedure
  .input(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      companyName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      trade: z.string().optional(),
      rating: z.number().optional(),
      hourlyRate: z.number().optional(),
      availability: z.enum(['available', 'busy', 'unavailable']).optional(),
      certifications: z.array(z.string()).optional(),
      address: z.string().optional(),
      insuranceExpiry: z.string().optional(),
      notes: z.string().optional(),
      avatar: z.string().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Subcontractor] Updating subcontractor:', input.id);
    return { success: true };
  });
