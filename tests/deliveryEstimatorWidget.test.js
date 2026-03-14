import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';

// Mock backend modules
vi.mock('backend/ups-shipping.web', () => ({
  getUPSRates: vi.fn(),
  getPackageDimensions: vi.fn(() => ({ length: 80, width: 40, height: 12, weight: 85 })),
}));

vi.mock('public/sharedTokens.js', () => ({
  shippingConfig: {
    freeThreshold: 999999,
    whiteGlove: { freeThreshold: 999999, localPrice: 149, regionalPrice: 249 },
    zones: {
      local: { prefixMin: 287, prefixMax: 289, name: 'WNC' },
      regional: { prefixMin: 270, prefixMax: 399, name: 'Southeast' },
    },
  },
  business: { phone: '(828) 252-9449' },
  colors: {
    success: '#4A7C59', error: '#C0392B', espresso: '#3A2518',
    sunsetCoral: '#E8845C', mountainBlue: '#5B8FA8',
  },
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    success: '#4A7C59', error: '#C0392B', espresso: '#3A2518',
    sunsetCoral: '#E8845C', mountainBlue: '#5B8FA8',
  },
}));

import { getUPSRates } from 'backend/ups-shipping.web';
import { estimateDelivery, getShippingZone, formatDeliveryEstimate } from '../src/public/DeliveryEstimator.js';

// ── Unit: getShippingZone ─────────────────────────────────────────────

describe('getShippingZone', () => {
  it('returns local for WNC zip codes (287-289)', () => {
    expect(getShippingZone('28792')).toBe('local');
    expect(getShippingZone('28701')).toBe('local');
    expect(getShippingZone('28906')).toBe('local');  // 289xx
  });

  it('returns regional for Southeast zip codes (270-399)', () => {
    expect(getShippingZone('27601')).toBe('regional'); // Raleigh
    expect(getShippingZone('30301')).toBe('regional'); // Atlanta
    expect(getShippingZone('37201')).toBe('regional'); // Nashville
  });

  it('returns national for other zip codes', () => {
    expect(getShippingZone('10001')).toBe('national'); // NYC
    expect(getShippingZone('90210')).toBe('national'); // LA
    expect(getShippingZone('60601')).toBe('national'); // Chicago
  });

  it('returns null for invalid zip codes', () => {
    expect(getShippingZone('')).toBeNull();
    expect(getShippingZone('123')).toBeNull();
    expect(getShippingZone('abcde')).toBeNull();
    expect(getShippingZone(null)).toBeNull();
    expect(getShippingZone(undefined)).toBeNull();
  });

  it('strips non-numeric characters from zip', () => {
    expect(getShippingZone('287-92')).toBe('local');
    expect(getShippingZone('28792-1234')).toBe('local'); // ZIP+4
  });
});

// ── Unit: formatDeliveryEstimate ──────────────────────────────────────

describe('formatDeliveryEstimate', () => {
  it('formats standard delivery with date range', () => {
    const result = formatDeliveryEstimate({
      zone: 'national',
      shippingCost: 49.99,
      estimatedDays: '5-7 business days',
      whiteGlove: null,
    });
    expect(result.deliveryText).toContain('5-7 business days');
    expect(result.shippingText).toContain('$49.99');
  });

  it('includes white-glove pricing for local zone', () => {
    const result = formatDeliveryEstimate({
      zone: 'local',
      shippingCost: 29.99,
      estimatedDays: '3-5 business days',
      whiteGlove: { price: 149, label: 'White-glove delivery' },
    });
    expect(result.whiteGloveText).toContain('$149');
  });

  it('includes white-glove pricing for regional zone', () => {
    const result = formatDeliveryEstimate({
      zone: 'regional',
      shippingCost: 39.99,
      estimatedDays: '5-8 business days',
      whiteGlove: { price: 249, label: 'White-glove delivery' },
    });
    expect(result.whiteGloveText).toContain('$249');
  });

  it('shows free shipping when cost is 0', () => {
    const result = formatDeliveryEstimate({
      zone: 'local',
      shippingCost: 0,
      estimatedDays: '5-7 business days',
      whiteGlove: null,
    });
    expect(result.shippingText).toMatch(/free/i);
  });

  it('returns null whiteGloveText for national zone', () => {
    const result = formatDeliveryEstimate({
      zone: 'national',
      shippingCost: 59.99,
      estimatedDays: '7-12 business days',
      whiteGlove: null,
    });
    expect(result.whiteGloveText).toBeNull();
  });
});

// ── Integration: estimateDelivery ────────────────────────────────────

