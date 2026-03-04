import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  brand,
  colors,
  fontFamilies,
  spacing,
  borderRadius,
  shadows,
  transitions,
  breakpoints,
  business,
  shippingConfig,
  shadowToCSS,
  spacingPx,
} from '../src/public/sharedTokens.js';

// Load JSON for sync verification
const jsonPath = resolve(__dirname, '../design-tokens.json');
const tokenJSON = JSON.parse(readFileSync(jsonPath, 'utf8'));

// ── Brand ──────────────────────────────────────────────────────────

describe('brand', () => {
  it('has correct brand identity', () => {
    expect(brand.name).toBe('Carolina Futons');
    expect(brand.shortName).toBe('CF Futons');
    expect(brand.foundedYear).toBe(1991);
  });
});

// ── Business Contact ────────────────────────────────────────────────

describe('business', () => {
  it('has phone in all formats', () => {
    expect(business.phone).toBe('(828) 252-9449');
    expect(business.phoneE164).toBe('+18282529449');
    expect(business.phoneDigits).toBe('8282529449');
  });

  it('has complete address', () => {
    expect(business.address.street).toBe('824 Locust St, Ste 200');
    expect(business.address.city).toBe('Hendersonville');
    expect(business.address.state).toBe('NC');
    expect(business.address.zip).toBe('28792');
  });

  it('has base URL and hours', () => {
    expect(business.baseUrl).toContain('carolinafutons.com');
    expect(business.hours).toBeTruthy();
  });

  it('has delivery days as numbers', () => {
    expect(business.deliveryDays).toBeInstanceOf(Array);
    expect(business.deliveryDays.length).toBeGreaterThanOrEqual(3);
    for (const day of business.deliveryDays) {
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day).toBeLessThanOrEqual(6);
    }
  });
});

// ── Shipping Config ─────────────────────────────────────────────────

describe('shippingConfig', () => {
  it('has free shipping threshold', () => {
    expect(shippingConfig.freeThreshold).toBe(999);
  });

  it('has white glove pricing', () => {
    expect(shippingConfig.whiteGlove.freeThreshold).toBe(1999);
    expect(shippingConfig.whiteGlove.localPrice).toBe(149);
    expect(shippingConfig.whiteGlove.regionalPrice).toBe(249);
  });

  it('has ZIP zone definitions', () => {
    expect(shippingConfig.zones.local.prefixMin).toBe(287);
    expect(shippingConfig.zones.local.prefixMax).toBe(289);
    expect(shippingConfig.zones.regional.prefixMin).toBe(270);
    expect(shippingConfig.zones.regional.prefixMax).toBe(399);
  });

  it('local zone is subset of regional zone', () => {
    expect(shippingConfig.zones.local.prefixMin).toBeGreaterThanOrEqual(shippingConfig.zones.regional.prefixMin);
    expect(shippingConfig.zones.local.prefixMax).toBeLessThanOrEqual(shippingConfig.zones.regional.prefixMax);
  });
});

// ── Colors ─────────────────────────────────────────────────────────

describe('shared colors', () => {
  it('has all four primary brand colors matching mobile spec (cm-330)', () => {
    expect(colors.sandBase).toBe('#E8D5B7');
    expect(colors.espresso).toBe('#3A2518');
    expect(colors.mountainBlue).toBe('#5B8FA8');
    expect(colors.sunsetCoral).toBe('#E8845C');
  });

  it('has variant colors for each primary', () => {
    expect(colors.sandLight).toBeDefined();
    expect(colors.sandDark).toBeDefined();
    expect(colors.espressoLight).toBeDefined();
    expect(colors.mountainBlueDark).toBeDefined();
    expect(colors.mountainBlueLight).toBeDefined();
    expect(colors.sunsetCoralDark).toBeDefined();
    expect(colors.sunsetCoralLight).toBeDefined();
  });

  it('has semantic colors', () => {
    expect(colors.success).toBe('#4A7C59');
    expect(colors.error).toBe('#C0392B');
    expect(colors.muted).toBe('#767676');
    expect(colors.mutedBrown).toBe('#816D51');
  });

  it('all values are valid hex or rgba', () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(
        value.startsWith('#') || value.startsWith('rgba'),
        `${key}: ${value} should be hex or rgba`
      ).toBe(true);
    }
  });
});

// ── Font Families ──────────────────────────────────────────────────

describe('fontFamilies', () => {
  it('defines heading and body fonts', () => {
    expect(fontFamilies.heading).toContain('Playfair Display');
    expect(fontFamilies.body).toContain('Source Sans 3');
  });
});

// ── Spacing ────────────────────────────────────────────────────────

describe('shared spacing', () => {
  it('uses 4px base grid', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(16);
    expect(spacing.lg).toBe(24);
    expect(spacing.xl).toBe(32);
    expect(spacing.xxl).toBe(48);
    expect(spacing.xxxl).toBe(64);
  });

  it('all values are multiples of 4', () => {
    for (const [key, value] of Object.entries(spacing)) {
      expect(value % 4, `${key}: ${value} should be multiple of 4`).toBe(0);
    }
  });
});

// ── Border Radius ──────────────────────────────────────────────────

describe('shared borderRadius', () => {
  it('has standard scale', () => {
    expect(borderRadius.sm).toBe(4);
    expect(borderRadius.md).toBe(8);
    expect(borderRadius.lg).toBe(12);
    expect(borderRadius.xl).toBe(16);
    expect(borderRadius.pill).toBe(9999);
  });
});

// ── Shadows ────────────────────────────────────────────────────────

