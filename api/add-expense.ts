import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[AddExpense] ===== API ROUTE STARTED =====');
  console.log('[AddExpense] Method:', req.method);

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, projectId, type, subcategory, amount, store, date, receiptUrl, imageHash, ocrFingerprint, imageSizeBytes } = req.body;

    console.log('[AddExpense] Adding expense:', amount, 'for project:', projectId);

    // Validate required fields
    if (!companyId || !projectId || !type || !subcategory || !amount || !store) {
      console.log('[AddExpense] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: companyId, projectId, type, subcategory, amount, store' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[AddExpense] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Final validation: check for duplicate image hash to prevent bypass
    if (imageHash) {
      console.log('[AddExpense] Validating image hash...');
      const { data: existingHash, error: hashError } = await supabase
        .from('expenses')
        .select('id, store, amount, date')
        .eq('company_id', companyId)
        .eq('image_hash', imageHash)
        .limit(1)
        .single();

      if (hashError && hashError.code !== 'PGRST116') {
        console.error('[AddExpense] Error checking duplicate hash:', hashError);
      }

      if (existingHash) {
        console.log('[AddExpense] Duplicate image hash detected:', existingHash.id);
        return res.status(409).json({
          error: 'Duplicate receipt detected',
          message: 'This receipt has already been added',
          existingExpense: {
            id: existingHash.id,
            store: existingHash.store,
            amount: Number(existingHash.amount),
            date: existingHash.date,
          },
        });
      }
    }

    console.log('[AddExpense] Inserting into database...');
    const insertStart = Date.now();

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        company_id: companyId,
        project_id: projectId,
        type: type,
        subcategory: subcategory,
        amount: amount,
        store: store,
        date: date || new Date().toISOString(),
        receipt_url: receiptUrl || null,
        image_hash: imageHash || null,
        ocr_fingerprint: ocrFingerprint || null,
        image_size_bytes: imageSizeBytes || null,
      })
      .select()
      .single();

    const insertDuration = Date.now() - insertStart;
    console.log(`[AddExpense] Database INSERT completed in ${insertDuration}ms`);

    if (error) {
      console.error('[AddExpense] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[AddExpense] ===== API ROUTE COMPLETED =====');
    console.log('[AddExpense] Expense created:', data.id);

    return res.status(200).json({
      success: true,
      expense: {
        id: data.id,
        projectId: data.project_id,
        type: data.type,
        subcategory: data.subcategory,
        amount: Number(data.amount),
        store: data.store,
        date: data.date,
        receiptUrl: data.receipt_url || undefined,
      },
      insertDuration,
    });
  } catch (error: any) {
    console.error('[AddExpense] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
