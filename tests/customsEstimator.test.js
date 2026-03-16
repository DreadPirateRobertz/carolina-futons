import { describe, it, expect, beforeEach } from 'vitest';
import { __setHandler } from './__mocks__/wix-fetch.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import {
  estimateCustomsDuties,
  getVATRate,
  getDutyRate,
  calculateLandedCost,
} from '../src/backend/customsEstimator.web.js';

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

  it('returns error for undefined', async () => {
    const result = await getVATRate(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it('returns error for numeric input', async () => {
    const result = await getVATRate(42);
    expect(result.success).toBe(false);
  });

  it('returns correct rate for France', async () => {
    const result = await getVATRate('FR');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.20);
  });

  it('returns correct rate for Japan', async () => {
    const result = await getVATRate('JP');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.10);
  });

  it('returns correct rate for Italy (highest EU)', async () => {
    const result = await getVATRate('IT');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.22);
  });

  it('returns correct rate for Sweden (25%)', async () => {
    const result = await getVATRate('SE');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.25);
  });

  it('returns correct rate for Switzerland (low 7.7%)', async () => {
    const result = await getVATRate('CH');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.077);
  });

  it('returns 0 for Hong Kong (no VAT)', async () => {
    const result = await getVATRate('HK');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0);
  });

  it('returns correct rate for Canada (5% GST)', async () => {
    const result = await getVATRate('CA');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.05);
  });

  it('truncates 3-letter codes via sanitize and still resolves', async () => {
    // sanitize('GBR', 2) → 'GB', which is valid
    const result = await getVATRate('GBR');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.20);
  });

  it('rejects single character', async () => {
    const result = await getVATRate('G');
    expect(result.success).toBe(false);
  });
});

