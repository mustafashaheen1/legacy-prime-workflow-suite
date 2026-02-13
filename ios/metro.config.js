const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add crypto shim to resolve Node.js crypto module
config.resolver.extraNodeModules = {
  crypto: path.resolve(__dirname, 'crypto-shim.js'),
};

// Ensure proper resolution for react-native modules
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'ts', 'tsx', 'js', 'jsx'];

module.exports = config;
