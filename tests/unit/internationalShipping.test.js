import { describe, it, expect, beforeEach } from 'vitest';
import { __setHandler } from '../__mocks__/wix-fetch.js';
import { __setSecrets } from '../__mocks__/wix-secrets-backend.js';
import {
  getInternationalShippingRates,
  getShippingZone,
  isShippableCountry,
  getInternationalShippingEstimate,
} from '../../src/backend/internationalShipping.web.js';

beforeEach(() => {
  __setSecrets({
    UPS_CLIENT_ID: 'test-client-id',
    UPS_CLIENT_SECRET: 'test-client-secret',
    UPS_ACCOUNT_NUMBER: '123456',
    UPS_SANDBOX: 'true',
  });

  __setHandler((url) => {
    if (url.includes('/oauth/token')) {
      return {
        ok: true,
        async json() { return { access_token: 'mock-token', expires_in: '3600' }; },
        async text() { return ''; },
      };
    }
    if (url.includes('/rating/')) {
      return {
        ok: true,
        async json() {
          return {
            RateResponse: {
              RatedShipment: [
                {
                  Service: { Code: '07' },
                  TotalCharges: { MonetaryValue: '189.50', CurrencyCode: 'USD' },
                  GuaranteedDelivery: { BusinessDaysInTransit: '5' },
                },
                {
                  Service: { Code: '08' },
                  TotalCharges: { MonetaryValue: '129.00', CurrencyCode: 'USD' },
                  GuaranteedDelivery: { BusinessDaysInTransit: '10' },
                },
              ],
            },
          };
        },
        async text() { return ''; },
      };
    }
    return { ok: true, async json() { return {}; }, async text() { return ''; } };
  });
});

describe('getShippingZone', () => {
  it('returns canada zone for CA', async () => {
    const result = await getShippingZone('CA');
    expect(result.success).toBe(true);
    expect(result.zone).toBe('canada');
    expect(result.zoneName).toBe('Canada');
  });

  it('returns europe zone for GB', async () => {
    const result = await getShippingZone('GB');
    expect(result.success).toBe(true);
    expect(result.zone).toBe('europe');
  });

  it('returns europe zone for DE', async () => {
    const result = await getShippingZone('DE');
    expect(result.success).toBe(true);
    expect(result.zone).toBe('europe');
  });

  it('returns asia_pacific zone for JP', async () => {
    const result = await getShippingZone('JP');
    expect(result.success).toBe(true);
    expect(result.zone).toBe('asia_pacific');
  });

  it('returns asia_pacific zone for AU', async () => {
    const result = await getShippingZone('AU');
    expect(result.success).toBe(true);
    expect(result.zone).toBe('asia_pacific');
  });

  it('returns other zone for unknown countries', async () => {
    const result = await getShippingZone('BR');
    expect(result.success).toBe(true);
    expect(result.zone).toBe('other');
  });

  it('returns error for US (domestic, not international)', async () => {
    const result = await getShippingZone('US');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/domestic/i);
  });

  it('returns error for restricted countries', async () => {
    const result = await getShippingZone('KP');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/restricted|cannot ship/i);
  });

  it('sanitizes country code input', async () => {
    const result = await getShippingZone('<script>');
    expect(result.success).toBe(false);
  });

  it('handles empty/null input', async () => {
    const result = await getShippingZone('');
    expect(result.success).toBe(false);
  });

  it('handles null input', async () => {
    const result = await getShippingZone(null);
    expect(result.success).toBe(false);
  });
});

describe('isShippableCountry', () => {
  it('returns true for Canada', async () => {
    const result = await isShippableCountry('CA');
    expect(result.success).toBe(true);
    expect(result.shippable).toBe(true);
  });

  it('returns true for UK', async () => {
    const result = await isShippableCountry('GB');
    expect(result.success).toBe(true);
    expect(result.shippable).toBe(true);
  });

  it('returns false for restricted countries', async () => {
    const result = await isShippableCountry('CU');
    expect(result.success).toBe(true);
    expect(result.shippable).toBe(false);
  });

  it('returns true for US (domestic)', async () => {
    const result = await isShippableCountry('US');
    expect(result.success).toBe(true);
    expect(result.shippable).toBe(true);
  });

  it('handles lowercase country codes', async () => {
    const result = await isShippableCountry('ca');
    expect(result.success).toBe(true);
    expect(result.shippable).toBe(true);
  });
});

