import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const createSubcontractorProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      name: z.string().min(1),
      companyName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(1),
      trade: z.string().min(1),
      rating: z.number().optional(),
      hourlyRate: z.number().optional(),
      availability: z.enum(['available', 'busy', 'unavailable']).default('available'),
      certifications: z.array(z.string()).optional(),
      address: z.string().optional(),
      insuranceExpiry: z.string().optional(),
      notes: z.string().optional(),
      avatar: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    console.log('[Subcontractor] Creating subcontractor:', input.name, 'for company:', input.companyId);

    // Create Supabase client INSIDE the handler
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Subcontractor] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .insert({
          company_id: input.companyId,
          name: input.name,
          company_name: input.companyName,
          email: input.email,
          phone: input.phone,
          trade: input.trade,
          rating: input.rating,
          hourly_rate: input.hourlyRate,
          availability: input.availability,
          certifications: input.certifications || [],
          address: input.address,
          insurance_expiry: input.insuranceExpiry,
          notes: input.notes,
          avatar: input.avatar,
          is_active: true,
          approved: false,
        } as any)
        .select()
        .single();

      if (error) {
        console.error('[Subcontractor] Error creating subcontractor:', error);
        throw new Error(`Failed to create subcontractor: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from insert');
      }

      console.log('[Subcontractor] Subcontractor created successfully:', data.id);

      // Convert database response back to camelCase
      return {
        success: true,
        subcontractor: {
          id: data.id,
          name: data.name,
          companyName: data.company_name,
          email: data.email,
          phone: data.phone,
          trade: data.trade,
          rating: data.rating || undefined,
          hourlyRate: data.hourly_rate || undefined,
          availability: data.availability as 'available' | 'busy' | 'unavailable',
          certifications: data.certifications || [],
          address: data.address || undefined,
          insuranceExpiry: data.insurance_expiry || undefined,
          notes: data.notes || undefined,
          avatar: data.avatar || undefined,
          createdAt: data.created_at,
          isActive: data.is_active,
          approved: data.approved,
          approvedBy: data.approved_by || undefined,
          approvedDate: data.approved_date || undefined,
          businessFiles: [],
        },
      };
    } catch (error: any) {
      console.error('[Subcontractor] Unexpected error creating subcontractor:', error);
      throw new Error(error.message || 'Failed to create subcontractor');
    }
  });