describe('getDutyRate', () => {
  it('returns 0 duty for Canada (USMCA)', async () => {
    const result = await getDutyRate('CA');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0);
    expect(result.description).toMatch(/USMCA/i);
  });

  it('returns 0 duty for Mexico (USMCA)', async () => {
    const result = await getDutyRate('MX');
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

  it('returns EU duty rate for Germany', async () => {
    const result = await getDutyRate('DE');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.027);
    expect(result.description).toBeDefined();
  });

  it('returns EU duty rate for France', async () => {
    const result = await getDutyRate('FR');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.027);
  });

  it('returns 0 duty for Japan', async () => {
    const result = await getDutyRate('JP');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0);
    expect(result.description).toMatch(/duty-free/i);
  });

  it('returns default 5% rate for unknown countries', async () => {
    const result = await getDutyRate('BR');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.05);
  });

  it('includes description for default rate', async () => {
    const result = await getDutyRate('BR');
    expect(result.description).toMatch(/5%/);
    expect(result.description).toMatch(/furniture/i);
  });

  it('includes description for known countries', async () => {
    const result = await getDutyRate('GB');
    expect(result.description).toBeDefined();
    expect(typeof result.description).toBe('string');
    expect(result.description.length).toBeGreaterThan(0);
  });

  it('handles invalid input', async () => {
    const result = await getDutyRate('!!!');
    expect(result.success).toBe(false);
  });

  it('returns error for null', async () => {
    const result = await getDutyRate(null);
    expect(result.success).toBe(false);
  });

  it('normalizes lowercase to match config', async () => {
    const result = await getDutyRate('gb');
    expect(result.success).toBe(true);
    expect(result.rate).toBe(0.02);
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

  it('includes hsCode in estimate response', async () => {
    const result = await estimateCustomsDuties('GB', 1000, 85);
    expect(result.estimate.hsCode).toBe('9403');
  });

  it('includes disclaimer text', async () => {
    const result = await estimateCustomsDuties('GB', 1000, 85);
    expect(result.estimate.disclaimer).toMatch(/estimates only/i);
    expect(result.estimate.disclaimer).toMatch(/customs authority/i);
  });

  it('includes deMinimisApplied flag even when false', async () => {
    const result = await estimateCustomsDuties('GB', 1000, 85);
    expect(result.estimate.deMinimisApplied).toBe(false);
  });

  it('computes VAT on value+duty base', async () => {
    // GB: 2% duty, 20% VAT. For $1000: duty=$20, VAT base=$1020, VAT=$204
    const result = await estimateCustomsDuties('GB', 1000, 85);
    expect(result.estimate.dutyAmount).toBe(20);
    expect(result.estimate.vatAmount).toBe(204);
    expect(result.estimate.totalDutiesAndTaxes).toBe(224);
  });

  it('handles string-type numeric value', async () => {
    const result = await estimateCustomsDuties('GB', '500', '50');
    expect(result.success).toBe(true);
    expect(result.estimate.declaredValue).toBe(500);
  });

  it('applies de minimis exactly at threshold boundary (below)', async () => {
    // GB de minimis is $135 — $134 should qualify
    const result = await estimateCustomsDuties('GB', 134, 5);
    expect(result.estimate.deMinimisApplied).toBe(true);
    expect(result.estimate.dutyAmount).toBe(0);
  });

  it('does not apply de minimis at exact threshold value', async () => {
    // GB de minimis is $135 — $135 is NOT less than 135
    const result = await estimateCustomsDuties('GB', 135, 5);
    expect(result.estimate.deMinimisApplied).toBe(false);
    expect(result.estimate.dutyAmount).toBeGreaterThan(0);
  });

  it('handles Japan large de minimis ($10000)', async () => {
    // JP has $10000 de minimis, 0% duty, 10% VAT
    const result = await estimateCustomsDuties('JP', 5000, 50);
    expect(result.estimate.deMinimisApplied).toBe(true);
    expect(result.estimate.dutyAmount).toBe(0);
    // VAT still applies even with de minimis on duty
    expect(result.estimate.vatAmount).toBe(500);
  });

  it('zero-value estimate includes deMinimisApplied true', async () => {
    const result = await estimateCustomsDuties('GB', 0, 50);
    expect(result.estimate.deMinimisApplied).toBe(true);
    expect(result.estimate.declaredValue).toBe(0);
  });

  it('computes EU country estimate (DE: 2.7% duty, 19% VAT)', async () => {
    const result = await estimateCustomsDuties('DE', 2000, 100);
    expect(result.estimate.dutyRate).toBe(0.027);
    expect(result.estimate.dutyAmount).toBe(54);
    expect(result.estimate.vatRate).toBe(0.19);
    // VAT base = 2000 + 54 = 2054, VAT = 2054 * 0.19 = 390.26
    expect(result.estimate.vatAmount).toBe(390.26);
    expect(result.estimate.totalDutiesAndTaxes).toBe(444.26);
  });

  it('uses default 5% duty for unknown country', async () => {
    const result = await estimateCustomsDuties('BR', 1000, 50);
    expect(result.estimate.dutyRate).toBe(0.05);
    expect(result.estimate.dutyAmount).toBe(50);
  });

  it('returns currency as USD', async () => {
    const result = await estimateCustomsDuties('AU', 500, 30);
    expect(result.estimate.currency).toBe('USD');
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

  it('includes VAT on product + shipping + duty', async () => {
    // GB: 2% duty, 20% VAT. Product=$1000, Shipping=$200
    // Duty = 1000 * 0.02 = 20, VAT base = 1000+200+20 = 1220, VAT = 244
    const result = await calculateLandedCost('GB', 1000, 200, 85);
    expect(result.landedCost.dutyAmount).toBe(20);
    expect(result.landedCost.vatAmount).toBe(244);
    expect(result.landedCost.totalLandedCost).toBe(1000 + 200 + 20 + 244);
  });

  it('returns currency as USD', async () => {
    const result = await calculateLandedCost('CA', 500, 100, 50);
    expect(result.landedCost.currency).toBe('USD');
  });

  it('includes disclaimer text', async () => {
    const result = await calculateLandedCost('GB', 500, 100, 50);
    expect(result.landedCost.disclaimer).toMatch(/estimates only/i);
  });

  it('returns error for null country', async () => {
    const result = await calculateLandedCost(null, 500, 100, 50);
    expect(result.success).toBe(false);
  });

  it('handles string-type numeric inputs', async () => {
    const result = await calculateLandedCost('GB', '1000', '150', '85');
    expect(result.success).toBe(true);
    expect(result.landedCost.productCost).toBe(1000);
    expect(result.landedCost.shippingCost).toBe(150);
  });

  it('applies de minimis for low-value products', async () => {
    // GB de minimis $135 — $100 product should be below
    const result = await calculateLandedCost('GB', 100, 50, 10);
    expect(result.success).toBe(true);
    expect(result.landedCost.dutyAmount).toBe(0);
    // VAT still applies: (100 + 50 + 0) * 0.20 = 30
    expect(result.landedCost.vatAmount).toBe(30);
  });

  it('calculates Canada landed cost (0 duty, 5% GST)', async () => {
    const result = await calculateLandedCost('CA', 2000, 300, 85);
    expect(result.landedCost.dutyRate).toBe(0);
    expect(result.landedCost.dutyAmount).toBe(0);
    expect(result.landedCost.vatRate).toBe(0.05);
    // VAT base = 2000 + 300 + 0 = 2300, VAT = 115
    expect(result.landedCost.vatAmount).toBe(115);
    expect(result.landedCost.totalLandedCost).toBe(2415);
  });

  it('calculates Japan landed cost (0 duty, 10% VAT, high de minimis)', async () => {
    // JP: 0% duty, 10% VAT, $10000 de minimis
    const result = await calculateLandedCost('JP', 3000, 500, 80);
    expect(result.landedCost.dutyAmount).toBe(0); // 0 rate + de minimis
    expect(result.landedCost.vatRate).toBe(0.10);
    // VAT base = 3000 + 500 + 0 = 3500, VAT = 350
    expect(result.landedCost.vatAmount).toBe(350);
    expect(result.landedCost.totalLandedCost).toBe(3850);
  });
});
