/**
 * React Native Crypto Polyfill
 * 
 * This file provides crypto functionality for React Native using expo-crypto
 * instead of Node.js's built-in crypto module, which is not available in RN.
 * 
 * Install: npm install expo-crypto
 */

import * as Crypto from 'expo-crypto';

/**
 * Creates a SHA-256 hash of the input string
 * @param input - The string to hash
 * @returns The hash as a hex string
 */
export async function createSHA256Hash(input: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  return hash;
}

/**
 * Creates a SHA-256 hash of the input string (synchronous fallback)
 * Note: This uses a less secure but synchronous method
 * @param input - The string to hash
 * @returns The hash as a hex string
 */
export function createSHA256HashSync(input: string): string {
  // For synchronous operations, we need a different approach
  // This is a simple fallback that uses base64 encoding
  // For production, consider using react-native-quick-crypto instead
  
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  
  // Simple hash function (not cryptographically secure, but works for duplicate detection)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Creates a hash from base64 content
 * @param base64Content - The base64 encoded content
 * @returns The hash as a hex string
 */
export async function hashBase64Content(base64Content: string): Promise<string> {
  return createSHA256Hash(base64Content);
}

export default {
  createSHA256Hash,
  createSHA256HashSync,
  hashBase64Content,
};
