import { describe, it, expect } from 'vitest';
import { colors } from '../src/public/sharedTokens.js';
import { buildProductBadgeOverlay } from '../src/public/galleryHelpers.js';

// ═══════════════════════════════════════════════════════════════════
// CF-a1ps: Brand Palette Compliance
// Ensures no pink/lavender/mauve colors appear in customer-facing UI.
// Brand palette: Sand, Espresso, Mountain Blue, Coral, Off-White.
// ═══════════════════════════════════════════════════════════════════

// Allowed brand palette colors (hex values, lowercase)
const BRAND_PALETTE = new Set([
  '#e8d5b7',  // sandBase
  '#f2e8d5',  // sandLight
  '#d4bc96',  // sandDark
  '#3a2518',  // espresso
  '#5c4033',  // espressoLight
  '#5b8fa8',  // mountainBlue
  '#3d6b80',  // mountainBlueDark
  '#a8ccd8',  // mountainBlueLight
  '#e8845c',  // sunsetCoral
  '#c96b44',  // sunsetCoralDark
  '#f2a882',  // sunsetCoralLight
  '#ffffff',  // white
  '#b8d4e3',  // skyGradientTop
  '#f0c87a',  // skyGradientBottom
  '#4a7c59',  // success
  '#999999',  // muted
  '#8b7355',  // mutedBrown
]);

describe('Brand palette compliance (CF-a1ps)', () => {
  it('colors.mauve (#C9A0A0) is NOT used in any badge background', () => {
    const inStoreBadge = buildProductBadgeOverlay({ inStoreOnly: true, name: 'Test' });
    expect(inStoreBadge).toBeTruthy();
    expect(inStoreBadge.bgColor).not.toBe('#C9A0A0');
    expect(inStoreBadge.bgColor).not.toBe(colors.mauve);
    // Should use a brand-approved color instead
    expect(BRAND_PALETTE.has(inStoreBadge.bgColor.toLowerCase())).toBe(true);
  });

  it('all badge configs use brand palette colors', () => {
    const badges = [
      buildProductBadgeOverlay({ ribbon: 'Sale', name: 'Test' }),
      buildProductBadgeOverlay({ ribbon: 'New', name: 'Test' }),
      buildProductBadgeOverlay({ ribbon: 'Featured', name: 'Test' }),
      buildProductBadgeOverlay({ inStoreOnly: true, name: 'Test' }),
    ];

    for (const badge of badges) {
      expect(badge).toBeTruthy();
      expect(BRAND_PALETTE.has(badge.bgColor.toLowerCase()),
        `Badge "${badge.text}" uses off-brand bgColor: ${badge.bgColor}`
      ).toBe(true);
      expect(BRAND_PALETTE.has(badge.textColor.toLowerCase()),
        `Badge "${badge.text}" uses off-brand textColor: ${badge.textColor}`
      ).toBe(true);
    }
  });
});
