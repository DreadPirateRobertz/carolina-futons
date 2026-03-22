import { describe, it, expect, beforeEach } from 'vitest';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import {
  getLTLRates,
  getLTLFallbackRates,
  shouldUseLTL,
  LTL_THRESHOLDS,
} from '../src/backend/wwex-freight.web.js';

beforeEach(() => {
  __setSecrets({
    WWEX_USERNAME: 'test-user',
    WWEX_PASSWORD: 'test-pass',
    WWEX_ACCOUNT_NUMBER: 'ACC123',
  });
});

// ── shouldUseLTL ────────────────────────────────────────────────────

describe('shouldUseLTL', () => {
  it('returns false for empty packages', () => {
    expect(shouldUseLTL([])).toBe(false);
    expect(shouldUseLTL(null)).toBe(false);
  });

  it('returns false for light parcel (futon frame ~80 lbs)', () => {
    expect(shouldUseLTL([{ weight: 80, length: 72 }])).toBe(false);
  });

  it('returns true when single item exceeds max parcel weight', () => {
    expect(shouldUseLTL([{ weight: 151, length: 72 }])).toBe(true);
  });

  it('returns true when single item exceeds max parcel length', () => {
    expect(shouldUseLTL([{ weight: 50, length: 110 }])).toBe(true);
  });

  it('returns true when total bundle weight exceeds parcel max', () => {
    const packages = [
      { weight: 90, length: 72 }, // murphy bed base
      { weight: 85, length: 60 }, // mattress
    ];
    expect(shouldUseLTL(packages)).toBe(true); // 175 > 150
  });

  it('returns false for two light items under combined threshold', () => {
    expect(shouldUseLTL([
      { weight: 70, length: 72 },
      { weight: 60, length: 60 },
    ])).toBe(false); // 130 < 150... actually 130 < 150, false
  });

  it('LTL_THRESHOLDS exports are correct values', () => {
    expect(LTL_THRESHOLDS.maxParcelWeightLbs).toBe(150);
    expect(LTL_THRESHOLDS.maxParcelLengthIn).toBe(108);
    expect(LTL_THRESHOLDS.minLTLWeightLbs).toBe(100);
  });
});

// ── getLTLFallbackRates ────────────────────────────────────────────

describe('getLTLFallbackRates', () => {
  const stdPackages = [{ weight: 200, length: 80 }];

  it('returns at least one rate', () => {
    const rates = getLTLFallbackRates('28792', stdPackages);
    expect(rates.length).toBeGreaterThan(0);
  });

  it('returns cheaper rate for NC destination', () => {
    const ncRates = getLTLFallbackRates('27601', stdPackages);  // Raleigh
    const nyRates = getLTLFallbackRates('10001', stdPackages);  // NYC
    expect(ncRates[0].cost).toBeLessThan(nyRates[0].cost);
  });

  it('NC/SC (270-299) gets $199 base', () => {
    expect(getLTLFallbackRates('28792', stdPackages)[0].cost).toBe(199);
  });

  it('SE (300-399) gets $249 base', () => {
    expect(getLTLFallbackRates('30301', stdPackages)[0].cost).toBe(249);
  });

  it('VA (200-269) gets $349 base', () => {
    expect(getLTLFallbackRates('22201', stdPackages)[0].cost).toBe(349);
  });

  it('default gets $299 base', () => {
    expect(getLTLFallbackRates('10001', stdPackages)[0].cost).toBe(299);
  });

  it('applies weight surcharge for orders > 500 lbs', () => {
    const heavy = [{ weight: 600, length: 80 }]; // 100 lbs over 500
    const rates = getLTLFallbackRates('28792', heavy);
    // $199 base + $25 per 100 lbs over 500 = $224
    expect(rates[0].cost).toBe(224);
  });

  it('rate has isEstimate flag', () => {
    const rates = getLTLFallbackRates('28792', stdPackages);
    expect(rates[0].isEstimate).toBe(true);
  });

  it('rate has isLTL flag', () => {
    const rates = getLTLFallbackRates('28792', stdPackages);
    expect(rates[0].isLTL).toBe(true);
  });

  it('rate has truck icon', () => {
    const rates = getLTLFallbackRates('28792', stdPackages);
    expect(rates[0].icon).toBe('🚛');
  });

  it('handles empty packages gracefully', () => {
    const rates = getLTLFallbackRates('28792', []);
    expect(rates.length).toBeGreaterThan(0);
    expect(rates[0].cost).toBe(199); // $199 base, no surcharge
  });

  it('handles null/undefined zip gracefully', () => {
    const rates = getLTLFallbackRates(null, stdPackages);
    expect(rates[0].cost).toBe(299); // default
  });
});

// ── getLTLRates (live API) ─────────────────────────────────────────

describe('getLTLRates', () => {
  it('returns error for missing params', async () => {
    const result = await getLTLRates('', '28792', [{ weight: 200 }]);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for missing packages', async () => {
    const result = await getLTLRates('28792', '30301', []);
    expect(result.success).toBe(false);
  });

  it('falls back gracefully when WWEX API returns error status', async () => {
    __setHandler(() => ({ ok: false, status: 503, async text() { return ''; } }));

    const result = await getLTLRates('28792', '30301', [{ weight: 200, length: 80 }]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('503');
    // fallback rates should be populated
    expect(result.fallback).toBeDefined();
    expect(result.fallback.length).toBeGreaterThan(0);
  });

  it('falls back gracefully on network error', async () => {
    __setHandler(() => { throw new Error('Network down'); });

    const result = await getLTLRates('28792', '30301', [{ weight: 200, length: 80 }]);
    expect(result.success).toBe(false);
    expect(result.fallback).toBeDefined();
    expect(result.fallback[0].isEstimate).toBe(true);
  });

  it('parses valid WWEX SOAP response', async () => {
    __setHandler(() => ({
      ok: true,
      async text() {
        return `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RateQuoteResponse>
      <RateQuote>
        <ServiceCode>STD</ServiceCode>
        <ServiceName>WWEX Standard Freight</ServiceName>
        <TotalCharge>215.50</TotalCharge>
        <TransitDays>3</TransitDays>
      </RateQuote>
    </RateQuoteResponse>
  </soap:Body>
</soap:Envelope>`;
      },
    }));

    const result = await getLTLRates('28792', '30301', [{ weight: 200, length: 80 }]);
    expect(result.success).toBe(true);
    expect(result.rates.length).toBeGreaterThan(0);
    expect(result.rates[0].cost).toBe(215.50);
    expect(result.rates[0].code).toBe('wwex-ltl-std');
    expect(result.rates[0].isLTL).toBe(true);
    expect(result.rates[0].icon).toBe('🚛');
  });
});
