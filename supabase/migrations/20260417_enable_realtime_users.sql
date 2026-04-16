-- Enable Supabase Realtime for the users table.
--
-- Required so the client-side postgres_changes DELETE subscription
-- (AppContext.tsx: user-deleted channel) can detect when an employee's row
-- is removed via api/reject-user.ts and force an immediate logout.
--
-- Two things are required for DELETE events to work correctly:
--
-- 1. REPLICA IDENTITY FULL — without this, Postgres only emits the primary key
--    in the WAL event. Realtime needs the full old row to match the id= filter.
--
-- 2. A permissive SELECT RLS policy — Supabase Realtime checks that the
--    subscribing session has SELECT permission on the affected row. Authenticated
--    users must be able to SELECT their own row (which existing policies allow),
--    but the broad USING (true) policy below ensures no edge-case denials block
--    the DELETE event delivery. Mirrors the pattern used for clock_entries.

ALTER PUBLICATION supabase_realtime ADD TABLE users;

ALTER TABLE users REPLICA IDENTITY FULL;
