-- Allow email to be null for clients added via phone call / AI
ALTER TABLE clients ALTER COLUMN email DROP NOT NULL;
