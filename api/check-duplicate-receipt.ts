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

// Store name normalisation + Dice-coefficient similarity (0–1 score)
function normalizeStoreName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function storeSimilarity(a: string, b: string): number {
  const na = normalizeStoreName(a);
  const nb = normalizeStoreName(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  if (na.length < 2 || nb.length < 2) return 0;
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(na);
  const bb = bigrams(nb);
  const intersection = [...ba].filter(x => bb.has(x)).length;
  return (2 * intersection) / (ba.size + bb.size);
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
    const { companyId, projectId, imageBase64, ocrData, userId, expenseType, expenseSubcategory } = req.body;

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

    // Fire-and-forget audit logger — never awaited, never blocks response
    const logDetection = (params: {
      detectionType: 'exact' | 'similar' | 'none';
      userDecision: 'blocked' | 'warned' | 'clean';
      matchedExpenseId?: string;
      imageHash?: string;
      ocrFingerprint?: string;
    }) => {
      supabase.from('expense_duplicate_logs').insert({
        company_id: companyId,
        project_id: projectId,
        attempted_by: userId || null,
        detection_type: params.detectionType,
        matched_expense_id: params.matchedExpenseId || null,
        image_hash: params.imageHash || null,
        ocr_fingerprint: params.ocrFingerprint || null,
        user_decision: params.userDecision,
      }).then(({ error }) => {
        if (error) console.warn('[CheckDuplicate] Audit log failed (non-fatal):', error.message);
      });
    };

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
      logDetection({ detectionType: 'exact', userDecision: 'blocked', matchedExpenseId: exactMatch.id, imageHash });
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
        imageHash,
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
        logDetection({ detectionType: 'similar', userDecision: 'warned', matchedExpenseId: similarMatch.id, imageHash, ocrFingerprint });
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
          imageHash,
          message: `A similar receipt was found (${similarMatch.store}, $${Number(similarMatch.amount).toFixed(2)} on ${similarMatch.date}). This might be a duplicate.`,
        } as DuplicateCheckResult);
      }

      // Check 3: Fuzzy store match — same date, amount within ±1%, store name similarity ≥ 0.7
      // Catches partial/cropped photos of the same receipt where OCR produces slightly different text
      console.log('[CheckDuplicate] Checking fuzzy store match...');
      const ocrDateStr = new Date(ocrData.date).toISOString().split('T')[0];
      const amountLow = (ocrData.amount * 0.99).toFixed(2);
      const amountHigh = (ocrData.amount * 1.01).toFixed(2);

      const { data: fuzzyCandidates } = await supabase
        .from('expenses')
        .select('id, store, amount, date, created_at')
        .eq('project_id', projectId)
        .eq('date', ocrDateStr)
        .gte('amount', amountLow)
        .lte('amount', amountHigh)
        .limit(20);

      const fuzzyMatch = fuzzyCandidates?.find(e => storeSimilarity(e.store, ocrData.store) >= 0.7);
      if (fuzzyMatch) {
        console.log('[CheckDuplicate] Found fuzzy store match:', fuzzyMatch.id, 'similarity score met');
        logDetection({ detectionType: 'similar', userDecision: 'warned', matchedExpenseId: fuzzyMatch.id, imageHash, ocrFingerprint });
        return res.status(200).json({
          isDuplicate: true,
          duplicateType: 'similar',
          matchedExpense: {
            id: fuzzyMatch.id,
            store: fuzzyMatch.store,
            amount: Number(fuzzyMatch.amount),
            date: fuzzyMatch.date,
            createdAt: fuzzyMatch.created_at,
          },
          canOverride: true,
          imageHash,
          message: `A similar receipt was found (${fuzzyMatch.store}, $${Number(fuzzyMatch.amount).toFixed(2)} on ${fuzzyMatch.date}). This might be a duplicate.`,
        } as DuplicateCheckResult);
      }

      // Check 4: Same-day same-store heuristic — any amount, store similarity ≥ 0.7
      // Fuel exempted: crews regularly fill multiple vehicles at same station same day
      const isFuel = expenseType === 'fuel' || expenseSubcategory === 'fuel';
      if (!isFuel) {
        console.log('[CheckDuplicate] Checking same-day same-store...');
        const { data: sameDayCandidates } = await supabase
          .from('expenses')
          .select('id, store, amount, date, created_at')
          .eq('project_id', projectId)
          .eq('date', ocrDateStr)
          .limit(50);

        const sameDayMatch = sameDayCandidates?.find(e => storeSimilarity(e.store, ocrData.store) >= 0.7);
        if (sameDayMatch) {
          console.log('[CheckDuplicate] Found same-day same-store match:', sameDayMatch.id);
          logDetection({ detectionType: 'similar', userDecision: 'warned', matchedExpenseId: sameDayMatch.id, imageHash, ocrFingerprint });
          return res.status(200).json({
            isDuplicate: true,
            duplicateType: 'similar',
            matchedExpense: {
              id: sameDayMatch.id,
              store: sameDayMatch.store,
              amount: Number(sameDayMatch.amount),
              date: sameDayMatch.date,
              createdAt: sameDayMatch.created_at,
            },
            canOverride: true,
            imageHash,
            message: `A receipt from ${sameDayMatch.store} was already added today. This might be a duplicate.`,
          } as DuplicateCheckResult);
        }
      }
    } else {
      console.log('[CheckDuplicate] Insufficient OCR data for similarity check');
    }

    console.log('[CheckDuplicate] No duplicates found');
    console.log('[CheckDuplicate] ===== API ROUTE COMPLETED =====');
    logDetection({ detectionType: 'none', userDecision: 'clean', imageHash });

    return res.status(200).json({
      isDuplicate: false,
      canOverride: true,
      imageHash,
      message: 'No duplicate found',
    } as DuplicateCheckResult);

  } catch (error: any) {
    console.error('[CheckDuplicate] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
