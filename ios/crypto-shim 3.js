/**
 * Crypto Shim for React Native
 * Provides Node.js-like crypto API using expo-crypto
 */

const Crypto = require('expo-crypto');

class Hash {
  constructor(algorithm) {
    this.algorithm = algorithm;
    this.data = '';
  }

  update(data) {
    if (Buffer.isBuffer && Buffer.isBuffer(data)) {
      this.data += data.toString('utf8');
    } else {
      this.data += String(data);
    }
    return this;
  }

  digest(encoding) {
    encoding = encoding || 'hex';
    
    // Simple hash for synchronous operations
    let hash = 0;
    for (let i = 0; i < this.data.length; i++) {
      const char = this.data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const hexHash = Math.abs(hash).toString(16).padStart(16, '0');
    
    if (encoding === 'base64') {
      return Buffer.from(hexHash, 'hex').toString('base64');
    }
    
    return hexHash;
  }
}

function createHash(algorithm) {
  return new Hash(algorithm);
}

module.exports = {
  createHash: createHash,
  Hash: Hash
};

module.exports.default = module.exports;
