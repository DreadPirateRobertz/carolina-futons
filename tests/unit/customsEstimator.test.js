import { describe, it, expect, beforeEach } from 'vitest';
import { __setHandler } from '../__mocks__/wix-fetch.js';
import { __setSecrets } from '../__mocks__/wix-secrets-backend.js';
import {
  estimateCustomsDuties,
  getVATRate,
  getDutyRate,
  calculateLandedCost,
} from '../../src/backend/customsEstimator.web.js';

beforeEach(() => {
  __setSecrets({
    EXCHANGE_RATE_API_KEY: 'test-api-key',
  });

  __setHandler((url) => {
    if (url.includes('openexchangerates.org') || url.includes('api.exchangerate')) {
      return {
        ok: true,
        async json() {
          return { base: 'USD', rates: { USD: 1, CAD: 1.36, GBP: 0.79, EUR: 0.92, AUD: 1.54, JPY: 149.50 } };
        },
        async text() { return ''; },
      };
    }
    return { ok: true, async json() { return {}; }, async text() { return ''; } };
  });
});

describe('getVATRate', () => {
  it('returns correct VAT rate for UK', async () => {
    const result = await getVATRate('GB');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.20);
  });

  it('returns correct VAT rate for Germany', async () => {
    const result = await getVATRate('DE');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.19);
  });

  it('returns correct GST for Australia', async () => {
    const result = await getVATRate('AU');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.10);
  });

  it('returns 0 for countries without VAT/GST data', async () => {
    const result = await getVATRate('BR');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0);
  });

  it('returns error for empty input', async () => {
    const result = await getVATRate('');
    expect(result.success).toBe(false);
  });

  it('returns error for null', async () => {
    const result = await getVATRate(null);
    expect(result.success).toBe(false);
  });

  it('handles lowercase country codes', async () => {
    const result = await getVATRate('gb');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.20);
  });
});

describe('getDutyRate', () => {
  it('returns 0 duty for Canada (USMCA)', async () => {
    const result = await getDutyRate('CA');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0);
    expect(result.description).toMatch(/USMCA/i);
  });

  it('returns duty rate for UK', async () => {
    const result = await getDutyRate('GB');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.02);
  });

  it('returns duty rate for Australia', async () => {
    const result = await getDutyRate('AU');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.05);
  });

  it('returns default rate for unknown countries', async () => {
    const result = await getDutyRate('BR');
    expect(result.success).toBe(true);
    expect(result.rate).toBeGreaterThanOrEqual(0);
  });

  it('handles invalid input', async () => {
    const result = await getDutyRate('!!!');
    expect(result.success).toBe(false);
  });
});

describe('estimateCustomsDuties', () => {
  it('estimates duties for UK shipment', async () => {
    const result = await estimateCustomsDuties('GB', 999.99, 85);
    expect(result.success).toBe(true);
    expect(result.estimate).toBeDefined();
    expect(result.estimate.dutyAmount).toBeGreaterThanOrEqual(0);
    expect(result.estimate.vatAmount).toBeGreaterThan(0);
    expect(result.estimate.totalDutiesAndTaxes).toBeGreaterThan(0);
    expect(result.estimate.currency).toBe('USD');
  });

  it('estimates zero duty for Canada (USMCA)', async () => {
    const result = await estimateCustomsDuties('CA', 999.99, 85);
    expect(result.success).toBe(true);
    expect(result.estimate.dutyAmount).toBe(0);
    // Canada still has GST
    expect(result.estimate.vatAmount).toBeGreaterThan(0);
  });

  it('applies de minimis exemption when applicable', async () => {
    // AU has $1000 AUD de minimis — $100 USD should be below it
    const result = await estimateCustomsDuties('AU', 50, 5);
    expect(result.success).toBe(true);
    expect(result.estimate.deMinimisApplied).toBe(true);
    expect(result.estimate.dutyAmount).toBe(0);
  });

  it('calculates duties above de minimis threshold', async () => {
    const result = await estimateCustomsDuties('AU', 2000, 85);
    expect(result.success).toBe(true);
    expect(result.estimate.dutyAmount).toBeGreaterThan(0);
    expect(result.estimate.deMinimisApplied).toBe(false);
  });

  it('returns error for US (no customs for domestic)', async () => {
    const result = await estimateCustomsDuties('US', 999.99, 85);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/domestic/i);
  });

  it('handles zero value', async () => {
    const result = await estimateCustomsDuties('GB', 0, 50);
    expect(result.success).toBe(true);
    expect(result.estimate.totalDutiesAndTaxes).toBe(0);
  });

  it('clamps negative value to zero', async () => {
    const result = await estimateCustomsDuties('GB', -100, 50);
    expect(result.success).toBe(true);
    expect(result.estimate.totalDutiesAndTaxes).toBe(0);
  });

  it('handles null inputs', async () => {
    const result = await estimateCustomsDuties(null, null, null);
    expect(result.success).toBe(false);
  });

  it('sanitizes country code', async () => {
    const result = await estimateCustomsDuties('<script>', 100, 50);
    expect(result.success).toBe(false);
  });
});

describe('calculateLandedCost', () => {
  it('calculates total landed cost for UK order', async () => {
    const result = await calculateLandedCost('GB', 999.99, 149.99, 85);
    expect(result.success).toBe(true);
    expect(result.landedCost).toBeDefined();
    expect(result.landedCost.productCost).toBe(999.99);
    expect(result.landedCost.shippingCost).toBe(149.99);
    expect(result.landedCost.dutyAmount).toBeGreaterThanOrEqual(0);
    expect(result.landedCost.vatAmount).toBeGreaterThan(0);
    expect(result.landedCost.totalLandedCost).toBeGreaterThan(999.99 + 149.99);
  });

  it('includes shipping in VAT calculation', async () => {
    // UK VAT is charged on (product + shipping + duty)
    const result = await calculateLandedCost('GB', 1000, 150, 85);
    expect(result.success).toBe(true);
    // VAT should be ~20% of (product + shipping + duty)
    const expectedVatBase = 1000 + 150 + result.landedCost.dutyAmount;
    expect(result.landedCost.vatAmount).toBeCloseTo(expectedVatBase * 0.20, 0);
  });

  it('handles free shipping in landed cost', async () => {
    const result = await calculateLandedCost('CA', 3500, 0, 85);
    expect(result.success).toBe(true);
    expect(result.landedCost.shippingCost).toBe(0);
    expect(result.landedCost.totalLandedCost).toBeGreaterThan(3500);
  });

  it('returns error for domestic US', async () => {
    const result = await calculateLandedCost('US', 999.99, 49.99, 50);
    expect(result.success).toBe(false);
  });

  it('clamps negative values', async () => {
    const result = await calculateLandedCost('GB', -500, -100, -50);
    expect(result.success).toBe(true);
    expect(result.landedCost.productCost).toBe(0);
    expect(result.landedCost.shippingCost).toBe(0);
  });
});
