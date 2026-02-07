import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[GetExpenses] ===== API ROUTE STARTED =====');
  console.log('[GetExpenses] Method:', req.method);

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, projectId } = req.query;

    console.log('[GetExpenses] Fetching expenses for company:', companyId);

    // Validate required fields
    if (!companyId) {
      console.log('[GetExpenses] Missing required field: companyId');
      return res.status(400).json({ error: 'Missing required field: companyId' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[GetExpenses] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[GetExpenses] Querying database...');
    const queryStart = Date.now();

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
      .eq('company_id', companyId)
      .order('date', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    const queryDuration = Date.now() - queryStart;
    console.log(`[GetExpenses] Database query completed in ${queryDuration}ms`);

    if (error) {
      console.error('[GetExpenses] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Transform to frontend format
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
      // 🎯 PHASE 3: Include uploader info from JOIN
      uploadedBy: expense.uploaded_by || undefined,
      uploader: expense.uploader ? {
        id: expense.uploader.id,
        name: expense.uploader.name,
        avatar: expense.uploader.avatar || undefined,
        email: expense.uploader.email,
      } : null,
    }));

    console.log('[GetExpenses] ===== API ROUTE COMPLETED =====');
    console.log('[GetExpenses] Found', expenses.length, 'expenses');

    return res.status(200).json({
      success: true,
      expenses,
      count: expenses.length,
      queryDuration,
    });
  } catch (error: any) {
    console.error('[GetExpenses] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
