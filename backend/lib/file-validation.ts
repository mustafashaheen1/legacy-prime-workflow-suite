/**
 * File validation utilities for photo and video uploads
 */

// Allowed MIME types for images
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
];

// Allowed MIME types for videos
export const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/webm',
];

// File size limits from environment variables (with defaults)
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760'); // 10MB default
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE || '104857600'); // 100MB default

/**
 * Validate image file type and size
 */
export function validateImageFile(params: {
  mimeType: string;
  size: number;
}): { valid: boolean; error?: string } {
  const { mimeType, size } = params;

  // Check file type
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid file type: ${mimeType}. Allowed types: JPEG, PNG, HEIC, HEIF, WebP`,
    };
  }

  // Check file size
  if (size > MAX_IMAGE_SIZE) {
    const maxSizeMB = (MAX_IMAGE_SIZE / 1024 / 1024).toFixed(1);
    const actualSizeMB = (size / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `File too large: ${actualSizeMB}MB. Maximum size is ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Validate video file type and size
 */
export function validateVideoFile(params: {
  mimeType: string;
  size: number;
}): { valid: boolean; error?: string } {
  const { mimeType, size } = params;

  // Check file type
  if (!ALLOWED_VIDEO_TYPES.includes(mimeType.toLowerCase())) {
    return {
      valid: false,
      error: `Invalid file type: ${mimeType}. Allowed types: MP4, MOV, AVI, WebM`,
    };
  }

  // Check file size
  if (size > MAX_VIDEO_SIZE) {
    const maxSizeMB = (MAX_VIDEO_SIZE / 1024 / 1024).toFixed(1);
    const actualSizeMB = (size / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `File too large: ${actualSizeMB}MB. Maximum size is ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Get file extension from MIME type
 */
export function getFileExtension(mimeType: string): string {
  const mimeToExtension: Record<string, string> = {
    // Images
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/webp': 'webp',
    // Videos
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/webm': 'webm',
  };

  return mimeToExtension[mimeType.toLowerCase()] || 'bin';
}

/**
 * Convert base64 string to Buffer
 */
export function base64ToBuffer(base64: string): Buffer {
  // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  return Buffer.from(base64Data, 'base64');
}

/**
 * Get MIME type from base64 data URL
 */
export function getMimeTypeFromDataUrl(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return match ? match[1] : null;
}
