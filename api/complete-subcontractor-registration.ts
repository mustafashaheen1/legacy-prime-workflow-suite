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

    // Validate token
    const { data: existingSubcontractor, error: lookupError } = await supabase
      .from('subcontractors')
      .select('id, registration_token_expiry, registration_completed, company_id, invited_by')
      .eq('registration_token', token)
      .single();

    if (lookupError || !existingSubcontractor) {
      console.error('[API] Token not found:', token);
      return res.status(400).json({ error: 'Invalid registration token' });
    }

    // Check if already completed
    if (existingSubcontractor.registration_completed) {
      console.error('[API] Registration already completed');
      return res.status(400).json({ error: 'Registration has already been completed' });
    }

    // Check if token expired
    const expiryDate = new Date(existingSubcontractor.registration_token_expiry);
    const now = new Date();

    if (now > expiryDate) {
      console.error('[API] Token expired');
      return res.status(400).json({ error: 'Registration link has expired' });
    }

    // Update subcontractor with complete data
    const updateData = {
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
      updated_at: new Date().toISOString(),
    };

    const { data: updatedSubcontractor, error: updateError } = await supabase
      .from('subcontractors')
      .update(updateData)
      .eq('id', existingSubcontractor.id)
      .select()
      .single();

    if (updateError) {
      console.error('[API] Database error updating subcontractor:', updateError);
      return res.status(500).json({
        error: 'Failed to complete registration',
        details: updateError.message
      });
    }

    console.log('[API] Registration completed successfully:', existingSubcontractor.id);

    // Create notification for user who sent invitation
    if (existingSubcontractor.invited_by) {
      const notificationData = {
        user_id: existingSubcontractor.invited_by,
        type: 'subcontractor_registered',
        title: 'Subcontractor Registration Completed',
        message: `${subcontractor.name} has completed their registration`,
        data: JSON.stringify({
          subcontractorId: existingSubcontractor.id,
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
        console.log('[API] Notification created for user:', existingSubcontractor.invited_by);
      }
    }

    // Return the updated subcontractor
    return res.status(200).json({
      success: true,
      subcontractor: {
        id: updatedSubcontractor.id,
        companyId: updatedSubcontractor.company_id,
        name: updatedSubcontractor.name,
        companyName: updatedSubcontractor.company_name,
        email: updatedSubcontractor.email,
        phone: updatedSubcontractor.phone,
        trade: updatedSubcontractor.trade,
        licenseNumber: updatedSubcontractor.license_number,
        address: updatedSubcontractor.address,
        insuranceExpiry: updatedSubcontractor.insurance_expiry,
        notes: updatedSubcontractor.notes,
        rating: updatedSubcontractor.rating,
        approved: updatedSubcontractor.approved,
        isActive: updatedSubcontractor.is_active,
        registrationCompleted: updatedSubcontractor.registration_completed,
        createdAt: updatedSubcontractor.created_at,
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
