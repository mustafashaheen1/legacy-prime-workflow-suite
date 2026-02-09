import { protectedProcedure } from "../../../create-context.js";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabase } from "../../../lib/supabase.js";
import twilio from "twilio";
import { sendEstimateRequestEmail } from "../../../lib/email-service.js";

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Send SMS notification to subcontractor
 */
async function sendSMSNotification(params: {
  subcontractorPhone: string;
  subcontractorName: string;
  projectName: string;
  companyName: string;
  description: string;
}) {
  const { subcontractorPhone, subcontractorName, projectName, companyName, description } = params;

  try {
    const message = await twilioClient.messages.create({
      to: subcontractorPhone,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: `Hi ${subcontractorName}! 📋\n\n${companyName} has requested an estimate for "${projectName}".\n\nDetails: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}\n\nCheck your email for full details.\n\nThank you!`
    });

    console.log('[SMS] Sent estimate request notification:', message.sid);
    return { success: true, messageSid: message.sid };
  } catch (error) {
    console.error('[SMS] Failed to send notification:', error);
    return { success: false, error };
  }
}

/**
 * Request Estimate from Subcontractor
 * Sends both SMS and Email notifications
 * Platform: iOS, Android, Web
 */
export const requestEstimateProcedure = protectedProcedure
  .input(
    z.object({
      projectId: z.string().uuid("Invalid project ID"),
      subcontractorId: z.string().uuid("Invalid subcontractor ID"),
      description: z.string()
        .min(10, "Description must be at least 10 characters")
        .max(500, "Description must be less than 500 characters")
        .trim(),
      requiredBy: z.string().optional(),
      notes: z.string()
        .max(1000, "Notes must be less than 1000 characters")
        .trim()
        .optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const { user } = ctx;

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to request estimates',
      });
    }

    console.log('[EstimateRequest] Creating request:', {
      projectId: input.projectId,
      subcontractorId: input.subcontractorId,
      userId: user.id,
      companyId: user.companyId,
    });

    // 1. Verify project belongs to user's company
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, address, company_id')
      .eq('id', input.projectId)
      .eq('company_id', user.companyId)
      .single();

    if (projectError || !project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Project not found or you do not have access',
      });
    }

    // 2. Verify subcontractor exists and is active
    const { data: subcontractor, error: subError } = await supabase
      .from('subcontractors')
      .select('id, name, phone, email, trade, is_active')
      .eq('id', input.subcontractorId)
      .single();

    if (subError || !subcontractor) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Subcontractor not found',
      });
    }

    if (!subcontractor.is_active) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This subcontractor is not currently active',
      });
    }

    // 3. Get company info
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', user.companyId)
      .single();

    // 4. Insert estimate request into database
    const { data: estimateRequest, error: insertError } = await supabase
      .from('estimate_requests')
      .insert({
        project_id: input.projectId,
        subcontractor_id: input.subcontractorId,
        requested_by: user.id,
        company_id: user.companyId,
        description: input.description,
        required_by: input.requiredBy || null,
        notes: input.notes || null,
        status: 'pending',
        request_date: new Date().toISOString(),
        notification_sent: false,
      })
      .select('*')
      .single();

    if (insertError) {
      console.error('[EstimateRequest] Database error:', insertError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create estimate request',
      });
    }

    console.log('[EstimateRequest] Created successfully:', estimateRequest.id);

    // 5. Send notifications (SMS + Email)
    const notificationResults = {
      sms: false,
      email: false,
    };

    // Send SMS if phone number exists
    if (subcontractor.phone) {
      const smsResult = await sendSMSNotification({
        subcontractorPhone: subcontractor.phone,
        subcontractorName: subcontractor.name,
        projectName: project.name,
        companyName: company?.name || 'Your Client',
        description: input.description,
      });
      notificationResults.sms = smsResult.success;
    }

    // Send Email if email exists
    if (subcontractor.email) {
      const emailResult = await sendEstimateRequestEmail({
        to: subcontractor.email,
        toName: subcontractor.name,
        subjectName: subcontractor.name,
        projectName: project.name,
        companyName: company?.name || 'Your Client',
        description: input.description,
        requiredBy: input.requiredBy,
        notes: input.notes,
        requestId: estimateRequest.id,
      });
      notificationResults.email = emailResult.success;

      if (emailResult.success) {
        console.log('[Email] Sent via:', emailResult.service, 'ID:', emailResult.messageId);
      }
    }

    // 6. Update notification status in database
    const notificationType =
      notificationResults.sms && notificationResults.email ? 'all' :
      notificationResults.sms ? 'sms' :
      notificationResults.email ? 'email' :
      null;

    const notificationSent = notificationResults.sms || notificationResults.email;

    if (notificationSent) {
      await supabase
        .from('estimate_requests')
        .update({
          notification_sent: true,
          notification_type: notificationType,
          status: 'sent',
        })
        .eq('id', estimateRequest.id);
    }

    // 7. Return the created request
    return {
      id: estimateRequest.id,
      projectId: estimateRequest.project_id,
      subcontractorId: estimateRequest.subcontractor_id,
      requestedBy: estimateRequest.requested_by,
      companyId: estimateRequest.company_id,
      description: estimateRequest.description,
      requiredBy: estimateRequest.required_by,
      notes: estimateRequest.notes,
      status: notificationSent ? 'sent' : 'pending',
      requestDate: estimateRequest.request_date,
      createdAt: estimateRequest.created_at,
      updatedAt: estimateRequest.updated_at,
      notificationSent,
      notificationType,
      subcontractorName: subcontractor.name,
      subcontractorTrade: subcontractor.trade,
      projectName: project.name,
      notifications: {
        sms: {
          sent: notificationResults.sms,
          available: !!subcontractor.phone,
        },
        email: {
          sent: notificationResults.email,
          available: !!subcontractor.email,
        },
      },
    };
  });
