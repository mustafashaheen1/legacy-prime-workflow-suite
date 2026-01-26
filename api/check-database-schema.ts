import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase credentials missing' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const checks = {
      registration_tokens: { exists: false, error: null },
      business_files_columns: { exists: false, error: null, columns: [] },
      subcontractors_columns: { exists: false, error: null, columns: [] }
    };

    // Check registration_tokens table
    try {
      const { data, error } = await supabase
        .from('registration_tokens')
        .select('id')
        .limit(1);

      if (error) {
        checks.registration_tokens.error = error.message;
      } else {
        checks.registration_tokens.exists = true;
      }
    } catch (error: any) {
      checks.registration_tokens.error = error.message;
    }

    // Check business_files table for new columns
    try {
      const { data, error } = await supabase
        .from('business_files')
        .select('s3_key, registration_token')
        .limit(1);

      if (error) {
        checks.business_files_columns.error = error.message;
      } else {
        checks.business_files_columns.exists = true;
        if (data && data.length > 0) {
          checks.business_files_columns.columns = Object.keys(data[0]);
        }
      }
    } catch (error: any) {
      checks.business_files_columns.error = error.message;
    }

    // Check subcontractors table for new columns
    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .select('registration_token, registration_completed, invited_by, license_number')
        .limit(1);

      if (error) {
        checks.subcontractors_columns.error = error.message;
      } else {
        checks.subcontractors_columns.exists = true;
        if (data && data.length > 0) {
          checks.subcontractors_columns.columns = Object.keys(data[0]);
        }
      }
    } catch (error: any) {
      checks.subcontractors_columns.error = error.message;
    }

    // Determine what needs to be done
    const needsMigrations = [];

    if (!checks.registration_tokens.exists) {
      needsMigrations.push('registration_tokens table needs to be created');
    }

    if (!checks.business_files_columns.exists) {
      needsMigrations.push('business_files table needs s3_key and registration_token columns');
    }

    if (!checks.subcontractors_columns.exists) {
      needsMigrations.push('subcontractors table needs registration fields');
    }

    return res.status(200).json({
      checks,
      needsMigrations,
      ready: needsMigrations.length === 0,
      instructions: needsMigrations.length > 0
        ? 'Please run the SQL migrations in Supabase Dashboard > SQL Editor. Migration files are in /supabase/migrations/'
        : 'Database schema is ready!'
    });

  } catch (error: any) {
    console.error('[Database Check] Error:', error);
    return res.status(500).json({
      error: 'Failed to check database schema',
      message: error.message
    });
  }
}
