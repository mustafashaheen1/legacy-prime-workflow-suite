-- Add 'task-assigned' to the notifications type CHECK constraint.
-- Required for push notifications sent to employees on task assignment (M1-T5).
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'estimate-received',
  'proposal-submitted',
  'payment-received',
  'change-order',
  'general',
  'task-reminder',
  'task-assigned'
));
