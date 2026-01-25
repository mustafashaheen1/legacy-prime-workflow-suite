import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[API] Complete subcontractor registration request received');

  try {
    const { token, subcontractor } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    if (!subcontractor) {
      return res.status(400).json({ error: 'Subcontractor data is required' });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[API] Supabase credentials missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate token in registration_tokens table
    const { data: tokenData, error: lookupError } = await supabase
      .from('registration_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (lookupError || !tokenData) {
      console.error('[API] Token not found:', token);
      return res.status(400).json({ error: 'Invalid registration token' });
    }

    // Check if already used
    if (tokenData.used) {
      console.error('[API] Token already used');
      return res.status(400).json({ error: 'Registration link has already been used' });
    }

    // Check if token expired
    const expiryDate = new Date(tokenData.expires_at);
    const now = new Date();

    if (now > expiryDate) {
      console.error('[API] Token expired');
      return res.status(400).json({ error: 'Registration link has expired' });
    }

    // Create new subcontractor with complete data
    const newSubcontractorData = {
      company_id: tokenData.company_id,
      name: subcontractor.name,
      company_name: subcontractor.companyName,
      email: subcontractor.email,
      phone: subcontractor.phone,
      trade: subcontractor.trade,
      license_number: subcontractor.licenseNumber || null,
      address: subcontractor.address || null,
      insurance_expiry: subcontractor.insuranceExpiry || null,
      notes: subcontractor.notes || null,
      rating: subcontractor.rating || null,
      registration_completed: true,
      approved: false,
      is_active: true,
      invited_by: tokenData.invited_by,
      created_at: new Date().toISOString(),
    };

    const { data: newSubcontractor, error: createError } = await supabase
      .from('subcontractors')
      .insert(newSubcontractorData)
      .select()
      .single();

    if (createError) {
      console.error('[API] Database error creating subcontractor:', createError);
      return res.status(500).json({
        error: 'Failed to complete registration',
        details: createError.message
      });
    }

    // Link uploaded files to the new subcontractor
    await supabase
      .from('business_files')
      .update({ subcontractor_id: newSubcontractor.id, registration_token: null })
      .eq('registration_token', token);

    // Mark token as used
    await supabase
      .from('registration_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('token', token);

    console.log('[API] Registration completed successfully:', newSubcontractor.id);

    // Create notification for user who sent invitation
    if (tokenData.invited_by) {
      const notificationData = {
        user_id: tokenData.invited_by,
        type: 'subcontractor_registered',
        title: 'Subcontractor Registration Completed',
        message: `${subcontractor.name} has completed their registration`,
        data: JSON.stringify({
          subcontractorId: newSubcontractor.id,
          subcontractorName: subcontractor.name,
        }),
        read: false,
        created_at: new Date().toISOString(),
      };

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notificationData);

      if (notificationError) {
        console.error('[API] Failed to create notification:', notificationError);
        // Don't fail the request if notification creation fails
      } else {
        console.log('[API] Notification created for user:', tokenData.invited_by);
      }
    }

    // Return the created subcontractor
    return res.status(200).json({
      success: true,
      subcontractor: {
        id: newSubcontractor.id,
        companyId: newSubcontractor.company_id,
        name: newSubcontractor.name,
        companyName: newSubcontractor.company_name,
        email: newSubcontractor.email,
        phone: newSubcontractor.phone,
        trade: newSubcontractor.trade,
        licenseNumber: newSubcontractor.license_number,
        address: newSubcontractor.address,
        insuranceExpiry: newSubcontractor.insurance_expiry,
        notes: newSubcontractor.notes,
        rating: newSubcontractor.rating,
        approved: newSubcontractor.approved,
        isActive: newSubcontractor.is_active,
        registrationCompleted: newSubcontractor.registration_completed,
        createdAt: newSubcontractor.created_at,
      },
    });
  } catch (error: any) {
    console.error('[API] Error completing subcontractor registration:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
