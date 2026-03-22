/**
 * deliveryEstimatorWebMethod.test.js
 *
 * Unit tests for src/backend/deliveryEstimator.web.js — the webMethod
 * getDeliveryEstimate(zip, productIds) consumed by both the web PDP and
 * cfutons_mobile.
 *
 * Covers:
 *  - Zip validation (missing, non-numeric, wrong length)
 *  - productIds cap (>10 silently capped to 10)
 *  - Happy path: UPS returns Ground rate → structured response
 *  - Multiple products: dims summed correctly
 *  - Circuit breaker / UPS down: returns fallback response
 *  - UPS returns empty rates: returns fallback
 *  - Date calculation: minDate/maxDate are future ISO dates
 *  - source field: 'ups' when live, 'fallback' when degraded
 *  - service field: populated from UPS rate, null on fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGetUPSRates, mockGetPackageDimensions } = vi.hoisted(() => ({
  mockGetUPSRates: vi.fn(),
  mockGetPackageDimensions: vi.fn(() => ({ length: 80, width: 40, height: 12, weight: 85 })),
}));
vi.mock('backend/ups-shipping.web', () => ({
  getUPSRates: mockGetUPSRates,
  getPackageDimensions: mockGetPackageDimensions,
}));

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

// ── Import SUT ─────────────────────────────────────────────────────────────────

import { getDeliveryEstimate } from '../src/backend/deliveryEstimator.web.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const UPS_GROUND_RATE = {
  code: '03',
  title: 'UPS Ground',
  cost: 39.99,
  estimatedDelivery: '5-7 business days',
  currency: 'USD',
};

function makeUPSRates(rates = [UPS_GROUND_RATE]) {
  mockGetUPSRates.mockResolvedValueOnce(rates);
}

// ── Zip validation ────────────────────────────────────────────────────────────

describe('getDeliveryEstimate — zip validation', () => {
  it('returns { success: false } when zip is missing', async () => {
    const result = await getDeliveryEstimate(null, ['p1']);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/zip/i);
  });

  it('returns { success: false } when zip is 4 digits', async () => {
    const result = await getDeliveryEstimate('1234', ['p1']);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/zip/i);
  });

  it('returns { success: false } when zip is 6 digits', async () => {
    const result = await getDeliveryEstimate('123456', ['p1']);
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when zip contains letters', async () => {
    const result = await getDeliveryEstimate('2870X', ['p1']);
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when zip is empty string', async () => {
    const result = await getDeliveryEstimate('', ['p1']);
    expect(result.success).toBe(false);
  });
});

// ── productIds validation ─────────────────────────────────────────────────────

describe('getDeliveryEstimate — productIds', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPackageDimensions.mockReturnValue({ length: 80, width: 40, height: 12, weight: 85 });
    makeUPSRates();
  });

  it('accepts empty productIds array (uses default dims)', async () => {
    const result = await getDeliveryEstimate('28792', []);
    expect(result.success).toBe(true);
    expect(mockGetPackageDimensions).toHaveBeenCalledWith('default');
  });

  it('accepts null productIds (uses default dims)', async () => {
    makeUPSRates();
    const result = await getDeliveryEstimate('28792', null);
    expect(result.success).toBe(true);
  });

  it('caps productIds at 10 to prevent API amplification', async () => {
    makeUPSRates();
    const ids = Array.from({ length: 15 }, (_, i) => `p${i}`);
    await getDeliveryEstimate('28792', ids);
    // getPackageDimensions called at most 10 times (one per product)
    expect(mockGetPackageDimensions.mock.calls.length).toBeLessThanOrEqual(10);
  });
});

// ── Happy path — UPS live response ───────────────────────────────────────────

describe('getDeliveryEstimate — UPS live response', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPackageDimensions.mockReturnValue({ length: 80, width: 40, height: 12, weight: 85 });
  });

  it('returns success:true with estimate from UPS Ground rate', async () => {
    makeUPSRates();
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.success).toBe(true);
    expect(result.estimate).toBe('5-7 business days');
  });

  it('sets source:"ups" on live response', async () => {
    makeUPSRates();
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.source).toBe('ups');
  });

  it('sets service to UPS service name', async () => {
    makeUPSRates();
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.service).toBe('UPS Ground');
  });

  it('includes minDays and maxDays parsed from estimatedDelivery string', async () => {
    makeUPSRates();
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.minDays).toBe(5);
    expect(result.maxDays).toBe(7);
  });

  it('parses single-day format "1 business day" → minDays=maxDays=1', async () => {
    mockGetUPSRates.mockResolvedValueOnce([{ ...UPS_GROUND_RATE, estimatedDelivery: '1 business day' }]);
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.minDays).toBe(1);
    expect(result.maxDays).toBe(1);
    expect(result.estimate).toBe('1 business day');
  });

  it('includes minDate and maxDate as ISO date strings', async () => {
    makeUPSRates();
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.minDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.maxDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(result.maxDate) >= new Date(result.minDate)).toBe(true);
  });

  it('minDate is in the future', async () => {
    makeUPSRates();
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(new Date(result.minDate) > new Date()).toBe(true);
  });

  it('calls getUPSRates with postalCode and packages', async () => {
    makeUPSRates();
    await getDeliveryEstimate('28701', ['p1']);
    const [dest, packages] = mockGetUPSRates.mock.calls[0];
    expect(dest.postalCode).toBe('28701');
    expect(Array.isArray(packages)).toBe(true);
    expect(packages.length).toBe(1);
  });

  it('builds one package per productId', async () => {
    makeUPSRates();
    await getDeliveryEstimate('28701', ['p1', 'p2', 'p3']);
    const [, packages] = mockGetUPSRates.mock.calls[0];
    expect(packages.length).toBe(3);
  });

  it('picks the first (cheapest/ground) rate from UPS response', async () => {
    mockGetUPSRates.mockResolvedValueOnce([
      { ...UPS_GROUND_RATE, estimatedDelivery: '5-7 business days', title: 'UPS Ground' },
      { code: '01', title: 'UPS Next Day Air', cost: 89.99, estimatedDelivery: '1 business day', currency: 'USD' },
    ]);
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.estimate).toBe('5-7 business days');
    expect(result.service).toBe('UPS Ground');
  });
});

// ── Circuit breaker / fallback ────────────────────────────────────────────────

describe('getDeliveryEstimate — circuit breaker / fallback', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetPackageDimensions.mockReturnValue({ length: 80, width: 40, height: 12, weight: 85 });
  });

  it('returns fallback when UPS throws', async () => {
    mockGetUPSRates.mockRejectedValueOnce(new Error('Network timeout'));
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.success).toBe(true);
    expect(result.source).toBe('fallback');
    expect(result.estimate).toBe('2-5 business days');
  });

  it('returns fallback when UPS returns empty array', async () => {
    mockGetUPSRates.mockResolvedValueOnce([]);
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.success).toBe(true);
    expect(result.source).toBe('fallback');
  });

  it('sets service:null on fallback', async () => {
    mockGetUPSRates.mockRejectedValueOnce(new Error('UPS down'));
    const result = await getDeliveryEstimate('28792', ['p1']);
    expect(result.service).toBeNull();
  });

  it('fallback estimate is always "2-5 business days"', async () => {
    mockGetUPSRates.mockRejectedValueOnce(new Error('UPS down'));
    const result = await getDeliveryEstimate('10001', ['p1']); // NY zip
    expect(result.estimate).toBe('2-5 business days');
  });

  it('does not throw — always returns a response', async () => {
    mockGetUPSRates.mockRejectedValueOnce(new Error('catastrophic failure'));
    await expect(getDeliveryEstimate('28792', ['p1'])).resolves.toBeDefined();
  });
});

// ── Dimension lookup ──────────────────────────────────────────────────────────

describe('getDeliveryEstimate — dimension lookup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Advance fake time past any open circuit breaker (60s timeout) so this
    // group isn't affected by circuit state left open by the fallback group.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    mockGetPackageDimensions.mockReturnValue({ length: 80, width: 40, height: 12, weight: 85 });
    makeUPSRates();
  });

  afterEach(() => vi.useRealTimers());

  it('uses "default" category when CMS profile not found', async () => {
    await getDeliveryEstimate('28792', ['unknown-product']);
    expect(mockGetPackageDimensions).toHaveBeenCalledWith('default');
  });

  it('uses "default" category for each product when no CMS profile', async () => {
    makeUPSRates();
    await getDeliveryEstimate('28792', ['p1', 'p2']);
    expect(mockGetPackageDimensions).toHaveBeenCalledTimes(2);
  });
});
