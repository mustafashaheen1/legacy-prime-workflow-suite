-- Enable Supabase Realtime for the notifications table.
-- This allows the client-side supabase.channel() postgres_changes subscription
-- to receive INSERT events instantly without polling.

-- Add notifications to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Ensure REPLICA IDENTITY is set so Realtime can stream the full row on INSERT
ALTER TABLE notifications REPLICA IDENTITY FULL;
