import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Server-side hash generation (Node.js crypto)
async function generateImageHash(base64Data: string): Promise<string> {
  const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  return crypto
    .createHash('sha256')
    .update(base64Content)
    .digest('hex');
}

// OCR fingerprint generation
function generateOCRFingerprint(store: string, amount: number, date: string | Date): string {
  const normalizedStore = store
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');

  const formattedAmount = amount.toFixed(2);
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '');

  return `${normalizedStore}_${formattedAmount}_${dateStr}`;
}

export const config = {
  maxDuration: 30,
};

interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateType?: 'exact' | 'similar';
  matchedExpense?: {
    id: string;
    store: string;
    amount: number;
    date: string;
    createdAt: string;
  };
  canOverride: boolean;
  message: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[CheckDuplicate] ===== API ROUTE STARTED =====');
  console.log('[CheckDuplicate] Method:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { companyId, projectId, imageBase64, ocrData } = req.body;

    console.log('[CheckDuplicate] Checking for duplicates in project:', projectId);

    // Validate required fields
    if (!companyId || !projectId) {
      console.log('[CheckDuplicate] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: companyId, projectId' });
    }

    // If no image data, skip check
    if (!imageBase64) {
      console.log('[CheckDuplicate] No image data provided, skipping check');
      return res.status(200).json({
        isDuplicate: false,
        canOverride: true,
        message: 'No image provided',
      } as DuplicateCheckResult);
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[CheckDuplicate] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate image hash
    const imageHash = await generateImageHash(imageBase64);
    console.log('[CheckDuplicate] Generated image hash:', imageHash.substring(0, 16) + '...');

    // Check for exact duplicate (image hash match)
    console.log('[CheckDuplicate] Checking for exact duplicate...');
    const { data: exactMatch, error: exactError } = await supabase
      .from('expenses')
      .select('id, store, amount, date, created_at')
      .eq('company_id', companyId)
      .eq('image_hash', imageHash)
      .limit(1)
      .single();

    if (exactError && exactError.code !== 'PGRST116') {
      // PGRST116 is "no rows returned" - that's fine
      console.error('[CheckDuplicate] Database error checking exact match:', exactError);
    }

    if (exactMatch) {
      console.log('[CheckDuplicate] Found exact duplicate:', exactMatch.id);
      return res.status(200).json({
        isDuplicate: true,
        duplicateType: 'exact',
        matchedExpense: {
          id: exactMatch.id,
          store: exactMatch.store,
          amount: Number(exactMatch.amount),
          date: exactMatch.date,
          createdAt: exactMatch.created_at,
        },
        canOverride: false,
        message: 'This receipt has already been added. You cannot add the same receipt image twice.',
      } as DuplicateCheckResult);
    }

    // Check for similar duplicate (OCR fingerprint match)
    if (ocrData && ocrData.store && ocrData.amount && ocrData.date) {
      console.log('[CheckDuplicate] Checking for similar duplicate...');

      const ocrFingerprint = generateOCRFingerprint(
        ocrData.store,
        ocrData.amount,
        ocrData.date
      );
      console.log('[CheckDuplicate] Generated OCR fingerprint:', ocrFingerprint);

      // Calculate date 90 days ago
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const cutoffDate = ninetyDaysAgo.toISOString().split('T')[0];

      const { data: similarMatch, error: similarError } = await supabase
        .from('expenses')
        .select('id, store, amount, date, created_at')
        .eq('project_id', projectId)
        .eq('ocr_fingerprint', ocrFingerprint)
        .gte('date', cutoffDate)
        .limit(1)
        .single();

      if (similarError && similarError.code !== 'PGRST116') {
        console.error('[CheckDuplicate] Database error checking similar match:', similarError);
      }

      if (similarMatch) {
        console.log('[CheckDuplicate] Found similar duplicate:', similarMatch.id);
        return res.status(200).json({
          isDuplicate: true,
          duplicateType: 'similar',
          matchedExpense: {
            id: similarMatch.id,
            store: similarMatch.store,
            amount: Number(similarMatch.amount),
            date: similarMatch.date,
            createdAt: similarMatch.created_at,
          },
          canOverride: true,
          message: `A similar receipt was found (${similarMatch.store}, $${Number(similarMatch.amount).toFixed(2)} on ${similarMatch.date}). This might be a duplicate.`,
        } as DuplicateCheckResult);
      }
    } else {
      console.log('[CheckDuplicate] Insufficient OCR data for similarity check');
    }

    console.log('[CheckDuplicate] No duplicates found');
    console.log('[CheckDuplicate] ===== API ROUTE COMPLETED =====');

    return res.status(200).json({
      isDuplicate: false,
      canOverride: true,
      message: 'No duplicate found',
    } as DuplicateCheckResult);

  } catch (error: any) {
    console.error('[CheckDuplicate] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
