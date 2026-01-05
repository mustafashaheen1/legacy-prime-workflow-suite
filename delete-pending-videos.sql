-- Delete all pending inspection videos
-- Run this in your Supabase SQL Editor

DELETE FROM inspection_videos
WHERE status = 'pending';

-- Optional: If you want to see what will be deleted first, run this query:
-- SELECT * FROM inspection_videos WHERE status = 'pending';

-- After deletion, verify:
-- SELECT status, COUNT(*) FROM inspection_videos GROUP BY status;
