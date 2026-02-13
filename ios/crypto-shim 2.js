/**
 * Crypto Shim for React Native
 * This file provides a Node.js-like crypto API using expo-crypto
 * It allows existing code using require('crypto') to work in React Native
 */

const Crypto = require('expo-crypto');

class Hash {
  constructor(algorithm) {
    this.algorithm = algorithm;
    this.data = '';
  }

  update(data) {
    if (Buffer.isBuffer(data)) {
      this.data += data.toString('utf8');
    } else {
      this.data += String(data);
    }
    return this;
  }

  digest(encoding) {
    encoding = encoding || 'hex';
    
    // Simple synchronous hash (for duplicate detection)
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

  async digestAsync(encoding) {
    encoding = encoding || 'hex';
    
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
    
    const cryptoEncoding = encoding === 'hex' 
      ? Crypto.CryptoEncoding.HEX 
      : Crypto.CryptoEncoding.BASE64;
    
    return await Crypto.digestStringAsync(algorithm, this.data, { encoding: cryptoEncoding });
  }
}

function createHash(algorithm) {
  return new Hash(algorithm);
}

// Export for CommonJS
module.exports = {
  createHash: createHash,
  Hash: Hash
};

// Also support default export
module.exports.default = module.exports;
