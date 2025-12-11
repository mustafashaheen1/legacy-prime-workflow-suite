import { z } from "zod";
import { publicProcedure } from "../../../create-context.js";

export const submitInspectionDataProcedure = publicProcedure
  .input(
    z.object({
      clientName: z.string().describe("Client's name"),
      projectId: z.string().describe("Project ID"),
      scopeOfWork: z.string().describe("Generated scope of work from AI interview"),
      conversationTranscript: z.string().describe("Full conversation transcript"),
      files: z.array(
        z.object({
          type: z.enum(['photo', 'plan', 'video']).describe("Type of file"),
          uri: z.string().describe("File URI or base64 data"),
          name: z.string().describe("File name"),
          mimeType: z.string().describe("MIME type"),
        })
      ).describe("Uploaded files"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('[CRM] Received inspection data submission:', {
        clientName: input.clientName,
        projectId: input.projectId,
        filesCount: input.files.length,
      });

      console.log('[CRM] Scope of Work:', input.scopeOfWork);
      console.log('[CRM] Conversation Transcript:', input.conversationTranscript);
      console.log('[CRM] Files:', input.files.map(f => ({ type: f.type, name: f.name })));

      return {
        success: true,
        message: 'Inspection data submitted successfully',
        projectId: input.projectId,
        clientName: input.clientName,
      };
    } catch (error: any) {
      console.error('[CRM] Failed to submit inspection data:', error);
      throw new Error(error.message || 'Failed to submit inspection data');
    }
  });
