import { describe, it, expect, beforeEach } from 'vitest';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import {
  getExchangeRates,
  convertPrice,
  formatLocalizedPrice,
  getSupportedCurrencies,
  __resetCache,
} from '../src/backend/currencyService.web.js';

const MOCK_RATES = {
  base: 'USD',
  rates: {
    USD: 1,
    CAD: 1.36,
    GBP: 0.79,
    EUR: 0.92,
    AUD: 1.54,
    JPY: 149.50,
  },
};

beforeEach(() => {
  __resetCache();
  __setSecrets({
    EXCHANGE_RATE_API_KEY: 'test-api-key',
  });

  __setHandler((url) => {
    if (url.includes('openexchangerates.org') || url.includes('api.exchangerate')) {
      return {
        ok: true,
        async json() { return MOCK_RATES; },
        async text() { return JSON.stringify(MOCK_RATES); },
      };
    }
    return { ok: false, status: 404, async json() { return {}; }, async text() { return 'Not found'; } };
  });
});

describe('getExchangeRates', () => {
  it('returns exchange rates from API', async () => {
    const result = await getExchangeRates();
    expect(result.success).toBe(true);
    expect(result.rates).toBeDefined();
    expect(result.rates.USD).toBe(1);
    expect(result.rates.CAD).toBeGreaterThan(0);
  });

  it('returns cached rates on subsequent calls within TTL', async () => {
    const first = await getExchangeRates();
    expect(first.success).toBe(true);

    // Second call should use cache
    __setHandler(() => {
      throw new Error('Should not be called — cache should be used');
    });
    const second = await getExchangeRates();
    expect(second.success).toBe(true);
    expect(second.rates).toEqual(first.rates);
  });

  it('returns fallback rates when API fails', async () => {
    __setHandler(() => ({
      ok: false,
      status: 500,
      async json() { return {}; },
      async text() { return 'Server error'; },
    }));

    const result = await getExchangeRates();
    expect(result.success).toBe(true);
    expect(result.rates.USD).toBe(1);
    expect(result.fallback).toBe(true);
  });

  it('returns fallback rates when secret is missing', async () => {
    __resetSecrets();
    const result = await getExchangeRates();
    expect(result.success).toBe(true);
    expect(result.fallback).toBe(true);
  });
});

describe('convertPrice', () => {
  it('converts USD to CAD correctly', async () => {
    const result = await convertPrice(100, 'USD', 'CAD');
    expect(result.success).toBe(true);
    expect(result.convertedAmount).toBeCloseTo(136, 0);
    expect(result.currency).toBe('CAD');
  });

  it('converts USD to GBP correctly', async () => {
    const result = await convertPrice(100, 'USD', 'GBP');
    expect(result.success).toBe(true);
    expect(result.convertedAmount).toBeCloseTo(79, 0);
  });

  it('converts USD to JPY correctly (no decimals)', async () => {
    const result = await convertPrice(100, 'USD', 'JPY');
    expect(result.success).toBe(true);
    expect(result.convertedAmount).toBeCloseTo(14950, -1);
  });

  it('returns same amount for USD to USD', async () => {
    const result = await convertPrice(499.99, 'USD', 'USD');
    expect(result.success).toBe(true);
    expect(result.convertedAmount).toBe(499.99);
  });

  it('handles zero amount', async () => {
    const result = await convertPrice(0, 'USD', 'EUR');
    expect(result.success).toBe(true);
    expect(result.convertedAmount).toBe(0);
  });

  it('clamps negative amounts to zero', async () => {
    const result = await convertPrice(-50, 'USD', 'EUR');
    expect(result.success).toBe(true);
    expect(result.convertedAmount).toBe(0);
  });

  it('rejects unsupported currency codes', async () => {
    const result = await convertPrice(100, 'USD', 'XYZ');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('sanitizes currency code input', async () => {
    const result = await convertPrice(100, 'USD', '<script>alert(1)</script>');
    expect(result.success).toBe(false);
  });

  it('handles non-numeric amount gracefully', async () => {
    const result = await convertPrice('not-a-number', 'USD', 'CAD');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('handles null/undefined inputs', async () => {
    const result = await convertPrice(null, undefined, undefined);
    expect(result.success).toBe(false);
  });
});

describe('formatLocalizedPrice', () => {
  it('formats USD price in en-US locale', async () => {
    const result = await formatLocalizedPrice(499.99, 'USD');
    expect(result.success).toBe(true);
    expect(result.formatted).toMatch(/\$499\.99/);
  });

  it('formats GBP price with pound sign', async () => {
    const result = await formatLocalizedPrice(79.50, 'GBP');
    expect(result.success).toBe(true);
    expect(result.formatted).toMatch(/£/);
  });

  it('formats EUR price with euro sign', async () => {
    const result = await formatLocalizedPrice(92.00, 'EUR');
    expect(result.success).toBe(true);
    expect(result.formatted).toMatch(/€/);
  });

  it('formats JPY without decimals', async () => {
    const result = await formatLocalizedPrice(14950, 'JPY');
    expect(result.success).toBe(true);
    expect(result.formatted).toMatch(/[¥￥]/);
    // JPY should not have decimal places
    expect(result.formatted).not.toMatch(/\.\d{2}/);
  });

  it('returns error for unsupported currency', async () => {
    const result = await formatLocalizedPrice(100, 'INVALID');
    expect(result.success).toBe(false);
  });

  it('handles zero amount', async () => {
    const result = await formatLocalizedPrice(0, 'USD');
    expect(result.success).toBe(true);
    expect(result.formatted).toMatch(/\$0/);
  });
});

describe('getSupportedCurrencies', () => {
  it('returns list of supported currencies', async () => {
    const result = await getSupportedCurrencies();
    expect(result.success).toBe(true);
    expect(result.currencies).toBeDefined();
    expect(Array.isArray(result.currencies)).toBe(true);
    expect(result.currencies.length).toBeGreaterThan(0);
  });

  it('includes USD as default', async () => {
    const result = await getSupportedCurrencies();
    const usd = result.currencies.find(c => c.code === 'USD');
    expect(usd).toBeDefined();
    expect(usd.name).toBe('US Dollar');
  });

  it('each currency has code, symbol, and name', async () => {
    const result = await getSupportedCurrencies();
    for (const currency of result.currencies) {
      expect(currency.code).toBeDefined();
      expect(currency.symbol).toBeDefined();
      expect(currency.name).toBeDefined();
    }
  });
});
