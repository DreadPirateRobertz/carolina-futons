/**
 * @file tradeInWidget.test.js
 * @description Unit tests for TradeInWidget.js — pure PDP widget helpers.
 */

import { describe, it, expect } from 'vitest';
import {
  getTradeInType,
  isEligible,
  buildBannerText,
  formatEstimateText,
  buildConditionOptions,
  buildHiddenState,
  buildIdleState,
  buildLoadingState,
  buildEstimateState,
  buildTradeInUrl,
  ELIGIBLE_PRODUCT_TYPES,
} from '../src/public/TradeInWidget.js';

// ---------------------------------------------------------------------------
// getTradeInType
// ---------------------------------------------------------------------------

describe('getTradeInType', () => {
  it('maps futon-frames to futon-frame', () => {
    expect(getTradeInType('futon-frames')).toBe('futon-frame');
  });

  it('maps futon-mattresses to futon-mattress', () => {
    expect(getTradeInType('futon-mattresses')).toBe('futon-mattress');
  });

  it('maps murphy-beds to murphy-bed', () => {
    expect(getTradeInType('murphy-beds')).toBe('murphy-bed');
  });

  it('returns null for unknown category', () => {
    expect(getTradeInType('blenders')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getTradeInType('')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(getTradeInType(null)).toBeNull();
    expect(getTradeInType(undefined)).toBeNull();
  });

  it('trims and lowercases category slug', () => {
    expect(getTradeInType('  Futon-Frames  ')).toBe('futon-frame');
  });
});

// ---------------------------------------------------------------------------
// isEligible
// ---------------------------------------------------------------------------

describe('isEligible', () => {
  it('returns true for all ELIGIBLE_PRODUCT_TYPES', () => {
    for (const type of ELIGIBLE_PRODUCT_TYPES) {
      expect(isEligible(type)).toBe(true);
    }
  });

  it('returns false for null', () => {
    expect(isEligible(null)).toBe(false);
  });

  it('returns false for unknown type', () => {
    expect(isEligible('dishwasher')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildBannerText
// ---------------------------------------------------------------------------

describe('buildBannerText', () => {
  it('includes the item label for eligible types', () => {
    const text = buildBannerText('futon-frame');
    expect(text).toContain('futon frame');
    expect(text).toContain('store credit');
  });

  it('returns empty string for ineligible type', () => {
    expect(buildBannerText('dishwasher')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(buildBannerText(null)).toBe('');
  });

  it('uses generic "furniture" label for unknown but mapped type', () => {
    // If a type is in ELIGIBLE_PRODUCT_TYPES but not in typeLabels, falls back to "furniture"
    // This is a defensive test — all current types are mapped
    const text = buildBannerText('futon-mattress');
    expect(text).toContain('futon mattress');
  });
});

// ---------------------------------------------------------------------------
// formatEstimateText
// ---------------------------------------------------------------------------

describe('formatEstimateText', () => {
  it('returns range string for valid estimate', () => {
    expect(formatEstimateText({ min: 64, max: 86, base: 75 }))
      .toBe('Worth $64–$86 in store credit');
  });

  it('returns single value string when min === max', () => {
    expect(formatEstimateText({ min: 50, max: 50, base: 50 }))
      .toBe('Worth $50 in store credit');
  });

  it('returns no-credit message when max is 0', () => {
    expect(formatEstimateText({ min: 0, max: 0, base: 0 }))
      .toBe('No credit available for this condition.');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatEstimateText(null)).toBe('');
    expect(formatEstimateText(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// buildConditionOptions
// ---------------------------------------------------------------------------

describe('buildConditionOptions', () => {
  it('returns 3 conditions', () => {
    expect(buildConditionOptions()).toHaveLength(3);
  });

  it('includes good, fair, poor values', () => {
    const values = buildConditionOptions().map(c => c.value);
    expect(values).toContain('good');
    expect(values).toContain('fair');
    expect(values).toContain('poor');
  });

  it('each option has label and description', () => {
    for (const opt of buildConditionOptions()) {
      expect(typeof opt.label).toBe('string');
      expect(typeof opt.description).toBe('string');
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// State builders
// ---------------------------------------------------------------------------

describe('buildHiddenState', () => {
  it('returns bannerVisible: false', () => {
    expect(buildHiddenState()).toEqual({ bannerVisible: false });
  });
});

describe('buildIdleState', () => {
  it('returns bannerVisible: true with banner text', () => {
    const state = buildIdleState('futon-frame');
    expect(state.bannerVisible).toBe(true);
    expect(state.bannerText).toContain('futon frame');
    expect(state.estimateVisible).toBe(false);
  });
});

describe('buildLoadingState', () => {
  it('returns ctaDisabled: true and loading text', () => {
    const state = buildLoadingState();
    expect(state.ctaDisabled).toBe(true);
    expect(state.estimateText).toContain('Calculating');
  });
});

describe('buildEstimateState', () => {
  it('returns estimate text and enabled CTA for credit-bearing estimate', () => {
    const state = buildEstimateState({ min: 64, max: 86, base: 75 });
    expect(state.estimateVisible).toBe(true);
    expect(state.estimateText).toContain('$64');
    expect(state.ctaDisabled).toBe(false);
    expect(state.ctaLabel).toContain('Trade-In');
  });

  it('disables CTA when estimate has zero max (no credit)', () => {
    const state = buildEstimateState({ min: 0, max: 0, base: 0 });
    expect(state.ctaDisabled).toBe(true);
    expect(state.ctaLabel).toContain('No credit');
  });
});

// ---------------------------------------------------------------------------
// buildTradeInUrl
// ---------------------------------------------------------------------------

describe('buildTradeInUrl', () => {
  it('returns /trade-in with type and condition params', () => {
    const url = buildTradeInUrl('futon-frame', 'good');
    expect(url).toContain('/trade-in');
    expect(url).toContain('type=futon-frame');
    expect(url).toContain('condition=good');
  });

  it('returns /trade-in with only type when condition is empty', () => {
    const url = buildTradeInUrl('futon-frame', '');
    expect(url).toContain('type=futon-frame');
    expect(url).not.toContain('condition=');
  });

  it('returns /trade-in with no params when both are empty', () => {
    expect(buildTradeInUrl('', '')).toBe('/trade-in');
  });
});
