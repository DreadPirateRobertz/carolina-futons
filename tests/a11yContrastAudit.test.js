/**
 * @file a11yContrastAudit.test.js
 * @description Tests for WCAG AA color contrast compliance across the codebase.
 *
 * Audits two categories:
 * 1. CTA buttons — coral background must have accessible text color (espresso, not white)
 * 2. Error text — must use colors.error (#C0392B), not colors.sunsetCoral (#E8845C)
 *
 * WCAG AA requirements:
 * - Normal text (< 18px or < 14px bold): 4.5:1 contrast ratio
 * - Large text (>= 18px or >= 14px bold): 3:1 contrast ratio
 */

import { describe, it, expect } from 'vitest';
import { colors } from '../src/public/sharedTokens.js';
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

// ── Token-level contrast tests ───────────────────────────────────────

describe('A11y: Design token contrast ratios', () => {
  it('espresso on sunsetCoral passes WCAG AA normal text (4.5:1)', () => {
    const ratio = contrastRatio(colors.espresso, colors.sunsetCoral);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('white on sunsetCoral FAILS WCAG AA (documents the problem)', () => {
    const ratio = contrastRatio(colors.white, colors.sunsetCoral);
    expect(ratio).toBeLessThan(3.0);
  });

  it('espresso on offWhite passes WCAG AA normal text', () => {
    const ratio = contrastRatio(colors.espresso, colors.offWhite);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('error color on white passes WCAG AA normal text', () => {
    const ratio = contrastRatio(colors.error, colors.white);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('error color on offWhite passes WCAG AA normal text', () => {
    const ratio = contrastRatio(colors.error, colors.offWhite);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('sunsetCoral on white FAILS WCAG AA normal text (documents the problem)', () => {
    const ratio = contrastRatio(colors.sunsetCoral, colors.white);
    expect(ratio).toBeLessThan(4.5);
  });
});

// ── Source-level audit: error text must use colors.error ─────────────

describe('A11y: Error text uses colors.error, not colors.sunsetCoral', () => {
  const errorTextFiles = [
    { path: 'src/pages/Returns.js', elements: ['returnError', 'returnFormError'] },
    { path: 'src/pages/Price Match Guarantee.js', elements: ['pmFormError'] },
    { path: 'src/pages/Order Tracking.js', elements: ['trackingError'] },
    { path: 'src/pages/Admin Returns.js', elements: ['refundError', 'dashboardError'] },
  ];

  for (const { path, elements } of errorTextFiles) {
    for (const el of elements) {
      it(`${path} — #${el} uses colors.error, not sunsetCoral`, () => {
        const content = readFileSync(path, 'utf-8');
        // Should NOT have: $w('#element').style.color = colors.sunsetCoral
        const coralPattern = new RegExp(`['"]#${el}['"].*\\.style\\.color\\s*=\\s*colors\\.sunsetCoral`);
        expect(content).not.toMatch(coralPattern);
      });
    }
  }
});

// ── Source-level audit: CTA buttons set accessible text color ────────

describe('A11y: CTA buttons with coral bg set espresso text color', () => {
  const ctaFiles = [
    { path: 'src/public/FooterSection.js', bgElement: 'footerEmailSubmit' },
    { path: 'src/public/ProductDetails.js', bgElement: 'swatchCTABtn' },
    { path: 'src/public/ProductPagePolish.js', bgElement: null }, // multiple CTAs
    { path: 'src/public/FeelAndComfort.js', bgElement: null },
    { path: 'src/pages/Checkout.js', bgElement: null }, // protection plan tier buttons
  ];

  for (const { path } of ctaFiles) {
    it(`${path} — coral bg buttons include accessible text color`, () => {
      const content = readFileSync(path, 'utf-8');
      // If file sets backgroundColor to sunsetCoral, it must also set
      // style.color to espresso (not white or unset)
      if (content.includes('backgroundColor = colors.sunsetCoral')) {
        expect(content).toMatch(/\.style\.color\s*=\s*colors\.espresso/);
      }
    });
  }
});

// ── Source-level audit: no hardcoded coral hex in error styling ──────

describe('A11y: No hardcoded coral hex (#E8845C) in error text styling', () => {
  const pagePaths = [
    'src/pages/Returns.js',
    'src/pages/Price Match Guarantee.js',
    'src/pages/Order Tracking.js',
    'src/pages/Admin Returns.js',
  ];

  for (const path of pagePaths) {
    it(`${path} — no hardcoded #E8845C for error text color`, () => {
      const content = readFileSync(path, 'utf-8');
      // Check for hardcoded coral hex in style.color assignments
      const hardcodedPattern = /\.style\.color\s*=\s*['"]#E8845C['"]/i;
      expect(content).not.toMatch(hardcodedPattern);
    });
  }
});
