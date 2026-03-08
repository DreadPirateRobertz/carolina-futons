import { describe, it, expect } from 'vitest';
import {
  getCurrencyOptions,
  formatPriceForCurrency,
  getDefaultCurrencyFromCountry,
  validateCurrencyCode,
} from '../../src/public/currencySelector.js';

describe('getCurrencyOptions', () => {
  it('returns all supported currencies', () => {
    const options = getCurrencyOptions();
    expect(Array.isArray(options)).toBe(true);
    expect(options.length).toBeGreaterThan(0);
  });

  it('each option has label and value', () => {
    const options = getCurrencyOptions();
    for (const opt of options) {
      expect(opt.label).toBeDefined();
      expect(opt.value).toBeDefined();
      expect(typeof opt.label).toBe('string');
      expect(typeof opt.value).toBe('string');
    }
  });

  it('includes USD', () => {
    const options = getCurrencyOptions();
    const usd = options.find(o => o.value === 'USD');
    expect(usd).toBeDefined();
    expect(usd.label).toMatch(/USD|Dollar/);
  });

  it('USD is first option', () => {
    const options = getCurrencyOptions();
    expect(options[0].value).toBe('USD');
  });
});

describe('formatPriceForCurrency', () => {
  it('formats USD correctly', () => {
    const result = formatPriceForCurrency(499.99, 'USD');
    expect(result).toMatch(/\$499\.99/);
  });

  it('formats GBP with pound sign', () => {
    const result = formatPriceForCurrency(399.99, 'GBP');
    expect(result).toMatch(/£/);
  });

  it('formats EUR with euro sign', () => {
    const result = formatPriceForCurrency(459.99, 'EUR');
    expect(result).toMatch(/€/);
  });

  it('formats JPY without decimals', () => {
    const result = formatPriceForCurrency(14950, 'JPY');
    expect(result).toMatch(/[¥￥]/);
    expect(result).not.toMatch(/\.\d{2}/);
  });

  it('handles zero', () => {
    const result = formatPriceForCurrency(0, 'USD');
    expect(result).toMatch(/\$0/);
  });

  it('falls back to USD for invalid currency', () => {
    const result = formatPriceForCurrency(100, 'INVALID');
    expect(result).toMatch(/\$100/);
  });

  it('handles negative values (displays as negative)', () => {
    const result = formatPriceForCurrency(-50, 'USD');
    expect(result).toMatch(/-/);
  });

  it('handles non-numeric gracefully', () => {
    const result = formatPriceForCurrency(NaN, 'USD');
    expect(result).toBeDefined();
  });

  it('handles undefined amount', () => {
    const result = formatPriceForCurrency(undefined, 'USD');
    expect(result).toBeDefined();
  });
});

describe('getDefaultCurrencyFromCountry', () => {
  it('returns USD for US', () => {
    expect(getDefaultCurrencyFromCountry('US')).toBe('USD');
  });

  it('returns CAD for CA', () => {
    expect(getDefaultCurrencyFromCountry('CA')).toBe('CAD');
  });

  it('returns GBP for GB', () => {
    expect(getDefaultCurrencyFromCountry('GB')).toBe('GBP');
  });

  it('returns EUR for Germany', () => {
    expect(getDefaultCurrencyFromCountry('DE')).toBe('EUR');
  });

  it('returns EUR for France', () => {
    expect(getDefaultCurrencyFromCountry('FR')).toBe('EUR');
  });

  it('returns AUD for Australia', () => {
    expect(getDefaultCurrencyFromCountry('AU')).toBe('AUD');
  });

  it('returns JPY for Japan', () => {
    expect(getDefaultCurrencyFromCountry('JP')).toBe('JPY');
  });

  it('returns USD for unknown countries', () => {
    expect(getDefaultCurrencyFromCountry('XX')).toBe('USD');
  });

  it('handles lowercase', () => {
    expect(getDefaultCurrencyFromCountry('gb')).toBe('GBP');
  });

  it('returns USD for null/undefined', () => {
    expect(getDefaultCurrencyFromCountry(null)).toBe('USD');
    expect(getDefaultCurrencyFromCountry(undefined)).toBe('USD');
    expect(getDefaultCurrencyFromCountry('')).toBe('USD');
  });
});

describe('validateCurrencyCode', () => {
  it('accepts valid currency codes', () => {
    expect(validateCurrencyCode('USD')).toBe(true);
    expect(validateCurrencyCode('CAD')).toBe(true);
    expect(validateCurrencyCode('GBP')).toBe(true);
    expect(validateCurrencyCode('EUR')).toBe(true);
    expect(validateCurrencyCode('AUD')).toBe(true);
    expect(validateCurrencyCode('JPY')).toBe(true);
  });

  it('rejects unsupported currency codes', () => {
    expect(validateCurrencyCode('XYZ')).toBe(false);
    expect(validateCurrencyCode('BTC')).toBe(false);
  });

  it('rejects invalid input', () => {
    expect(validateCurrencyCode('')).toBe(false);
    expect(validateCurrencyCode(null)).toBe(false);
    expect(validateCurrencyCode(undefined)).toBe(false);
    expect(validateCurrencyCode(123)).toBe(false);
  });

  it('rejects XSS attempts', () => {
    expect(validateCurrencyCode('<script>')).toBe(false);
    expect(validateCurrencyCode('USD<img src=x>')).toBe(false);
  });

  it('handles lowercase (normalizes)', () => {
    expect(validateCurrencyCode('usd')).toBe(true);
    expect(validateCurrencyCode('gbp')).toBe(true);
  });
});
