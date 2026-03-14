/**
 * Token compliance tests — cf-mbhk
 *
 * Two layers of verification:
 * 1. Import tests: files import from designTokens.js, use valid token names
 * 2. Source lint tests: no hardcoded hex in style/color assignments
 * 3. Runtime value tests: exported values match token constants
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { colors, shadows, shadowToCSS } from '../src/public/sharedTokens.js';
import { _TIERS } from '../src/backend/bundleBuilder.web.js';
import { get_manifest } from '../src/backend/http-functions.js';

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

// Brand hex values that must only appear in sharedTokens.js definitions
const BRAND_HEX = [
  '#F0F4F8', '#F8FAFC', '#1E3A5F', '#5B8FA8', '#4A7D94',
];

// ── designTokens import compliance ──────────────────────────────────

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
    expect(src).not.toMatch(/colors\.successGreen/);
    expect(src).not.toMatch(/colors\.textMuted/);
  });

  it('LiveChat.js uses valid color token names for status indicator', () => {
    const src = readSrc('public/LiveChat.js');
    const statusLine = src.match(/indicator\.style\.color\s*=.*?;/);
    expect(statusLine).toBeTruthy();
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
    expect(src).not.toMatch(/['"]0 2px 8px rgba\(58,\s*37,\s*24/);
    expect(src).toMatch(/shadows\.nav/);
  });

  it('navigationHelpers.js does not import unused fontFamilies', () => {
    const src = readSrc('public/navigationHelpers.js');
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
    expect(src).not.toMatch(/import\s*\{[^}]*colors[^}]*\}\s*from\s*['"]public\/sharedTokens/);
  });
});

// ── Source lint: no hardcoded hex in style assignments ───────────────

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
      const hexInStyle = src.match(/\.style\.\w+\s*=\s*['"]#[0-9a-fA-F]{3,8}['"]/g);
      expect(hexInStyle, `Found hardcoded hex in ${file}: ${hexInStyle}`).toBeNull();
    });
  }
});

// ── Source lint: no hardcoded brand hex outside token definitions ────

describe('source-level token compliance', () => {
  const FILES_TO_CHECK = [
    'backend/bundleBuilder.web.js',
    'backend/http-functions.js',
    'public/navigationHelpers.js',
    'public/FooterSection.js',
    'public/LiveChat.js',
    'pages/masterPage.js',
  ];

  for (const filePath of FILES_TO_CHECK) {
    it(`${filePath} has no hardcoded brand hex values`, () => {
      // Strip static SVG content constants (pipeline output embedded as literal strings)
      // These contain hex values by design — they are verified by the pipeline token step
      const source = readSrc(filePath).replace(/^const \w+_CONTENT = '[^']*';$/gm, '');
      for (const hex of BRAND_HEX) {
        const regex = new RegExp(hex.replace('#', '#'), 'gi');
        const matches = source.match(regex);
        expect(
          matches,
          `${filePath} contains hardcoded ${hex} — use token import instead`
        ).toBeNull();
      }
    });
  }

  it('navigationHelpers.js has no hardcoded rgba in style assignments', () => {
    const source = readSrc('public/navigationHelpers.js');
    const hardcodedShadow = /\.style\.boxShadow\s*=\s*'[^']*rgba\(\d/;
    expect(
      hardcodedShadow.test(source),
      'navigationHelpers.js has hardcoded rgba in boxShadow — use shadows token'
    ).toBe(false);
  });
});

// ── bundleBuilder.web.js — TIERS badge colors ──────────────────────

describe('bundleBuilder TIERS token compliance', () => {
  it('starter tier uses colors.mountainBlue for badge', () => {
    expect(_TIERS.starter.badgeColor).toBe(colors.mountainBlue);
  });

  it('essentials tier uses colors.sunsetCoral for badge', () => {
    expect(_TIERS.essentials.badgeColor).toBe(colors.sunsetCoral);
  });

  it('premium tier uses colors.espresso for badge', () => {
    expect(_TIERS.premium.badgeColor).toBe(colors.espresso);
  });

  it('deluxe tier uses colors.mountainBlue for badge', () => {
    expect(_TIERS.deluxe.badgeColor).toBe(colors.mountainBlue);
  });

  it('no tier has a hardcoded hex that does not match a token', () => {
    const tokenValues = new Set(Object.values(colors));
    for (const [name, tier] of Object.entries(_TIERS)) {
      expect(
        tokenValues.has(tier.badgeColor),
        `TIERS.${name}.badgeColor (${tier.badgeColor}) must be a token value`
      ).toBe(true);
    }
  });
});

// ── http-functions.js — PWA manifest colors ────────────────────────

describe('PWA manifest token compliance', () => {
  it('background_color uses colors.sandBase', () => {
    const res = get_manifest();
    const manifest = JSON.parse(res.body);
    expect(manifest.background_color).toBe(colors.sandBase);
  });

  it('theme_color uses colors.mountainBlue', () => {
    const res = get_manifest();
    const manifest = JSON.parse(res.body);
    expect(manifest.theme_color).toBe(colors.mountainBlue);
  });
});

// ── navigationHelpers.js — sticky nav shadow ───────────────────────

describe('navigationHelpers sticky nav token compliance', () => {
  it('shadows.nav token produces expected CSS string', () => {
    const css = shadowToCSS(shadows.nav);
    expect(css).toBe('0px 2px 8px rgba(30, 58, 95, 0.06)');
  });

  it('shadows.nav matches the navy-tinted brand shadow', () => {
    expect(shadows.nav.color).toContain('30, 58, 95');
  });
});