describe('getInternationalShippingEstimate', () => {
  it('calculates shipping estimate for Canada', async () => {
    const result = await getInternationalShippingEstimate('CA', 50, 499.99);
    expect(result.success).toBe(true);
    expect(result.estimate).toBeDefined();
    expect(result.estimate.baseRate).toBeGreaterThan(0);
    expect(result.estimate.totalRate).toBeGreaterThan(0);
    expect(result.estimate.estimatedDays).toBeDefined();
    expect(result.estimate.currency).toBe('USD');
  });

  it('calculates shipping for Europe (heavier)', async () => {
    const result = await getInternationalShippingEstimate('GB', 100, 999.99);
    expect(result.success).toBe(true);
    expect(result.estimate.totalRate).toBeGreaterThan(0);
    // Europe should be more expensive than Canada for same weight
    const caResult = await getInternationalShippingEstimate('CA', 100, 999.99);
    expect(result.estimate.totalRate).toBeGreaterThan(caResult.estimate.totalRate);
  });

  it('applies free international shipping over threshold', async () => {
    const result = await getInternationalShippingEstimate('CA', 50, 3500);
    expect(result.success).toBe(true);
    expect(result.estimate.totalRate).toBe(0);
    expect(result.estimate.freeShipping).toBe(true);
  });

  it('clamps negative weight to minimum', async () => {
    const result = await getInternationalShippingEstimate('CA', -10, 499.99);
    expect(result.success).toBe(true);
    expect(result.estimate.totalRate).toBeGreaterThanOrEqual(0);
  });

  it('returns error for restricted country', async () => {
    const result = await getInternationalShippingEstimate('KP', 50, 499.99);
    expect(result.success).toBe(false);
  });

  it('returns error for US (domestic)', async () => {
    const result = await getInternationalShippingEstimate('US', 50, 499.99);
    expect(result.success).toBe(false);
  });

  it('handles zero weight (document shipment)', async () => {
    const result = await getInternationalShippingEstimate('CA', 0, 100);
    expect(result.success).toBe(true);
    expect(result.estimate.totalRate).toBeGreaterThanOrEqual(0);
  });

  it('handles null/undefined inputs', async () => {
    const result = await getInternationalShippingEstimate(null, null, null);
    expect(result.success).toBe(false);
  });
});

describe('getInternationalShippingRates', () => {
  it('returns shipping rates for international destination', async () => {
    const destination = {
      country: 'CA',
      postalCode: 'M5V 2T6',
      city: 'Toronto',
      state: 'ON',
    };
    const packages = [{ length: 72, width: 36, height: 12, weight: 85, description: 'Futon Frame' }];
    const result = await getInternationalShippingRates(destination, packages, 799.99);
    expect(result.success).toBe(true);
    expect(result.rates).toBeDefined();
    expect(Array.isArray(result.rates)).toBe(true);
    expect(result.rates.length).toBeGreaterThan(0);
  });

  it('returns estimated rates when UPS API fails', async () => {
    __setHandler(() => ({
      ok: false,
      status: 500,
      async json() { return {}; },
      async text() { return 'Error'; },
    }));

    const destination = { country: 'GB', postalCode: 'SW1A 1AA', city: 'London' };
    const packages = [{ length: 72, width: 36, height: 12, weight: 85, description: 'Futon' }];
    const result = await getInternationalShippingRates(destination, packages, 799.99);
    expect(result.success).toBe(true);
    expect(result.rates.length).toBeGreaterThan(0);
    expect(result.estimated).toBe(true);
  });

  it('returns empty rates for restricted country', async () => {
    const destination = { country: 'IR', postalCode: '12345' };
    const packages = [{ weight: 50 }];
    const result = await getInternationalShippingRates(destination, packages, 500);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/restricted|cannot ship/i);
  });

  it('each rate has required fields', async () => {
    const destination = { country: 'CA', postalCode: 'M5V 2T6', city: 'Toronto' };
    const packages = [{ length: 72, width: 36, height: 12, weight: 85 }];
    const result = await getInternationalShippingRates(destination, packages, 799.99);
    expect(result.success).toBe(true);
    for (const rate of result.rates) {
      expect(rate.code).toBeDefined();
      expect(rate.title).toBeDefined();
      expect(rate.cost).toBeDefined();
      expect(typeof rate.cost).toBe('number');
      expect(rate.currency).toBe('USD');
      expect(rate.estimatedDays).toBeDefined();
    }
  });
});
