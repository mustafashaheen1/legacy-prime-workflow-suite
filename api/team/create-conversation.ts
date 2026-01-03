import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 10,
};

/**
 * Create Conversation API
 * Creates a new conversation between team members
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { createdBy, participantIds, name, type } = req.body;

    // Validation
    if (!createdBy || !participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({
        error: 'createdBy and participantIds array are required'
      });
    }

    const conversationType = type || (participantIds.length === 1 ? 'individual' : 'group');

    // Initialize Supabase
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // For individual chats, check if conversation already exists between these two users
    if (conversationType === 'individual' && participantIds.length === 1) {
      const otherUserId = participantIds[0];

      // Find existing individual conversation between these two users
      const { data: existingConversations } = await supabase
        .from('conversations')
        .select(`
          id,
          name,
          type,
          conversation_participants!inner (user_id)
        `)
        .eq('type', 'individual');

      // Check if any existing conversation has exactly these two participants
      for (const conv of existingConversations || []) {
        const participants = (conv as any).conversation_participants;
        const participantUserIds = participants.map((p: any) => p.user_id);

        if (
          participantUserIds.length === 2 &&
          participantUserIds.includes(createdBy) &&
          participantUserIds.includes(otherUserId)
        ) {
          // Conversation already exists
          console.log('[Create Conversation] Found existing conversation:', conv.id);

          // Fetch full conversation details
          const { data: fullConv } = await supabase
            .from('conversations')
            .select('*')
            .eq('id', conv.id)
            .single();

          return res.status(200).json({
            success: true,
            conversation: fullConv,
            existed: true,
          });
        }
      }
    }

    // Create new conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({
        name: name || null,
        type: conversationType,
        created_by: createdBy,
      })
      .select()
      .single();

    if (convError) {
      console.error('[Create Conversation] Database error:', convError);
      throw new Error(convError.message);
    }

    console.log('[Create Conversation] Conversation created:', conversation.id);

    // Add all participants (including creator)
    const allParticipants = [createdBy, ...participantIds];
    const uniqueParticipants = [...new Set(allParticipants)]; // Remove duplicates

    const participantRecords = uniqueParticipants.map(userId => ({
      conversation_id: conversation.id,
      user_id: userId,
    }));

    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert(participantRecords);

    if (participantsError) {
      console.error('[Create Conversation] Error adding participants:', participantsError);
      // Rollback: delete conversation
      await supabase.from('conversations').delete().eq('id', conversation.id);
      throw new Error(participantsError.message);
    }

    console.log('[Create Conversation] Added', uniqueParticipants.length, 'participants');

    return res.status(200).json({
      success: true,
      conversation,
      existed: false,
    });
  } catch (error: any) {
    console.error('[Create Conversation] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create conversation',
    });
  }
}
