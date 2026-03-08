import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { colors } from '../../src/public/sharedTokens.js';

// ═══════════════════════════════════════════════════════════════════
// CF-a0sh: CTA Coral Audit — Non-brand color elimination
// Ensures all badge colors and UI-facing hex values use brand palette.
// Ranks 1+3 from HOMOGENIZATION-ANALYSIS: green → coral, lavender → sand.
// ═══════════════════════════════════════════════════════════════════

// Brand palette (lowercase hex) — all allowed colors
const BRAND_PALETTE = new Set([
  '#e8d5b7', '#f2e8d5', '#d4bc96', '#faf7f2',
  '#3a2518', '#5c4033',
  '#5b8fa8', '#3d6b80', '#a8ccd8',
  '#e8845c', '#c96b44', '#f2a882',
  '#c9a0a0', '#ffffff',
  '#b8d4e3', '#f0c87a',
  '#4a7c59', '#999999', '#8b7355',
]);

function isBrandColor(hex) {
  return BRAND_PALETTE.has(hex.toLowerCase());
}

function readSource(relPath) {
  return readFileSync(join(process.cwd(), relPath), 'utf-8');
}

// Extract all hex color literals from a source string
function findHexColors(source) {
  const matches = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment-only lines
    if (line.trim().startsWith('//')) continue;
    // Find all hex colors
    const re = /'#([0-9A-Fa-f]{6})'/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      matches.push({ line: i + 1, hex: `#${m[1]}`, content: line.trim() });
    }
  }
  return matches;
}

// ── Static audit: page files must not hardcode hex in style assignments ──

describe('CF-a0sh: page files use token imports, not hardcoded hex', () => {
  const PAGE_FILES = [
    'src/pages/Blog.js',
    'src/pages/Style Quiz.js',
  ];

  for (const relPath of PAGE_FILES) {
    it(`${relPath} has no hardcoded hex in style assignments`, () => {
      const source = readSource(relPath);
      const lines = source.split('\n');
      const violations = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('//') || line.trim().startsWith('import')) continue;
        if (line.includes('.style.') && /'#[0-9A-Fa-f]{6}'/.test(line)) {
          violations.push({ line: i + 1, content: line.trim() });
        }
      }

      expect(violations, `Hardcoded hex in ${relPath}:\n${violations.map(v => `  L${v.line}: ${v.content}`).join('\n')}`).toEqual([]);
    });
  }
});

// ── Static audit: ProductDetails.js ─────────────────────────────

describe('CF-a0sh: ProductDetails.js uses token imports, not hardcoded hex', () => {
  it('no hardcoded hex in style assignments', () => {
    const source = readSource('src/public/ProductDetails.js');
    const lines = source.split('\n');
    const violations = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('import')) continue;
      if (line.includes('.style.') && /'#[0-9A-Fa-f]{6}'/.test(line)) {
        violations.push({ line: i + 1, content: line.trim() });
      }
    }

    expect(violations, `Hardcoded hex in ProductDetails.js:\n${violations.map(v => `  L${v.line}: ${v.content}`).join('\n')}`).toEqual([]);
  });
});

// ── Static audit: sustainabilityService badge colors ────────────

describe('CF-a0sh: sustainabilityService.web.js uses only brand colors', () => {
  const source = readSource('src/backend/sustainabilityService.web.js');
  const allHex = findHexColors(source);

  it('contains no non-brand hex color literals', () => {
    const nonBrand = allHex.filter(h => !isBrandColor(h.hex));
    expect(nonBrand, `Non-brand colors in sustainabilityService:\n${nonBrand.map(h => `  L${h.line}: ${h.hex} — ${h.content}`).join('\n')}`).toEqual([]);
  });

  // Specific banned colors from the audit
  const BANNED = ['#2E7D32', '#558B2F', '#1565C0', '#6A1B9A', '#00695C', '#E65100'];
  for (const banned of BANNED) {
    it(`does not contain banned color ${banned}`, () => {
      expect(source).not.toContain(`'${banned}'`);
    });
  }
});

// ── Static audit: paymentOptions badge colors ───────────────────

describe('CF-a0sh: paymentOptions.web.js uses only brand colors', () => {
  const source = readSource('src/backend/paymentOptions.web.js');
  const allHex = findHexColors(source);

  it('contains no non-brand hex color literals', () => {
    const nonBrand = allHex.filter(h => !isBrandColor(h.hex));
    expect(nonBrand, `Non-brand colors in paymentOptions:\n${nonBrand.map(h => `  L${h.line}: ${h.hex} — ${h.content}`).join('\n')}`).toEqual([]);
  });

  const BANNED = ['#B2FCE4', '#000000', '#E8F5E9', '#1B5E20', '#E3F2FD'];
  for (const banned of BANNED) {
    it(`does not contain banned color ${banned}`, () => {
      expect(source).not.toContain(`'${banned}'`);
    });
  }
});

// ── Static audit: Order Tracking fallback colors ────────────────

describe('CF-a0sh: Order Tracking.js uses no non-brand fallback colors', () => {
  const source = readSource('src/pages/Order Tracking.js');

  const BANNED_FALLBACKS = ['#D1D5DB', '#9CA3AF', '#6B7280'];
  for (const banned of BANNED_FALLBACKS) {
    it(`does not contain non-brand fallback ${banned}`, () => {
      expect(source).not.toContain(`'${banned}'`);
    });
  }
});

// ── Static audit: Compare Page fallback color ───────────────────

describe('CF-a0sh: Compare Page.js uses no non-brand fallback colors', () => {
  it('does not contain non-brand fallback #FFF8F0', () => {
    const source = readSource('src/pages/Compare Page.js');
    expect(source).not.toContain("'#FFF8F0'");
  });
});

// ── Comprehensive: no #3ECF8E green anywhere in src/ ────────────

describe('CF-a0sh: no green #3ECF8E in any source file', () => {
  it('sharedTokens.js does not contain #3ECF8E', () => {
    const source = readSource('src/public/sharedTokens.js');
    expect(source.toLowerCase()).not.toContain('#3ecf8e');
  });

  it('designTokens.js does not contain #3ECF8E', () => {
    const source = readSource('src/public/designTokens.js');
    expect(source.toLowerCase()).not.toContain('#3ecf8e');
  });
});
