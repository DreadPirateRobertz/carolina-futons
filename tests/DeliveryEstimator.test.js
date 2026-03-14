/**
 * Tests for public/DeliveryEstimator.js
 * Covers: getShippingZone, formatDeliveryEstimate, estimateDelivery.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/ups-shipping.web', () => ({
  getUPSRates: vi.fn(),
  getPackageDimensions: vi.fn(() => ({ length: 48, width: 24, height: 12, weight: 60 })),
}));

vi.mock('public/sharedTokens.js', () => ({
  shippingConfig: {
    freeThreshold: 999999,
    whiteGlove: {
      freeThreshold: 999999,
      localPrice: 149,
      regionalPrice: 249,
    },
    zones: {
      local: { prefixMin: 287, prefixMax: 289, name: 'WNC' },
      regional: { prefixMin: 270, prefixMax: 399, name: 'Southeast' },
    },
  },
  business: {
    phone: '(828) 252-9449',
  },
}));

import { getShippingZone, formatDeliveryEstimate, estimateDelivery } from '../src/public/DeliveryEstimator.js';
import { getUPSRates } from 'backend/ups-shipping.web';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getShippingZone ────────────────────────────────────────────────────

describe('getShippingZone', () => {
  it('returns local for WNC ZIP (287-289 prefix)', () => {
    expect(getShippingZone('28792')).toBe('local');
    expect(getShippingZone('28801')).toBe('local');
    expect(getShippingZone('28906')).toBe('local');
  });

  it('returns regional for Southeast ZIP (270-399 prefix)', () => {
    expect(getShippingZone('27101')).toBe('regional'); // Winston-Salem NC
    expect(getShippingZone('30301')).toBe('regional'); // Atlanta GA
    expect(getShippingZone('37201')).toBe('regional'); // Nashville TN
  });

  it('returns national for non-Southeast ZIP', () => {
    expect(getShippingZone('10001')).toBe('national'); // NYC
    expect(getShippingZone('90210')).toBe('national'); // Beverly Hills
    expect(getShippingZone('60601')).toBe('national'); // Chicago
  });

  it('returns null for empty/missing ZIP', () => {
    expect(getShippingZone('')).toBeNull();
    expect(getShippingZone(null)).toBeNull();
    expect(getShippingZone(undefined)).toBeNull();
  });

  it('returns null for too-short ZIP', () => {
    expect(getShippingZone('287')).toBeNull();
    expect(getShippingZone('28')).toBeNull();
  });

  it('strips non-digit characters', () => {
    expect(getShippingZone('28792-1234')).toBe('local');
    expect(getShippingZone('287 92')).toBe('local');
  });
});

// ── formatDeliveryEstimate ─────────────────────────────────────────────

describe('formatDeliveryEstimate', () => {
  it('formats delivery text with days', () => {
    const result = formatDeliveryEstimate({
      zone: 'local',
      shippingCost: 29.99,
      estimatedDays: '3-5 business days',
      whiteGlove: null,
    });
    expect(result.deliveryText).toBe('Estimated delivery: 3-5 business days');
    expect(result.shippingText).toBe('Shipping: $29.99');
    expect(result.whiteGloveText).toBeNull();
  });

  it('shows FREE shipping when cost is 0', () => {
    const result = formatDeliveryEstimate({
      zone: 'local',
      shippingCost: 0,
      estimatedDays: '3-5 business days',
      whiteGlove: null,
    });
    expect(result.shippingText).toBe('FREE shipping');
  });

  it('includes white-glove text with price and phone', () => {
    const result = formatDeliveryEstimate({
      zone: 'local',
      shippingCost: 29.99,
      estimatedDays: '3-5 business days',
      whiteGlove: { price: 149, label: 'White-glove delivery' },
    });
    expect(result.whiteGloveText).toContain('$149');
    expect(result.whiteGloveText).toContain('(828) 252-9449');
  });
});

// ── estimateDelivery ───────────────────────────────────────────────────

describe('estimateDelivery', () => {
  const smallProduct = { price: 99, weight: 5, collections: [] };
  const largeProduct = { price: 599, weight: 65, collections: ['futon'] };

  it('returns error when product is null', async () => {
    const result = await estimateDelivery('28792', null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Product data');
  });

  it('returns error for invalid ZIP', async () => {
    const result = await estimateDelivery('123', smallProduct);
    expect(result.success).toBe(false);
    expect(result.error).toContain('5-digit');
  });

  it('returns error for empty ZIP', async () => {
    const result = await estimateDelivery('', smallProduct);
    expect(result.success).toBe(false);
  });

  it('uses live UPS rates when available', async () => {
    getUPSRates.mockResolvedValue([
      { cost: 19.99, estimatedDelivery: '2-3 business days', isEstimate: false },
    ]);

    const result = await estimateDelivery('28792', smallProduct);
    expect(result.success).toBe(true);
    expect(result.shippingCost).toBe(19.99);
    expect(result.isEstimate).toBe(false);
    expect(result.allRates).toHaveLength(1);
  });

  it('falls back to static estimate when UPS fails', async () => {
    getUPSRates.mockRejectedValue(new Error('API timeout'));

    const result = await estimateDelivery('28792', smallProduct);
    expect(result.success).toBe(true);
    expect(result.shippingCost).toBe(29.99); // local fallback
    expect(result.isEstimate).toBe(true);
    expect(result.allRates).toEqual([]);
  });

  it('falls back when UPS returns empty rates', async () => {
    getUPSRates.mockResolvedValue([]);

    const result = await estimateDelivery('28792', smallProduct);
    expect(result.success).toBe(true);
    expect(result.isEstimate).toBe(true);
  });

  it('includes white-glove for large items in local zone', async () => {
    getUPSRates.mockRejectedValue(new Error('offline'));

    const result = await estimateDelivery('28792', largeProduct);
    expect(result.whiteGlove).not.toBeNull();
    expect(result.whiteGlove.price).toBe(149);
  });

  it('includes white-glove for large items in regional zone', async () => {
    getUPSRates.mockRejectedValue(new Error('offline'));

    const result = await estimateDelivery('30301', largeProduct);
    expect(result.whiteGlove).not.toBeNull();
    expect(result.whiteGlove.price).toBe(249);
  });

  it('no white-glove for small items', async () => {
    getUPSRates.mockRejectedValue(new Error('offline'));

    const result = await estimateDelivery('28792', smallProduct);
    expect(result.whiteGlove).toBeNull();
  });

  it('no white-glove for national zone even with large items', async () => {
    getUPSRates.mockRejectedValue(new Error('offline'));

    const result = await estimateDelivery('10001', largeProduct);
    expect(result.whiteGlove).toBeNull();
  });

  it('returns correct zone in result', async () => {
    getUPSRates.mockRejectedValue(new Error('offline'));

    const local = await estimateDelivery('28792', smallProduct);
    expect(local.zone).toBe('local');

    const regional = await estimateDelivery('30301', smallProduct);
    expect(regional.zone).toBe('regional');

    const national = await estimateDelivery('10001', smallProduct);
    expect(national.zone).toBe('national');
  });

  it('includes formatted display text', async () => {
    getUPSRates.mockRejectedValue(new Error('offline'));

    const result = await estimateDelivery('28792', smallProduct);
    expect(result.deliveryText).toContain('Estimated delivery');
    expect(result.shippingText).toContain('$');
  });

  it('static fallback costs match zone expectations', async () => {
    getUPSRates.mockRejectedValue(new Error('offline'));

    const local = await estimateDelivery('28792', smallProduct);
    expect(local.shippingCost).toBe(29.99);

    const regional = await estimateDelivery('30301', smallProduct);
    expect(regional.shippingCost).toBe(39.99);

    const national = await estimateDelivery('10001', smallProduct);
    expect(national.shippingCost).toBe(49.99);
  });
});
