import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Compress image to reduce file size before upload
 * @param uri - Local image URI
 * @param options - Compression options
 * @returns Compressed image data with base64
 */
export async function compressImage(
  uri: string,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  }
): Promise<{
  uri: string;
  base64: string;
  width: number;
  height: number;
}> {
  const { maxWidth = 1920, maxHeight = 1920, quality = 0.8 } = options || {};

  try {
    console.log('[Upload] Compressing image:', uri);

    const result = await ImageManipulator.manipulateAsync(
      uri,
      [
        {
          resize: {
            width: maxWidth,
            height: maxHeight,
          },
        },
      ],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!result.base64) {
      throw new Error('Failed to generate base64 from compressed image');
    }

    console.log('[Upload] Compression complete:', {
      width: result.width,
      height: result.height,
      base64Length: result.base64.length,
    });

    return {
      uri: result.uri,
      base64: result.base64,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    console.error('[Upload] Compression error:', error);
    throw new Error('Failed to compress image');
  }
}

/**
 * Convert image URI to base64 string without compression
 * @param uri - Local image URI
 * @returns Base64 encoded string
 */
export async function uriToBase64(uri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('[Upload] Error converting URI to base64:', error);
    throw new Error('Failed to read image file');
  }
}

/**
 * Get file size from URI
 * @param uri - Local file URI or blob URI
 * @returns File size in bytes
 */
export async function getFileSize(uri: string): Promise<number> {
  try {
    // On web, FileSystem is not available, so we need to handle it differently
    if (Platform.OS === 'web') {
      // For web, if it's a blob URL, fetch it to get the size
      if (uri.startsWith('blob:')) {
        const response = await fetch(uri);
        const blob = await response.blob();
        return blob.size;
      }
      // For data URLs, estimate size from base64 length
      if (uri.startsWith('data:')) {
        const base64 = uri.split(',')[1];
        return Math.ceil((base64.length * 3) / 4);
      }
      // Default fallback for web
      return 0;
    }

    // For native platforms (iOS/Android), use FileSystem
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }
    return fileInfo.size || 0;
  } catch (error) {
    console.error('[Upload] Error getting file size:', error);
    // Return 0 instead of throwing to allow upload to continue
    return 0;
  }
}

/**
 * Validate file before upload
 * @param params - File validation parameters
 * @returns Validation result
 */
export function validateFileForUpload(params: {
  fileSize: number;
  type: 'image' | 'video';
}): { valid: boolean; error?: string } {
  const { fileSize, type } = params;

  // File size limits (in bytes)
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

  const maxSize = type === 'image' ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

  if (fileSize > maxSize) {
    const maxSizeMB = (maxSize / 1024 / 1024).toFixed(0);
    const actualSizeMB = (fileSize / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `File too large (${actualSizeMB}MB). Maximum size is ${maxSizeMB}MB.`,
    };
  }

  return { valid: true };
}

/**
 * Get MIME type from file URI
 * @param uri - File URI
 * @returns MIME type string
 */
export function getMimeType(uri: string): string {
  const extension = uri.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    heif: 'image/heif',
    webp: 'image/webp',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
  };

  return mimeTypes[extension || ''] || 'application/octet-stream';
}

/**
 * Estimate compressed file size
 * Used for validation before compression
 * @param originalSize - Original file size in bytes
 * @param quality - Compression quality (0-1)
 * @returns Estimated compressed size
 */
export function estimateCompressedSize(
  originalSize: number,
  quality: number = 0.8
): number {
  // Rough estimate: compression typically reduces size by 60-80%
  return Math.floor(originalSize * quality * 0.5);
}
