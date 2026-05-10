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
  '#f0f4f8',  // sandBase
  '#f8fafc',  // sandLight
  '#e2e8f0',  // sandDark
  '#ffffff',  // offWhite / white
  '#1e3a5f',  // espresso
  '#3d5a80',  // espressoLight
  '#5b8fa8',  // mountainBlue
  '#3d6b80',  // mountainBlueDark
  '#a8ccd8',  // mountainBlueLight
  '#4a7d94',  // sunsetCoral
  '#3d6b80',  // sunsetCoralDark (same as mountainBlueDark)
  '#a8ccd8',  // sunsetCoralLight (same as mountainBlueLight)
  '#b8d4e3',  // skyGradientTop
  '#f0c87a',  // skyGradientBottom
  '#4a7c59',  // success
  '#646c79',  // muted
  '#64748b',  // mutedBrown
]);

// Off-brand colors that must never appear
const BANNED_COLORS = [
  '#C9A0A0', '#c9a0a0',  // mauve/pink
  '#D4B5FF', '#d4b5ff',  // lavender
  '#E8D0FF', '#e8d0ff',  // light lavender
  '#F0E6FF', '#f0e6ff',  // pale lavender
  '#FAF0F5', '#faf0f5',  // pink tint
  '#FDF5F9', '#fdf5f9',  // pink wash
];

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

  it('sharedTokens includes offWhite color', () => {
    expect(colors.offWhite).toBe('#FFFFFF');
  });

  it('sharedTokens does NOT include any banned pink/lavender colors', () => {
    const allValues = Object.values(colors);
    for (const banned of BANNED_COLORS) {
      expect(allValues).not.toContain(banned);
    }
  });

  it('bundleBuilder _TIERS use only brand-approved badge colors', async () => {
    // _TIERS is a test-only re-export. cf-4x7e chunk 5 retired
    // getBundleRecommendations, so the assertion now reaches through
    // _TIERS directly rather than depending on the dead method's existence.
    const { _TIERS } = await import('../src/backend/bundleBuilder.web.js');
    const badgeColors = Object.values(_TIERS).map(t => (t.badgeColor || '').toLowerCase());
    for (const banned of BANNED_COLORS) {
      expect(badgeColors).not.toContain(banned.toLowerCase());
    }
    for (const c of badgeColors) {
      expect(BRAND_PALETTE.has(c), `_TIERS badge color ${c} must be in brand palette`).toBe(true);
    }
  });
});
