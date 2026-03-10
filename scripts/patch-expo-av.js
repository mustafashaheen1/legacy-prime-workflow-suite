#!/usr/bin/env node
/**
 * Idempotent patch for expo-av: removes AVAudioTimePitchAlgorithm constants
 * that were removed from AVFAudio in iOS 26, causing an NSInvalidArgumentException
 * crash on iOS 26+ devices.
 *
 * This replaces patch-package for expo-av, which is not idempotent and breaks
 * when Vercel restores a cached node_modules that already has the patch applied.
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '../node_modules/expo-av/ios/EXAV/EXAV.m'
);

if (!fs.existsSync(filePath)) {
  console.log('[patch-expo-av] EXAV.m not found, skipping.');
  process.exit(0);
}

const original = fs.readFileSync(filePath, 'utf8');

const TARGET = `  return @{
    @"Qualities": @{
        @"Low": AVAudioTimePitchAlgorithmLowQualityZeroLatency,
        @"Medium": AVAudioTimePitchAlgorithmTimeDomain,
        @"High": AVAudioTimePitchAlgorithmSpectral
    }
  };`;

const REPLACEMENT = `  // AVAudioTimePitchAlgorithm* constants were removed from AVFAudio in iOS 26.
  // Returning them caused NSInvalidArgumentException (nil objects[1]) on iOS 26+.
  // These constants are unused by the modern expo-av JS API.
  return @{};`;

if (!original.includes(TARGET)) {
  console.log('[patch-expo-av] Already patched or unexpected content, skipping.');
  process.exit(0);
}

const patched = original.replace(TARGET, REPLACEMENT);
fs.writeFileSync(filePath, patched, 'utf8');
console.log('[patch-expo-av] Successfully patched EXAV.m');
