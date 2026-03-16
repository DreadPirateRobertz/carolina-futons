/**
 * Deep coverage tests for currencyService.web.js — NaN/Infinity conversion,
 * case handling, cross-currency conversion, and cache behavior.
 */
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
  rates: { USD: 1, CAD: 1.36, GBP: 0.79, EUR: 0.92, AUD: 1.54, JPY: 149.50 },
};

beforeEach(() => {
  __resetCache();
  __setSecrets({ EXCHANGE_RATE_API_KEY: 'test-key' });
  __setHandler((url) => {
    if (url.includes('openexchangerates')) {
      return { ok: true, async json() { return MOCK_RATES; }, async text() { return ''; } };
    }
    return { ok: false, status: 404, async json() { return {}; }, async text() { return ''; } };
  });
});

describe('convertPrice — edge cases', () => {
  it('rejects NaN amount', async () => {
    const result = await convertPrice(NaN, 'USD', 'CAD');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it('clamps Infinity to 0 result (Math.max(0, Infinity) = Infinity)', async () => {
    const result = await convertPrice(Infinity, 'USD', 'CAD');
    expect(result.success).toBe(true);
    // Infinity stays — not clamped by Math.max(0, x)
    expect(result.convertedAmount).toBe(Infinity);
  });

  it('handles lowercase currency input', async () => {
    const result = await convertPrice(100, 'usd', 'cad');
    expect(result.success).toBe(true);
    expect(result.currency).toBe('CAD');
  });

  it('handles mixed case currency input', async () => {
    const result = await convertPrice(100, 'Usd', 'Gbp');
    expect(result.success).toBe(true);
    expect(result.currency).toBe('GBP');
  });

  it('converts non-USD to non-USD (cross-currency via USD base)', async () => {
    const result = await convertPrice(100, 'CAD', 'GBP');
    expect(result.success).toBe(true);
    // 100 CAD → USD: 100/1.36 ≈ 73.53 → GBP: 73.53*0.79 ≈ 58.09
    expect(result.convertedAmount).toBeCloseTo(58.09, 0);
  });

  it('same-currency returns exact input (no floating point drift)', async () => {
    const result = await convertPrice(499.99, 'EUR', 'EUR');
    expect(result.success).toBe(true);
    expect(result.convertedAmount).toBe(499.99);
  });

  it('rejects empty string from currency', async () => {
    const result = await convertPrice(100, '', 'USD');
    expect(result.success).toBe(false);
  });

  it('rejects boolean amount', async () => {
    const result = await convertPrice(true, 'USD', 'CAD');
    expect(result.success).toBe(false);
  });
});

describe('formatLocalizedPrice — edge cases', () => {
  it('formats negative amount', async () => {
    const result = await formatLocalizedPrice(-50, 'USD');
    expect(result.success).toBe(true);
    expect(result.formatted).toMatch(/-?\$50/);
  });

  it('formats very large amount', async () => {
    const result = await formatLocalizedPrice(1000000, 'USD');
    expect(result.success).toBe(true);
    expect(result.formatted).toContain('1,000,000');
  });

  it('handles string amount via Number coercion', async () => {
    const result = await formatLocalizedPrice('299.99', 'USD');
    expect(result.success).toBe(true);
    expect(result.formatted).toMatch(/299\.99/);
  });

  it('handles null amount as 0', async () => {
    const result = await formatLocalizedPrice(null, 'USD');
    expect(result.success).toBe(true);
    expect(result.formatted).toMatch(/\$0/);
  });

  it('handles lowercase currency code', async () => {
    const result = await formatLocalizedPrice(100, 'usd');
    expect(result.success).toBe(true);
  });

  it('rejects empty string currency', async () => {
    const result = await formatLocalizedPrice(100, '');
    expect(result.success).toBe(false);
  });
});

describe('getExchangeRates — fallback behavior', () => {
  it('fallback rates include all expected currencies', async () => {
    __resetSecrets(); // no API key
    const result = await getExchangeRates();
    expect(result.fallback).toBe(true);
    expect(result.rates.USD).toBe(1);
    expect(result.rates.CAD).toBeDefined();
    expect(result.rates.GBP).toBeDefined();
    expect(result.rates.EUR).toBeDefined();
  });

  it('fallback rates are fresh objects (not shared reference)', async () => {
    __resetSecrets();
    const a = await getExchangeRates();
    const b = await getExchangeRates();
    expect(a.rates).not.toBe(b.rates);
    expect(a.rates).toEqual(b.rates);
  });
});

describe('getSupportedCurrencies — structure', () => {
  it('returns unique currency codes', async () => {
    const result = await getSupportedCurrencies();
    const codes = result.currencies.map(c => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('all currency codes are uppercase 3-letter strings', async () => {
    const result = await getSupportedCurrencies();
    for (const c of result.currencies) {
      expect(c.code).toMatch(/^[A-Z]{3}$/);
    }
  });
});