describe('estimateDelivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls getUPSRates with correct address and returns formatted result', async () => {
    getUPSRates.mockResolvedValue([
      { code: 'ups-03', title: 'UPS Ground', cost: 39.99, estimatedDelivery: '5-7 business days' },
    ]);

    const result = await estimateDelivery('27601', futonFrame);
    expect(getUPSRates).toHaveBeenCalledWith(
      expect.objectContaining({ postalCode: '27601' }),
      expect.any(Array),
      expect.any(Number),
    );
    expect(result.success).toBe(true);
    expect(result.zone).toBe('regional');
    expect(result.shippingCost).toBe(39.99);
  });

  it('returns white-glove info for large items in local zone', async () => {
    getUPSRates.mockResolvedValue([
      { code: 'ups-03', title: 'UPS Ground', cost: 29.99, estimatedDelivery: '3-5 business days' },
    ]);

    const largeProduct = { ...futonFrame, weight: 100, collections: ['futon-frames'] };
    const result = await estimateDelivery('28792', largeProduct);
    expect(result.success).toBe(true);
    expect(result.zone).toBe('local');
    expect(result.whiteGlove).toBeTruthy();
    expect(result.whiteGlove.price).toBe(149);
  });

  it('returns white-glove info for large items in regional zone', async () => {
    getUPSRates.mockResolvedValue([
      { code: 'ups-03', title: 'UPS Ground', cost: 39.99, estimatedDelivery: '5-8 business days' },
    ]);

    const largeProduct = { ...futonFrame, weight: 80, collections: ['murphy-cabinet-beds'] };
    const result = await estimateDelivery('30301', largeProduct);
    expect(result.success).toBe(true);
    expect(result.whiteGlove.price).toBe(249);
  });

  it('returns free white-glove for orders over $1,999', async () => {
    getUPSRates.mockResolvedValue([
      { code: 'free-ground', title: 'FREE UPS Ground', cost: 0, estimatedDelivery: '5-7 business days' },
    ]);

    const expensiveProduct = { ...futonFrame, price: 2499, formattedPrice: '$2,499.00', weight: 150 };
    const result = await estimateDelivery('28792', expensiveProduct);
    expect(result.success).toBe(true);
    expect(result.shippingCost).toBe(0);
  });

  it('no white-glove for small/light items', async () => {
    getUPSRates.mockResolvedValue([
      { code: 'ups-03', title: 'UPS Ground', cost: 19.99, estimatedDelivery: '3-5 business days' },
    ]);

    const smallProduct = { ...futonFrame, weight: 10, collections: ['accessories'] };
    const result = await estimateDelivery('28792', smallProduct);
    expect(result.whiteGlove).toBeNull();
  });

  it('falls back to static estimate when UPS API fails', async () => {
    getUPSRates.mockRejectedValue(new Error('UPS API down'));

    const result = await estimateDelivery('10001', futonFrame);
    expect(result.success).toBe(true);
    expect(result.isEstimate).toBe(true);
    expect(result.shippingCost).toBeGreaterThan(0);
  });

  it('falls back to static estimate when UPS returns empty array', async () => {
    getUPSRates.mockResolvedValue([]);

    const result = await estimateDelivery('60601', futonFrame);
    expect(result.success).toBe(true);
    expect(result.isEstimate).toBe(true);
  });

  it('returns error for invalid zip code', async () => {
    const result = await estimateDelivery('abc', futonFrame);
    expect(result.success).toBe(false);
    expect(result.error).toContain('zip');
  });

  it('returns error for empty zip code', async () => {
    const result = await estimateDelivery('', futonFrame);
    expect(result.success).toBe(false);
  });

  it('returns error for null product', async () => {
    const result = await estimateDelivery('28792', null);
    expect(result.success).toBe(false);
  });

  it('sanitizes zip code input (strips non-digits)', async () => {
    getUPSRates.mockResolvedValue([
      { code: 'ups-03', title: 'UPS Ground', cost: 29.99, estimatedDelivery: '3-5 business days' },
    ]);

    const result = await estimateDelivery('287-92', futonFrame);
    expect(result.success).toBe(true);
    expect(getUPSRates).toHaveBeenCalledWith(
      expect.objectContaining({ postalCode: '28792' }),
      expect.any(Array),
      expect.any(Number),
    );
  });

  it('handles XSS in zip code input', async () => {
    const result = await estimateDelivery('<script>alert(1)</script>', futonFrame);
    expect(result.success).toBe(false);
  });

  it('uses cheapest rate from multiple UPS options', async () => {
    getUPSRates.mockResolvedValue([
      { code: 'ups-03', title: 'UPS Ground', cost: 39.99, estimatedDelivery: '5-7 business days' },
      { code: 'ups-02', title: 'UPS 2nd Day', cost: 79.99, estimatedDelivery: '2 business days' },
    ]);

    const result = await estimateDelivery('27601', futonFrame);
    expect(result.shippingCost).toBe(39.99); // cheapest
    expect(result.allRates).toHaveLength(2);
  });
});
