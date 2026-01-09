#!/usr/bin/env node
/**
 * Status Color Contrast Validation Script
 *
 * Validates WCAG contrast ratios for status color tokens.
 * Task 318.5 - Accessibility and Contrast Validation
 *
 * Usage: node scripts/validate-status-colors.mjs
 */

/**
 * Convert HSL to RGB
 */
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;

  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4))
  ];
}

/**
 * Calculate relative luminance (WCAG formula)
 */
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
function getContrastRatio(rgb1, rgb2) {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Parse HSL string to [h, s, l]
 */
function parseHsl(hslString) {
  const parts = hslString.split(' ').map(p => parseFloat(p));
  return parts;
}

/**
 * Get WCAG level for contrast ratio
 */
function getWcagLevel(ratio) {
  if (ratio >= 7) return 'AAA (Enhanced)';
  if (ratio >= 4.5) return 'AA (Minimum)';
  if (ratio >= 3) return 'AA Large Text';
  return 'FAIL';
}

// Color definitions from index.css
const colors = {
  light: {
    pending: {
      bg: '217 91% 50%',
      fg: '0 0% 100%'
    },
    success: {
      bg: '142 76% 30%',
      fg: '0 0% 100%'
    },
    warning: {
      bg: '38 92% 50%',
      fg: '28 50% 15%'
    },
    error: {
      bg: '0 84% 50%',
      fg: '0 0% 100%'
    }
  },
  dark: {
    pending: {
      bg: '217 91% 70%',
      fg: '217 91% 10%'
    },
    success: {
      bg: '142 70% 45%',
      fg: '142 70% 10%'
    },
    warning: {
      bg: '38 92% 60%',
      fg: '38 92% 10%'
    },
    error: {
      bg: '0 84% 70%',
      fg: '0 84% 10%'
    }
  }
};

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║     Status Color Contrast Validation (Task 318.5)             ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

let allPassed = true;

for (const [theme, themeColors] of Object.entries(colors)) {
  console.log(`\n${theme.toUpperCase()} THEME`);
  console.log('═'.repeat(70));

  for (const [status, { bg, fg }] of Object.entries(themeColors)) {
    const bgHsl = parseHsl(bg);
    const fgHsl = parseHsl(fg);

    const bgRgb = hslToRgb(...bgHsl);
    const fgRgb = hslToRgb(...fgHsl);

    const ratio = getContrastRatio(bgRgb, fgRgb);
    const level = getWcagLevel(ratio);
    const passed = ratio >= 4.5;

    const statusIcon = passed ? '✓' : '✗';
    const statusColor = passed ? '\x1b[32m' : '\x1b[31m';
    const resetColor = '\x1b[0m';

    console.log(`\n${statusIcon} ${status.toUpperCase()}`);
    console.log(`  Background: HSL(${bg}) → RGB(${bgRgb.join(', ')})`);
    console.log(`  Foreground: HSL(${fg}) → RGB(${fgRgb.join(', ')})`);
    console.log(`  ${statusColor}Contrast Ratio: ${ratio.toFixed(2)}:1 - ${level}${resetColor}`);

    if (!passed) {
      allPassed = false;
      console.log(`  ${statusColor}⚠️  WCAG AA requires minimum 4.5:1${resetColor}`);
    }
  }
}

console.log('\n' + '═'.repeat(70));
console.log('\nWCAG 2.1 Standards:');
console.log('  • AAA (Enhanced): 7:1 or higher');
console.log('  • AA (Minimum): 4.5:1 or higher');
console.log('  • AA Large Text: 3:1 or higher');
console.log('  • Below 3:1: FAIL\n');

if (allPassed) {
  console.log('\x1b[32m✓ ALL STATUS COLORS PASS WCAG AA CONTRAST REQUIREMENTS\x1b[0m\n');
  process.exit(0);
} else {
  console.log('\x1b[31m✗ SOME STATUS COLORS FAIL WCAG AA CONTRAST REQUIREMENTS\x1b[0m\n');
  process.exit(1);
}
