/**
 * Receipt Duplicate Detection Utilities
 *
 * Provides functions for detecting duplicate receipt uploads using:
 * 1. Image hashing (SHA-256) for exact duplicates
 * 2. OCR fingerprinting (normalized store+amount+date) for similar receipts
 */

/**
 * Generate SHA-256 hash from base64 image data
 * Used for exact duplicate detection
 * Works in both browser (Web Crypto API) and Node.js (crypto module)
 *
 * @param base64Data - Base64 encoded image data (with or without data URL prefix)
 * @returns SHA-256 hash as hex string
 *
 * @example
 * const hash = await generateImageHash('data:image/jpeg;base64,/9j/4AAQSkZJRg...');
 * // Returns: "a1b2c3d4e5f6..."
 */
export async function generateImageHash(base64Data: string): Promise<string> {
  // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  // Check if we're in a browser or Node.js environment
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    // Browser environment - use Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(base64Content);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js environment - use crypto module
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(base64Content)
      .digest('hex');
  }
}

/**
 * Generate OCR fingerprint from extracted receipt data
 * Format: normalized_store_amount_YYYYMMDD
 * Used for fuzzy duplicate detection (catches same receipt from different angles)
 *
 * @param store - Store/vendor name from OCR
 * @param amount - Total amount from receipt
 * @param date - Transaction date (ISO string or Date object)
 * @returns Normalized fingerprint string
 *
 * @example
 * const fingerprint = generateOCRFingerprint('Home Depot', 125.50, '2024-01-15');
 * // Returns: "home_depot_125.50_20240115"
 */
export function generateOCRFingerprint(
  store: string,
  amount: number,
  date: string | Date
): string {
  // Normalize store name (lowercase, trim, remove special chars, replace spaces with underscores)
  const normalizedStore = store
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_');        // Replace spaces with underscores

  // Format amount to 2 decimal places (e.g., 125.50)
  const formattedAmount = amount.toFixed(2);

  // Extract YYYYMMDD from date
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dateStr = dateObj.toISOString().slice(0, 10).replace(/-/g, '');

  return `${normalizedStore}_${formattedAmount}_${dateStr}`;
}

/**
 * Calculate approximate byte size from base64 string
 * Used for storing file size metadata
 *
 * @param base64Data - Base64 encoded data (with or without data URL prefix)
 * @returns Approximate size in bytes
 *
 * @example
 * const size = getBase64ByteSize('data:image/jpeg;base64,/9j/4AAQ...');
 * // Returns: 245760 (for a ~240KB image)
 */
export function getBase64ByteSize(base64Data: string): number {
  // Remove data URL prefix if present
  const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  // Base64 encoding increases size by ~33% (4 bytes for every 3 original bytes)
  // To get original byte size: (base64Length * 3) / 4
  // Also need to account for padding characters (=)
  const paddingCount = (base64Content.match(/=/g) || []).length;

  return Math.ceil((base64Content.length * 3) / 4) - paddingCount;
}

/**
 * Check if a date is within the specified number of days ago
 * Used for date range filtering in duplicate detection
 *
 * @param dateString - ISO date string or Date object
 * @param days - Number of days to look back
 * @returns true if date is within the range
 *
 * @example
 * isWithinDays('2024-01-15', 30); // Returns true if within last 30 days
 */
export function isWithinDays(dateString: string | Date, days: number): boolean {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

/**
 * Extract the base64 content without the data URL prefix
 * Utility function for working with base64 images
 *
 * @param base64Data - Base64 string (with or without data URL)
 * @returns Clean base64 content without prefix
 */
export function stripDataUrlPrefix(base64Data: string): string {
  return base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
}

/**
 * Check if a string is a valid base64 image
 * Used for input validation
 *
 * @param base64Data - String to validate
 * @returns true if valid base64 image data
 */
export function isValidBase64Image(base64Data: string): boolean {
  if (!base64Data || base64Data.length < 100) {
    return false;
  }

  // Check if it starts with data URL or is raw base64
  const hasDataUrl = /^data:image\/[a-z]+;base64,/.test(base64Data);
  const base64Content = hasDataUrl ? stripDataUrlPrefix(base64Data) : base64Data;

  // Validate base64 pattern
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  return base64Pattern.test(base64Content);
}
