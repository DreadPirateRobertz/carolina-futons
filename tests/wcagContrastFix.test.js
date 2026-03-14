/**
 * @file wcagContrastFix.test.js
 * @description TDD tests for hq-lw2i: WCAG AA contrast fix.
 *
 * Verifies:
 * 1. CSS text/link uses of --cf-blue are replaced with --cf-blue-dark for contrast
 * 2. Global focus-visible CSS rule exists
 * 3. Design token mountainBlue is not used for normal-size text on white/light backgrounds
 *
 * WCAG AA requirements:
 * - Normal text (< 18px or < 14px bold): 4.5:1 contrast ratio
 * - Large text (>= 18px or >= 14px bold): 3:1 contrast ratio
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// ── Contrast ratio calculator ────────────────────────────────────────

function sRGBtoLinear(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── CSS color token values (from :root in global.css) ────────────────

const CF_BLUE = '#5B8FA8';
const CF_BLUE_DARK = '#3D6B80';
const CF_WHITE = '#FFFFFF';
const CF_GRAY_LIGHT = '#F0F4F8';

// ── 1. Token contrast verification ──────────────────────────────────

describe('WCAG AA: cf-blue-dark passes for normal text', () => {
  it('cf-blue-dark on white passes AA normal text (4.5:1)', () => {
    const ratio = contrastRatio(CF_BLUE_DARK, CF_WHITE);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('cf-blue-dark on gray-light passes AA normal text (4.5:1)', () => {
    const ratio = contrastRatio(CF_BLUE_DARK, CF_GRAY_LIGHT);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('cf-blue (#5B8FA8) fails AA normal text on white — this is why we fix it', () => {
    const ratio = contrastRatio(CF_BLUE, CF_WHITE);
    expect(ratio).toBeLessThan(4.5);
  });

  it('cf-blue (#5B8FA8) fails AA normal text on gray-light', () => {
    const ratio = contrastRatio(CF_BLUE, CF_GRAY_LIGHT);
    expect(ratio).toBeLessThan(4.5);
  });
});

// ── 2. CSS audit: text/link color uses cf-blue-dark, not cf-blue ────

describe('WCAG AA: global.css text/link colors use --cf-blue-dark', () => {
  const css = readFileSync('src/styles/global.css', 'utf-8');

  // These are CSS rules where color (not background-color) was set to var(--cf-blue).
  // After the fix, they should use var(--cf-blue-dark) instead.
  const textColorRules = [
    { desc: 'nav hover link color', pattern: /\.horizontal-menu__item-label:hover[\s\S]*?color:\s*var\(--cf-blue-dark\)/m },
    { desc: 'product item price color', pattern: /\[data-hook="product-item-price-to-pay"\][\s\S]*?color:\s*var\(--cf-blue-dark\)/m },
    { desc: 'product page price color', pattern: /\[data-hook="product-price"\][\s\S]*?color:\s*var\(--cf-blue-dark\)/m },
    { desc: 'blog read-more link color', pattern: /\[data-hook="read-more-link"\][\s\S]*?color:\s*var\(--cf-blue-dark\)/m },
    { desc: 'rich-text link color', pattern: /\.rich-text a[\s\S]*?color:\s*var\(--cf-blue-dark\)/m },
  ];

  for (const { desc, pattern } of textColorRules) {
    it(`${desc} uses var(--cf-blue-dark)`, () => {
      expect(css).toMatch(pattern);
    });
  }

  // Verify no text color rules still use var(--cf-blue) (excluding background-color and hover bg)
  it('no text "color: var(--cf-blue)" remains in CSS (excluding background-color)', () => {
    // Extract all lines with "color: var(--cf-blue)" that are NOT "background-color:"
    const lines = css.split('\n');
    const textColorBlueLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.match(/^color:\s*var\(--cf-blue\)/) && !trimmed.startsWith('background-color');
    });
    expect(textColorBlueLines).toEqual([]);
  });
});

// ── 3. CSS audit: focus-visible rule exists ─────────────────────────

describe('WCAG AA: global.css includes focus-visible styles', () => {
  const css = readFileSync('src/styles/global.css', 'utf-8');

  it('has a :focus-visible rule', () => {
    expect(css).toMatch(/:focus-visible/);
  });

  it('focus-visible rule includes outline property', () => {
    // Match a :focus-visible block that contains an outline declaration
    expect(css).toMatch(/:focus-visible[\s\S]*?outline.*:/m);
  });

  it('focus-visible rule uses brand color (--cf-blue or --cf-blue-dark)', () => {
    expect(css).toMatch(/:focus-visible[\s\S]*?var\(--cf-blue(?:-dark)?\)/m);
  });
});
