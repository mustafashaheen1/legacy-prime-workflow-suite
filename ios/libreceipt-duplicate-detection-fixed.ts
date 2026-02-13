/**
 * Receipt Duplicate Detection
 * 
 * Fixed version that works with React Native/Expo
 * Uses expo-crypto instead of Node.js crypto module
 * 
 * Installation: npx expo install expo-crypto
 */

import * as Crypto from 'expo-crypto';

interface Receipt {
  content: string;
  timestamp?: number;
  id?: string;
}

/**
 * Generate a SHA-256 hash for receipt content
 * @param base64Content - Base64 encoded receipt content
 * @returns Promise that resolves to hex-encoded hash
 */
export async function hashReceiptContent(base64Content: string): Promise<string> {
  try {
    // Use expo-crypto for React Native compatibility
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64Content,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    return hash;
  } catch (error) {
    console.error('Error hashing receipt content:', error);
    throw new Error('Failed to generate receipt hash');
  }
}

/**
 * Generate a hash for a complete receipt object
 * @param receipt - Receipt object with content
 * @returns Promise that resolves to hex-encoded hash
 */
export async function generateReceiptHash(receipt: Receipt): Promise<string> {
  const base64Content = receipt.content;
  return hashReceiptContent(base64Content);
}

/**
 * Check if a receipt is a duplicate based on its hash
 * @param receipt - Receipt to check
 * @param existingHashes - Set of already seen hashes
 * @returns Promise that resolves to true if duplicate, false otherwise
 */
export async function isDuplicateReceipt(
  receipt: Receipt,
  existingHashes: Set<string>
): Promise<boolean> {
  const hash = await generateReceiptHash(receipt);
  return existingHashes.has(hash);
}

/**
 * Receipt Duplicate Detector Class
 * Maintains a set of seen receipt hashes to detect duplicates
 */
export class ReceiptDuplicateDetector {
  private seenHashes: Set<string> = new Set();
  private receiptIdToHash: Map<string, string> = new Map();

  /**
   * Check if a receipt is a duplicate and add it to the seen set
   * @param receipt - Receipt to check
   * @returns Promise that resolves to true if duplicate, false if new
   */
  async isDuplicate(receipt: Receipt): Promise<boolean> {
    const hash = await generateReceiptHash(receipt);
    
    if (this.seenHashes.has(hash)) {
      return true;
    }
    
    this.seenHashes.add(hash);
    
    // If receipt has an ID, store the mapping
    if (receipt.id) {
      this.receiptIdToHash.set(receipt.id, hash);
    }
    
    return false;
  }

  /**
   * Add a receipt hash without checking for duplicates
   * @param receipt - Receipt to add
   * @returns Promise that resolves to the hash
   */
  async addReceipt(receipt: Receipt): Promise<string> {
    const hash = await generateReceiptHash(receipt);
    this.seenHashes.add(hash);
    
    if (receipt.id) {
      this.receiptIdToHash.set(receipt.id, hash);
    }
    
    return hash;
  }

  /**
   * Remove a receipt hash
   * @param receipt - Receipt to remove
   * @returns Promise that resolves when complete
   */
  async removeReceipt(receipt: Receipt): Promise<void> {
    const hash = await generateReceiptHash(receipt);
    this.seenHashes.delete(hash);
    
    if (receipt.id) {
      this.receiptIdToHash.delete(receipt.id);
    }
  }

  /**
   * Clear all stored hashes
   */
  clear(): void {
    this.seenHashes.clear();
    this.receiptIdToHash.clear();
  }

  /**
   * Get the number of unique receipts tracked
   * @returns Number of unique hashes
   */
  getHashCount(): number {
    return this.seenHashes.size;
  }

  /**
   * Check if a specific hash exists
   * @param hash - Hash to check
   * @returns True if hash exists
   */
  hasHash(hash: string): boolean {
    return this.seenHashes.has(hash);
  }

  /**
   * Get all tracked hashes
   * @returns Array of all hashes
   */
  getAllHashes(): string[] {
    return Array.from(this.seenHashes);
  }

  /**
   * Get hash for a specific receipt ID
   * @param receiptId - Receipt ID
   * @returns Hash if found, undefined otherwise
   */
  getHashForReceiptId(receiptId: string): string | undefined {
    return this.receiptIdToHash.get(receiptId);
  }
}

/**
 * Singleton instance for global duplicate detection
 */
let globalDetector: ReceiptDuplicateDetector | null = null;

/**
 * Get or create the global receipt duplicate detector
 * @returns Global ReceiptDuplicateDetector instance
 */
export function getGlobalDetector(): ReceiptDuplicateDetector {
  if (!globalDetector) {
    globalDetector = new ReceiptDuplicateDetector();
  }
  return globalDetector;
}

/**
 * Reset the global detector
 */
export function resetGlobalDetector(): void {
  globalDetector = null;
}

export default ReceiptDuplicateDetector;
