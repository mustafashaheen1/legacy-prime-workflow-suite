import { publicProcedure } from "../../../create-context.js";
import { z } from "zod";
import { createClient } from '@supabase/supabase-js';

export const getExpensesProcedure = publicProcedure
  .input(
    z.object({
      companyId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
    })
  )
  .query(async ({ input }) => {
    console.log('[Expenses] Fetching expenses for company:', input.companyId);

    // Create Supabase client INSIDE the handler (not at module level)
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[Expenses] Supabase not configured');
      throw new Error('Database not configured. Please add Supabase environment variables.');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      // 🎯 PHASE 3: JOIN with users table to get uploader info
      let query = supabase
        .from('expenses')
        .select(`
          *,
          uploader:uploaded_by (
            id,
            name,
            avatar,
            email
          )
        `)
        .eq('company_id', input.companyId);

      if (input.projectId) {
        query = query.eq('project_id', input.projectId);
      }

      const { data, error } = await query.order('date', { ascending: false });

      if (error) {
        console.error('[Expenses] Error fetching expenses:', error);
        throw new Error(`Failed to fetch expenses: ${error.message}`);
      }

      console.log('[Expenses] Found', data?.length || 0, 'expenses');

      const expenses = (data || []).map((expense: any) => ({
        id: expense.id,
        projectId: expense.project_id,
        companyId: expense.company_id,
        type: expense.type,
        subcategory: expense.subcategory,
        amount: Number(expense.amount),
        store: expense.store,
        date: expense.date,
        receiptUrl: expense.receipt_url || undefined,
        imageHash: expense.image_hash || undefined,
        ocrFingerprint: expense.ocr_fingerprint || undefined,
        imageSizeBytes: expense.image_size_bytes || undefined,
        createdAt: expense.created_at,
        clockEntryId: expense.clock_entry_id || undefined,
        // 🎯 PHASE 3: Include uploader info from JOIN
        uploadedBy: expense.uploaded_by || undefined,
        uploader: expense.uploader ? {
          id: expense.uploader.id,
          name: expense.uploader.name,
          avatar: expense.uploader.avatar || undefined,
          email: expense.uploader.email,
        } : null,
      }));

      return {
        success: true,
        expenses,
      };
    } catch (error: any) {
      console.error('[Expenses] Unexpected error fetching expenses:', error);
      throw new Error(error.message || 'Failed to fetch expenses');
    }
  });
