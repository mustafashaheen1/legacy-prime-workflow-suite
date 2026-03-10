-- Allow 'video' as a valid message type.
-- The original CHECK constraint only included ('text', 'image', 'file', 'voice'),
-- causing all video message inserts to fail with a constraint violation.

-- Drop old constraint
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_type_check;

-- Re-add with 'video' included
ALTER TABLE messages
  ADD CONSTRAINT messages_type_check
    CHECK (type IN ('text', 'image', 'file', 'voice', 'video'));
