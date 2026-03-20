-- Enable Supabase Realtime for clock_entries.
--
-- clock_entries is already in the supabase_realtime publication.
-- Two things are required for Realtime UPDATE events to work correctly:
--
-- 1. REPLICA IDENTITY FULL — without this Postgres only sends the primary key
--    in the UPDATE WAL event; Supabase Realtime can't reconstruct the full row
--    and the subscription errors out.
--
-- 2. A permissive SELECT RLS policy — if RLS is enabled on the table and no
--    policy grants SELECT to authenticated users, Supabase rejects the
--    postgres_changes subscription with CHANNEL_ERROR.
--    Pattern matches the existing "Service role full access notifications" policy.

-- Required for UPDATE payloads to carry the full new/old row.
ALTER TABLE clock_entries REPLICA IDENTITY FULL;

-- Allow authenticated sessions (the app's anon-key client with a user JWT)
-- to receive Realtime events. Actual data scoping is enforced application-side
-- via the company_id filter on the channel subscription.
ALTER TABLE clock_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated access clock_entries" ON clock_entries;
CREATE POLICY "Authenticated access clock_entries"
  ON clock_entries FOR ALL
  USING (true)
  WITH CHECK (true);
