/**
 * @file deliveryOptions.test.js
 * @description Tests for delivery options data service (cf-7pwa).
 */

import { describe, it, expect } from 'vitest';
import {
  getDeliveryOptions,
  isWhiteGloveCategory,
  getPdpDeliveryBadge,
  _COVERAGE_ZONES,
  _WHITE_GLOVE_CATEGORIES,
  _getStateFromZip,
} from '../src/backend/deliveryOptions.web.js';

// ── Zone Lookup ─────────────────────────────────────────────────────

describe('getStateFromZip', () => {
  it('identifies NC zip codes', () => {
    expect(_getStateFromZip('28792')).toBe('NC'); // Hendersonville
    expect(_getStateFromZip('27601')).toBe('NC'); // Raleigh
  });

  it('identifies SC zip codes', () => {
    expect(_getStateFromZip('29201')).toBe('SC'); // Columbia
  });

  it('identifies TN zip codes', () => {
    expect(_getStateFromZip('37201')).toBe('TN'); // Nashville
  });

  it('identifies VA zip codes', () => {
    expect(_getStateFromZip('22201')).toBe('VA'); // Arlington
  });

  it('identifies GA zip codes', () => {
    expect(_getStateFromZip('30301')).toBe('GA'); // Atlanta
  });

  it('returns OTHER for unknown', () => {
    expect(_getStateFromZip('10001')).toBe('OTHER'); // NYC
    expect(_getStateFromZip('90210')).toBe('OTHER'); // LA
  });
});

// ── getDeliveryOptions ──────────────────────────────────────────────

describe('getDeliveryOptions', () => {
  it('returns local options for NC zip', () => {
    const result = getDeliveryOptions('28792', 'futon-frames');
    expect(result.success).toBe(true);
    expect(result.whiteGloveAvailable).toBe(true);
    expect(result.options.length).toBeGreaterThanOrEqual(2);

    const wg = result.options.find(o => o.code === 'white-glove');
    expect(wg).toBeDefined();
    expect(wg.price).toBe(149);
  });

  it('returns options with white glove for SE state zip', () => {
    // TN may match local or regional depending on shippingZones config
    const result = getDeliveryOptions('37201', 'futon-frames');
    expect(result.success).toBe(true);
    expect(result.whiteGloveAvailable).toBe(true);
    expect(result.options.find(o => o.code === 'white-glove')).toBeDefined();
  });

  it('returns national options for distant zip (no white glove)', () => {
    const result = getDeliveryOptions('90210', 'futon-frames');
    expect(result.success).toBe(true);
    expect(result.zone.type).toBe('national');
    expect(result.whiteGloveAvailable).toBe(false);
    expect(result.options.find(o => o.code === 'white-glove')).toBeUndefined();
  });

  it('disables white glove for non-eligible categories', () => {
    const result = getDeliveryOptions('28792', 'pillows-702');
    expect(result.whiteGloveAvailable).toBe(false);
  });

  it('marks free shipping when cart exceeds threshold', () => {
    const result = getDeliveryOptions('28792', 'futon-frames', 2000);
    const standard = result.options.find(o => o.code === 'standard');
    expect(standard.isFree).toBe(true);
    expect(standard.price).toBe(0);
    expect(result.qualifiesFreeShipping).toBe(true);
  });

  it('shows paid shipping below threshold', () => {
    const result = getDeliveryOptions('28792', 'futon-frames', 500);
    const standard = result.options.find(o => o.code === 'standard');
    expect(standard.isFree).toBe(false);
    expect(standard.price).toBeGreaterThan(0);
  });

  it('rejects invalid zip code', () => {
    expect(getDeliveryOptions('123', 'futon-frames').success).toBe(false);
    expect(getDeliveryOptions('', 'futon-frames').success).toBe(false);
  });

  it('includes freight for national zone', () => {
    const result = getDeliveryOptions('10001', 'futon-frames');
    const freight = result.options.find(o => o.code === 'freight');
    expect(freight).toBeDefined();
  });

  it('returns local zone for VA zip with prefix 240 (Blacksburg area)', () => {
    // 24060 = Blacksburg VA — prefix 240 was added to localZones VA prefixes in sharedTokens
    const result = getDeliveryOptions('24060', 'futon-frames');
    expect(result.success).toBe(true);
    expect(result.zone.type).toBe('local');
  });
});

// ── isWhiteGloveCategory ────────────────────────────────────────────

describe('isWhiteGloveCategory', () => {
  it('returns true for frame categories', () => {
    expect(isWhiteGloveCategory('futon-frames').available).toBe(true);
    expect(isWhiteGloveCategory('murphy-cabinet-beds').available).toBe(true);
    expect(isWhiteGloveCategory('platform-beds').available).toBe(true);
  });

  it('returns false for small items', () => {
    expect(isWhiteGloveCategory('pillows-702').available).toBe(false);
    expect(isWhiteGloveCategory('covers').available).toBe(false);
  });

  it('returns full category list', () => {
    const result = isWhiteGloveCategory('futon-frames');
    expect(result.categories).toHaveLength(5);
  });
});

// ── getPdpDeliveryBadge ─────────────────────────────────────────────

describe('getPdpDeliveryBadge', () => {
  it('shows white glove badge for eligible products in local zone', () => {
    const result = getPdpDeliveryBadge('28792', 'futon-frames');
    expect(result.whiteGlove).toBe(true);
    expect(result.badge).toContain('White Glove');
    expect(result.subtext).toContain('$149');
  });

  it('shows standard badge for non-eligible categories', () => {
    const result = getPdpDeliveryBadge('28792', 'covers');
    expect(result.whiteGlove).toBe(false);
    expect(result.badge).toContain('Shipping');
  });

  it('returns empty for invalid zip', () => {
    const result = getPdpDeliveryBadge('', 'futon-frames');
    expect(result.badge).toBe('');
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('delivery constants', () => {
  it('local zone covers NC and SC', () => {
    expect(_COVERAGE_ZONES.local.states).toEqual(['NC', 'SC']);
  });

  it('local white glove is $149', () => {
    expect(_COVERAGE_ZONES.local.whiteGlovePrice).toBe(149);
  });

  it('regional white glove is $249', () => {
    expect(_COVERAGE_ZONES.regional.whiteGlovePrice).toBe(249);
  });

  it('national has no white glove', () => {
    expect(_COVERAGE_ZONES.national.whiteGloveAvailable).toBe(false);
  });

  it('5 categories support white glove', () => {
    expect(_WHITE_GLOVE_CATEGORIES).toHaveLength(5);
  });
});
