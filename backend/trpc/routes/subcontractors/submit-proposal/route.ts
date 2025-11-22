import { publicProcedure } from "../../../create-context";
import { z } from "zod";

export const submitProposalProcedure = publicProcedure
  .input(
    z.object({
      estimateRequestId: z.string(),
      subcontractorId: z.string(),
      projectId: z.string(),
      amount: z.number(),
      timeline: z.string(),
      description: z.string(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const proposal = {
      id: `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...input,
      proposalDate: new Date().toISOString(),
      status: 'submitted' as const,
      createdAt: new Date().toISOString(),
    };

    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'user_current',
      type: 'proposal-submitted' as const,
      title: 'New Proposal Received',
      message: `A subcontractor has submitted a proposal for $${input.amount}`,
      data: { proposalId: proposal.id, projectId: input.projectId },
      read: false,
      createdAt: new Date().toISOString(),
    };

    console.log('[Proposal] Submitted proposal:', proposal.id);
    console.log('[Notification] Created notification:', notification.id);

    return { proposal, notification };
  });
