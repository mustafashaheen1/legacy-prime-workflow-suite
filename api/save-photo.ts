import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireAuth } from './lib/auth-helper';

export const config = {
  maxDuration: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[SavePhoto] ===== API ROUTE STARTED =====');
  console.log('[SavePhoto] Method:', req.method);

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 🎯 PHASE 2B: Extract user from JWT (required for uploaded_by tracking)
    let authUser;
    try {
      authUser = await requireAuth(req);
      console.log('[SavePhoto] ✅ Authenticated user:', authUser.email);
    } catch (authError: any) {
      console.error('[SavePhoto] Authentication failed:', authError.message);
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to upload photos'
      });
    }

    const { projectId, category, notes, url, date } = req.body;

    // 🎯 SECURITY: Use company ID from authenticated user, not from request body
    const companyId = authUser.companyId;

    console.log('[SavePhoto] Saving photo for project:', projectId, 'by user:', authUser.id);

    // Validate required fields
    if (!projectId || !category || !url) {
      console.log('[SavePhoto] Missing required fields');
      return res.status(400).json({ error: 'Missing required fields: projectId, category, url' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[SavePhoto] Missing Supabase credentials');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract S3 key from URL if it's an S3 URL
    let s3Key: string | null = null;
    try {
      const urlObj = new URL(url);
      s3Key = urlObj.pathname.startsWith('/') ? urlObj.pathname.slice(1) : urlObj.pathname;
    } catch {
      // Not a valid URL or can't extract key
    }

    console.log('[SavePhoto] Inserting into database...');
    const insertStart = Date.now();

    const { data, error } = await supabase
      .from('photos')
      .insert({
        company_id: companyId,
        project_id: projectId,
        category,
        notes: notes || null,
        url,
        s3_key: s3Key,
        date: date || new Date().toISOString(),
        uploaded_by: authUser.id, // 🎯 PHASE 3: Auto-capture uploader
      } as any)
      .select()
      .single();

    const insertDuration = Date.now() - insertStart;
    console.log(`[SavePhoto] Database INSERT completed in ${insertDuration}ms`);

    if (error) {
      console.error('[SavePhoto] Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('[SavePhoto] ===== API ROUTE COMPLETED =====');
    console.log('[SavePhoto] Photo saved:', data.id);

    return res.status(200).json({
      success: true,
      photo: {
        id: data.id,
        projectId: data.project_id,
        category: data.category,
        notes: data.notes,
        url: data.url,
        date: data.date,
        s3Key: data.s3_key,
      },
      insertDuration,
    });
  } catch (error: any) {
    console.error('[SavePhoto] Unexpected error:', error);
    return res.status(500).json({
      error: error.message || 'Unknown error',
    });
  }
}