describe('shared shadows', () => {
  it('all shadows have x, y, blur, color', () => {
    for (const [key, shadow] of Object.entries(shadows)) {
      expect(typeof shadow.x, `${key}.x`).toBe('number');
      expect(typeof shadow.y, `${key}.y`).toBe('number');
      expect(typeof shadow.blur, `${key}.blur`).toBe('number');
      expect(typeof shadow.color, `${key}.color`).toBe('string');
    }
  });

  it('shadowToCSS produces valid CSS', () => {
    expect(shadowToCSS(shadows.card)).toBe('0px 2px 12px rgba(58, 37, 24, 0.08)');
    expect(shadowToCSS(shadows.modal)).toBe('0px 16px 48px rgba(58, 37, 24, 0.2)');
  });
});

// ── Transitions ────────────────────────────────────────────────────

describe('shared transitions', () => {
  it('has fast, medium, slow durations', () => {
    expect(transitions.fast).toBe(150);
    expect(transitions.medium).toBe(250);
    expect(transitions.slow).toBe(400);
  });

  it('durations increase', () => {
    expect(transitions.fast).toBeLessThan(transitions.medium);
    expect(transitions.medium).toBeLessThan(transitions.slow);
  });
});

// ── Breakpoints ────────────────────────────────────────────────────

describe('shared breakpoints', () => {
  it('has standard device breakpoints in order', () => {
    expect(breakpoints.mobile).toBeLessThan(breakpoints.mobileLarge);
    expect(breakpoints.mobileLarge).toBeLessThan(breakpoints.tablet);
    expect(breakpoints.tablet).toBeLessThan(breakpoints.desktop);
    expect(breakpoints.desktop).toBeLessThan(breakpoints.wide);
    expect(breakpoints.wide).toBeLessThan(breakpoints.ultraWide);
  });
});

// ── Helpers ────────────────────────────────────────────────────────

describe('helpers', () => {
  it('spacingPx converts to CSS string', () => {
    expect(spacingPx('xs')).toBe('4px');
    expect(spacingPx('md')).toBe('16px');
    expect(spacingPx('xxl')).toBe('48px');
  });
});

// ── JSON Sync Verification ─────────────────────────────────────────
// Ensures design-tokens.json stays in sync with sharedTokens.js

describe('design-tokens.json sync', () => {
  it('JSON primary colors match JS module', () => {
    const jsonColors = tokenJSON.colors.primary;
    expect(jsonColors.sandBase.value).toBe(colors.sandBase);
    expect(jsonColors.espresso.value).toBe(colors.espresso);
    expect(jsonColors.mountainBlue.value).toBe(colors.mountainBlue);
    expect(jsonColors.sunsetCoral.value).toBe(colors.sunsetCoral);
  });

  it('JSON variant colors match JS module', () => {
    const jsonVariants = tokenJSON.colors.variants;
    expect(jsonVariants.sandLight.value).toBe(colors.sandLight);
    expect(jsonVariants.sandDark.value).toBe(colors.sandDark);
    expect(jsonVariants.mountainBlueDark.value).toBe(colors.mountainBlueDark);
    expect(jsonVariants.sunsetCoralDark.value).toBe(colors.sunsetCoralDark);
  });

  it('JSON semantic colors match JS module', () => {
    const jsonSemantic = tokenJSON.colors.semantic;
    expect(jsonSemantic.success.value).toBe(colors.success);
    expect(jsonSemantic.error.value).toBe(colors.error);
    expect(jsonSemantic.muted.value).toBe(colors.muted);
  });

  it('JSON spacing values match JS module', () => {
    expect(tokenJSON.spacing.xs).toBe(spacing.xs);
    expect(tokenJSON.spacing.sm).toBe(spacing.sm);
    expect(tokenJSON.spacing.md).toBe(spacing.md);
    expect(tokenJSON.spacing.lg).toBe(spacing.lg);
    expect(tokenJSON.spacing.xl).toBe(spacing.xl);
    expect(tokenJSON.spacing.xxl).toBe(spacing.xxl);
  });

  it('JSON border radius values match JS module', () => {
    expect(tokenJSON.borderRadius.sm).toBe(borderRadius.sm);
    expect(tokenJSON.borderRadius.md).toBe(borderRadius.md);
    expect(tokenJSON.borderRadius.lg).toBe(borderRadius.lg);
    expect(tokenJSON.borderRadius.pill).toBe(borderRadius.pill);
  });

  it('JSON shadow definitions match JS module', () => {
    for (const key of Object.keys(shadows)) {
      expect(tokenJSON.shadows[key].x).toBe(shadows[key].x);
      expect(tokenJSON.shadows[key].y).toBe(shadows[key].y);
      expect(tokenJSON.shadows[key].blur).toBe(shadows[key].blur);
      expect(tokenJSON.shadows[key].color).toBe(shadows[key].color);
    }
  });

  it('JSON breakpoints match JS module', () => {
    expect(tokenJSON.breakpoints.mobile).toBe(breakpoints.mobile);
    expect(tokenJSON.breakpoints.tablet).toBe(breakpoints.tablet);
    expect(tokenJSON.breakpoints.desktop).toBe(breakpoints.desktop);
    expect(tokenJSON.breakpoints.wide).toBe(breakpoints.wide);
  });

  it('JSON font families match JS module', () => {
    expect(tokenJSON.fontFamilies.heading).toBe(fontFamilies.heading);
    expect(tokenJSON.fontFamilies.body).toBe(fontFamilies.body);
  });

  it('JSON brand info matches JS module', () => {
    expect(tokenJSON.brand.name).toBe(brand.name);
    expect(tokenJSON.brand.shortName).toBe(brand.shortName);
    expect(tokenJSON.brand.foundedYear).toBe(brand.foundedYear);
  });
});
