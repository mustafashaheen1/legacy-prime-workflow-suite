/**
 * Crypto Shim for React Native
 * This file provides a Node.js-like crypto API using expo-crypto
 * It allows existing code using require('crypto') to work in React Native
 */

import * as Crypto from 'expo-crypto';

class Hash {
  private algorithm: string;
  private data: string = '';

  constructor(algorithm: string) {
    this.algorithm = algorithm;
  }

  update(data: string | Buffer): Hash {
    if (Buffer.isBuffer(data)) {
      this.data += data.toString('utf8');
    } else {
      this.data += data;
    }
    return this;
  }

  digest(encoding: 'hex' | 'base64' = 'hex'): string {
    // Since expo-crypto is async, we need to handle this differently
    // For now, we'll use a synchronous fallback
    // In production, refactor code to use async/await
    
    // Simple hash for duplicate detection (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < this.data.length; i++) {
      const char = this.data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    const hexHash = Math.abs(hash).toString(16).padStart(16, '0');
    
    if (encoding === 'base64') {
      return Buffer.from(hexHash, 'hex').toString('base64');
    }
    
    return hexHash;
  }

  async digestAsync(encoding: 'hex' | 'base64' = 'hex'): Promise<string> {
    const cryptoEncoding = encoding === 'hex' 
      ? Crypto.CryptoEncoding.HEX 
      : Crypto.CryptoEncoding.BASE64;
    
    let algorithm;
    switch (this.algorithm.toLowerCase()) {
      case 'sha256':
        algorithm = Crypto.CryptoDigestAlgorithm.SHA256;
        break;
      case 'sha512':
        algorithm = Crypto.CryptoDigestAlgorithm.SHA512;
        break;
      case 'sha1':
        algorithm = Crypto.CryptoDigestAlgorithm.SHA1;
        break;
      case 'md5':
        algorithm = Crypto.CryptoDigestAlgorithm.MD5;
        break;
      default:
        algorithm = Crypto.CryptoDigestAlgorithm.SHA256;
    }
    
    return await Crypto.digestStringAsync(algorithm, this.data, { encoding: cryptoEncoding });
  }
}

function createHash(algorithm: string): Hash {
  return new Hash(algorithm);
}

// Async version for proper crypto operations
async function createHashAsync(algorithm: string, data: string, encoding: 'hex' | 'base64' = 'hex'): Promise<string> {
  const hash = new Hash(algorithm);
  hash.update(data);
  return hash.digestAsync(encoding);
}

// Export both CommonJS and ES Module style
module.exports = {
  createHash,
  createHashAsync,
  Hash,
};

export { createHash, createHashAsync, Hash };
export default { createHash, createHashAsync, Hash };
