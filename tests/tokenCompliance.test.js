/**
 * Token compliance tests — cf-mbhk
 *
 * Verifies that FooterSection.js, LiveChat.js, navigationHelpers.js,
 * masterPage.js, and Checkout.js import from designTokens.js and use
 * correct token references (no hardcoded hex in style assignments,
 * no nonexistent color names).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = resolve(__dirname, '../src');

function readSrc(relPath) {
  return readFileSync(resolve(SRC, relPath), 'utf-8');
}

// Valid color token keys from sharedTokens
const VALID_COLOR_KEYS = [
  'sandBase', 'sandLight', 'sandDark',
  'espresso', 'espressoLight',
  'mountainBlue', 'mountainBlueDark', 'mountainBlueLight',
  'sunsetCoral', 'sunsetCoralDark', 'sunsetCoralLight',
  'offWhite', 'white',
  'skyGradientTop', 'skyGradientBottom',
  'overlay',
  'success', 'error', 'muted', 'mutedBrown',
];

describe('Token compliance — designTokens imports (cf-mbhk)', () => {
  it('FooterSection.js imports from designTokens.js', () => {
    const src = readSrc('public/FooterSection.js');
    expect(src).toMatch(/from\s+['"]public\/designTokens(?:\.js)?['"]/);
  });

  it('LiveChat.js imports colors, transitions, spacing from designTokens.js', () => {
    const src = readSrc('public/LiveChat.js');
    expect(src).toMatch(/from\s+['"]public\/designTokens(?:\.js)?['"]/);
    // Must import at least colors and transitions
    const importLine = src.match(/import\s*\{([^}]+)\}\s*from\s*['"]public\/designTokens/);
    expect(importLine).toBeTruthy();
    const imports = importLine[1];
    expect(imports).toMatch(/colors/);
    expect(imports).toMatch(/transitions/);
  });

  it('LiveChat.js does NOT reference nonexistent color tokens', () => {
    const src = readSrc('public/LiveChat.js');
    // These were bugs — successGreen and textMuted don't exist
    expect(src).not.toMatch(/colors\.successGreen/);
    expect(src).not.toMatch(/colors\.textMuted/);
  });

  it('LiveChat.js uses valid color token names for status indicator', () => {
    const src = readSrc('public/LiveChat.js');
    // Should use colors.success and colors.muted (or colors.mutedBrown)
    const statusLine = src.match(/indicator\.style\.color\s*=.*?;/);
    expect(statusLine).toBeTruthy();
    // Extract token references
    const tokenRefs = statusLine[0].match(/colors\.(\w+)/g) || [];
    for (const ref of tokenRefs) {
      const key = ref.replace('colors.', '');
      expect(VALID_COLOR_KEYS, `Unknown color token: colors.${key}`).toContain(key);
    }
  });

  it('navigationHelpers.js imports colors from designTokens.js (not only sharedTokens)', () => {
    const src = readSrc('public/navigationHelpers.js');
    expect(src).toMatch(/from\s+['"]public\/designTokens(?:\.js)?['"]/);
  });

  it('navigationHelpers.js uses shadows.nav token for sticky nav (no hardcoded shadow)', () => {
    const src = readSrc('public/navigationHelpers.js');
    // Should NOT have the hardcoded shadow string in initStickyNav
    expect(src).not.toMatch(/['"]0 2px 8px rgba\(58,\s*37,\s*24/);
    // Should reference shadows.nav
    expect(src).toMatch(/shadows\.nav/);
  });

  it('navigationHelpers.js does not import unused fontFamilies', () => {
    const src = readSrc('public/navigationHelpers.js');
    // fontFamilies should not be in any import statement
    const importLines = src.match(/import\s*\{[^}]*\}\s*from\s*['"]public\/(?:shared|design)Tokens/g) || [];
    for (const line of importLines) {
      expect(line).not.toMatch(/fontFamilies/);
    }
  });

  it('masterPage.js imports colors from designTokens.js', () => {
    const src = readSrc('pages/masterPage.js');
    const importLine = src.match(/import\s*\{([^}]+)\}\s*from\s*['"]public\/designTokens/);
    expect(importLine).toBeTruthy();
    expect(importLine[1]).toMatch(/colors/);
  });

  it('Checkout.js imports colors from designTokens.js (not sharedTokens)', () => {
    const src = readSrc('pages/Checkout.js');
    expect(src).toMatch(/import\s*\{[^}]*colors[^}]*\}\s*from\s*['"]public\/designTokens(?:\.js)?['"]/);
    // Should NOT import colors from sharedTokens
    expect(src).not.toMatch(/import\s*\{[^}]*colors[^}]*\}\s*from\s*['"]public\/sharedTokens/);
  });
});

describe('Token compliance — no hardcoded hex in style assignments', () => {
  const FILES_TO_CHECK = [
    'public/FooterSection.js',
    'public/LiveChat.js',
    'public/navigationHelpers.js',
    'pages/masterPage.js',
  ];

  for (const file of FILES_TO_CHECK) {
    it(`${file} has no hardcoded hex colors in .style assignments`, () => {
      const src = readSrc(file);
      // Find all .style.someProperty = '...' or .style.someProperty = "..."
      // Match style assignments that contain hex color values
      const hexInStyle = src.match(/\.style\.\w+\s*=\s*['"]#[0-9a-fA-F]{3,8}['"]/g);
      expect(hexInStyle, `Found hardcoded hex in ${file}: ${hexInStyle}`).toBeNull();
    });
  }
});
