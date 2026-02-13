#!/usr/bin/env node
const fs = require('fs');
const { execSync } = require('child_process');

console.log('Generating favicon.ico from logo...');

const sourceImage = './assets/images/favicon.png';
const outputIco = './public/favicon.ico';

// Ensure public directory exists
if (!fs.existsSync('./public')) {
  fs.mkdirSync('./public', { recursive: true });
}

try {
  // Use macOS sips to create different sizes
  console.log('Creating 16x16 version...');
  execSync(`sips -z 16 16 "${sourceImage}" --out ./public/favicon-16.png`);

  console.log('Creating 32x32 version...');
  execSync(`sips -z 32 32 "${sourceImage}" --out ./public/favicon-32.png`);

  console.log('Creating 48x48 version...');
  execSync(`sips -z 48 48 "${sourceImage}" --out ./public/favicon-48.png`);

  console.log('✅ Favicon images created in public folder');
  console.log('Note: Expo will automatically convert these to .ico format during build');

  // Copy the main favicon.png to public
  fs.copyFileSync(sourceImage, './public/favicon.png');
  console.log('✅ Copied favicon.png to public folder');

} catch (error) {
  console.error('Error generating favicons:', error.message);
  process.exit(1);
}
