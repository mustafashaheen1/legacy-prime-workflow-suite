import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export const config = {
  maxDuration: 10,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[Custom Folders API] Request:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projectId, name, color, description } = req.body;

    if (!projectId || !name) {
      return res.status(400).json({ error: 'Missing required fields: projectId, name' });
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Pre-generate ID for faster operation (Pattern 3)
    const folderId = randomUUID();
    const now = new Date().toISOString();
    const folderType = name.toLowerCase().replace(/\s+/g, '-');

    console.log('[Custom Folders API] Inserting folder:', name, 'for project:', projectId);
    const startTime = Date.now();

    // Single INSERT (no .select() for speed)
    const { error } = await supabase
      .from('custom_folders')
      .insert({
        id: folderId,
        project_id: projectId,
        folder_type: folderType,
        name: name.trim(),
        color: color || '#6B7280',
        description: description || 'Custom folder',
        created_at: now,
        updated_at: now,
      });

    const duration = Date.now() - startTime;
    console.log('[Custom Folders API] Insert completed in', duration, 'ms');

    if (error) {
      console.error('[Custom Folders API] Error:', error);

      if (error.code === '23505') {
        return res.status(409).json({ error: 'A folder with this name already exists' });
      }

      return res.status(500).json({ error: error.message });
    }

    console.log('[Custom Folders API] Success:', folderId);

    return res.status(200).json({
      success: true,
      folder: {
        id: folderId,
        type: folderType,
        name: name.trim(),
        icon: 'Folder',
        color: color || '#6B7280',
        description: description || 'Custom folder',
        createdAt: now,
      },
    });
  } catch (error: any) {
    console.error('[Custom Folders API] Unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Failed to create folder' });
  }
}
