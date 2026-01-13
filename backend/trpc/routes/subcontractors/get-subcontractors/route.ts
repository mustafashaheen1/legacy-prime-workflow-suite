import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const getSubcontractorsProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      trade: z.string().optional(),
      availability: z.enum(['available', 'busy', 'unavailable']).optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Subcontractors] Fetching subcontractors for company:', input.companyId);

    // Create Supabase client INSIDE the handler
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Subcontractors] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      let query = supabase
        .from('subcontractors')
        .select('*')
        .eq('company_id', input.companyId)
        .order('created_at', { ascending: false });

      // Apply optional filters
      if (input.trade) {
        query = query.eq('trade', input.trade);
      }
      if (input.availability) {
        query = query.eq('availability', input.availability);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[Subcontractors] Error fetching subcontractors:', error);
        throw new Error(`Failed to fetch subcontractors: ${error.message}`);
      }

      console.log('[Subcontractors] Fetched', data?.length || 0, 'subcontractors');

      // Convert database response to camelCase
      const subcontractors = (data || []).map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        companyName: sub.company_name,
        email: sub.email,
        phone: sub.phone,
        trade: sub.trade,
        rating: sub.rating || undefined,
        hourlyRate: sub.hourly_rate || undefined,
        availability: sub.availability as 'available' | 'busy' | 'unavailable',
        certifications: sub.certifications || [],
        address: sub.address || undefined,
        insuranceExpiry: sub.insurance_expiry || undefined,
        notes: sub.notes || undefined,
        avatar: sub.avatar || undefined,
        createdAt: sub.created_at,
        isActive: sub.is_active,
        approved: sub.approved,
        approvedBy: sub.approved_by || undefined,
        approvedDate: sub.approved_date || undefined,
        businessFiles: [],
        registrationToken: sub.registration_token || undefined,
        registrationCompleted: sub.registration_completed || false,
      }));

      return { subcontractors };
    } catch (error: any) {
      console.error('[Subcontractors] Unexpected error fetching subcontractors:', error);
      throw new Error(error.message || 'Failed to fetch subcontractors');
    }
  });
