/**
 * Create placeholder PNG icons
 * This creates simple base64-encoded PNG data URLs that can be converted to files
 */

const fs = require('fs');

// Simple 1x1 purple pixel as base64 PNG
const purplePixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==';

// Create simple colored squares for each size
function createIcon(size, filename) {
  // This creates a very basic PNG - for production, use proper image generation
  const buffer = Buffer.from(purplePixel, 'base64');
  fs.writeFileSync(filename, buffer);
  console.log(`Created ${filename} (${size}x${size})`);
}

// Create all required icons
createIcon(16, 'icon16.png');
createIcon(48, 'icon48.png');
createIcon(128, 'icon128.png');

console.log('\nPlaceholder icons created!');
console.log('For production, replace these with proper icons using the SVG template.');
