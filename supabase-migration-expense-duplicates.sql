-- Migration: Add duplicate detection fields to expenses table
-- Purpose: Enable duplicate receipt detection using image hashing and OCR fingerprinting
-- Date: 2026-01-29

-- Add columns for duplicate detection
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS image_hash TEXT,
  ADD COLUMN IF NOT EXISTS ocr_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS image_size_bytes BIGINT;

-- Create index for fast hash lookups (exact duplicate detection)
-- This enables O(1) lookup time when checking if an image hash already exists
CREATE INDEX IF NOT EXISTS idx_expenses_image_hash
  ON expenses(image_hash)
  WHERE image_hash IS NOT NULL;

-- Create composite index for OCR fingerprint searches within projects
-- This enables fast lookup of similar receipts (same store+amount+date) within a project
CREATE INDEX IF NOT EXISTS idx_expenses_ocr_fingerprint
  ON expenses(project_id, ocr_fingerprint, date)
  WHERE ocr_fingerprint IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN expenses.image_hash IS 'SHA-256 hash of receipt image for exact duplicate detection';
COMMENT ON COLUMN expenses.ocr_fingerprint IS 'Computed fingerprint from OCR data (store+amount+date) for fuzzy duplicate detection';
COMMENT ON COLUMN expenses.image_size_bytes IS 'Original image file size in bytes';

-- Verify migration
-- Run after migration: SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'expenses' AND column_name IN ('image_hash', 'ocr_fingerprint', 'image_size_bytes');
