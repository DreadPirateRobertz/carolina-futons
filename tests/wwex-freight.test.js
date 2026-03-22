/**
 * @file wwex-freight.test.js
 * @description Unit tests for backend/wwex-freight.web.js — WWEX SpeedFreight LTL service.
 *
 * Covers:
 *  - shouldUseLTL: empty/light/oversize/total-weight thresholds
 *  - getLTLFallbackRates: zone-based pricing, weight surcharge, shape/flags
 *  - getLTLRates: missing params, secret retrieval, successful SOAP parse,
 *    HTTP error fallback, secret-fetch failure, parse error fallback
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset as resetFetch, __setHandler } from './__mocks__/wix-fetch.js';
import { __reset as resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';
import {
  shouldUseLTL,
  getLTLFallbackRates,
  getLTLRates,
  requiresLiftgate,
  LTL_THRESHOLDS,
} from '../src/backend/wwex-freight.web.js';

beforeEach(() => {
  resetFetch();
  resetSecrets();
});

// ── shouldUseLTL ──────────────────────────────────────────────────────────────

describe('shouldUseLTL', () => {
  it('returns false for empty array', () => {
    expect(shouldUseLTL([])).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(shouldUseLTL(null)).toBe(false);
    expect(shouldUseLTL(undefined)).toBe(false);
  });

  it('returns false for a standard futon frame (80 lbs, 72 in)', () => {
    expect(shouldUseLTL([{ weight: 80, length: 72 }])).toBe(false);
  });

  it('returns true at exactly the weight threshold (150 lbs) — inclusive boundary', () => {
    expect(shouldUseLTL([{ weight: LTL_THRESHOLDS.maxParcelWeightLbs, length: 72 }])).toBe(true);
  });

  it('returns false just below the weight threshold (149 lbs)', () => {
    expect(shouldUseLTL([{ weight: 149, length: 72 }])).toBe(false);
  });

  it('returns true when a single item exceeds max parcel weight (151 lbs)', () => {
    expect(shouldUseLTL([{ weight: 151, length: 72 }])).toBe(true);
  });

  it('returns true at exactly the length threshold (108 in) — inclusive boundary', () => {
    expect(shouldUseLTL([{ weight: 50, length: LTL_THRESHOLDS.maxParcelLengthIn }])).toBe(true);
  });

  it('returns false just below the length threshold (107 in)', () => {
    expect(shouldUseLTL([{ weight: 50, length: LTL_THRESHOLDS.maxParcelLengthIn - 1 }])).toBe(false);
  });

  it('returns true when total weight of multiple parcels meets or exceeds threshold', () => {
    // Three 60-lb items = 180 lbs total >= 150 threshold
    const packages = [{ weight: 60 }, { weight: 60 }, { weight: 60 }];
    expect(shouldUseLTL(packages)).toBe(true);
  });

  it('returns false when total weight is within threshold across multiple parcels', () => {
    expect(shouldUseLTL([{ weight: 50 }, { weight: 50 }])).toBe(false);
  });
});

// ── getLTLFallbackRates ───────────────────────────────────────────────────────

describe('getLTLFallbackRates', () => {
  it('returns NC/SC close zone rate ($199) for zip3 270–299', () => {
    const rates = getLTLFallbackRates('28701', [{ weight: 200 }]);
    expect(rates).toHaveLength(1);
    expect(rates[0].cost).toBe(199);
  });

  it('returns SE regional rate ($249) for zip3 300–399', () => {
    const rates = getLTLFallbackRates('30301', [{ weight: 200 }]);
    expect(rates[0].cost).toBe(249);
  });

  it('returns VA/Mid-Atlantic rate ($349) for zip3 200–269', () => {
    const rates = getLTLFallbackRates('22201', [{ weight: 200 }]);
    expect(rates[0].cost).toBe(349);
  });

  it('returns default rate ($299) for zip outside all defined zones', () => {
    const rates = getLTLFallbackRates('10001', [{ weight: 200 }]);
    expect(rates[0].cost).toBe(299);
  });

  it('adds weight surcharge of $25 per 100 lbs over 500', () => {
    // 700 lbs = 200 lbs over 500 → 2 × $25 = $50 surcharge on top of $199
    const rates = getLTLFallbackRates('28701', [{ weight: 700 }]);
    expect(rates[0].cost).toBe(249);
  });

  it('does not add surcharge at exactly 500 lbs', () => {
    const rates = getLTLFallbackRates('28701', [{ weight: 500 }]);
    expect(rates[0].cost).toBe(199);
  });

  it('returns rate with isEstimate:true and isLTL:true flags', () => {
    const rates = getLTLFallbackRates('28701', [{ weight: 100 }]);
    expect(rates[0].isEstimate).toBe(true);
    expect(rates[0].isLTL).toBe(true);
    expect(rates[0].code).toBe('wwex-ltl-est');
  });

  it('handles null/undefined packages gracefully', () => {
    const rates = getLTLFallbackRates('28701', null);
    expect(rates[0].cost).toBe(199); // 0 weight, no surcharge
  });
});

// ── getLTLRates ───────────────────────────────────────────────────────────────

// Minimal valid WWEX SOAP response with one rate quote
const SOAP_RESPONSE_ONE_RATE = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RateQuoteResponse>
      <RateQuote>
        <ServiceCode>STD</ServiceCode>
        <ServiceName>Standard LTL</ServiceName>
        <TotalCharge>325.00</TotalCharge>
        <TransitDays>3</TransitDays>
      </RateQuote>
    </RateQuoteResponse>
  </soap:Body>
</soap:Envelope>`;

const SOAP_RESPONSE_TWO_RATES = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RateQuoteResponse>
      <RateQuote>
        <ServiceCode>STD</ServiceCode>
        <ServiceName>Standard LTL</ServiceName>
        <TotalCharge>325.00</TotalCharge>
        <TransitDays>3</TransitDays>
      </RateQuote>
      <RateQuote>
        <ServiceCode>GTD</ServiceCode>
        <ServiceName>Guaranteed LTL</ServiceName>
        <TotalCharge>425.00</TotalCharge>
        <TransitDays>2</TransitDays>
      </RateQuote>
    </RateQuoteResponse>
  </soap:Body>
</soap:Envelope>`;

const VALID_PACKAGES = [{ weight: 200, length: 48, width: 24, height: 6, category: 'futon-frame' }];

describe('getLTLRates — input validation', () => {
  it('returns { success: false } when originZip is missing', async () => {
    const result = await getLTLRates(null, '28701', VALID_PACKAGES);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns { success: false } when destZip is missing', async () => {
    const result = await getLTLRates('28792', null, VALID_PACKAGES);
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when packages is empty', async () => {
    const result = await getLTLRates('28792', '28701', []);
    expect(result.success).toBe(false);
  });
});

describe('getLTLRates — secret retrieval failure', () => {
  it('returns { success: false, fallback } when secrets are missing', async () => {
    // No secrets seeded — getSecret will throw
    const result = await getLTLRates('28792', '28701', VALID_PACKAGES);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.fallback).toBeDefined();
    expect(result.fallback[0].isEstimate).toBe(true);
  });
});

describe('getLTLRates — successful SOAP response', () => {
  beforeEach(() => {
    __setSecrets({
      WWEX_USERNAME: 'test-user',
      WWEX_PASSWORD: 'test-pass',
      WWEX_ACCOUNT_NUMBER: 'ACC-123',
    });
  });

  it('returns { success: true, rates } with parsed rate', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async text() { return SOAP_RESPONSE_ONE_RATE; },
    }));
    const result = await getLTLRates('28792', '28701', VALID_PACKAGES);
    expect(result.success).toBe(true);
    expect(result.rates).toHaveLength(1);
    expect(result.rates[0].cost).toBe(325);
    expect(result.rates[0].code).toBe('wwex-ltl-std');
    expect(result.rates[0].estimatedDays).toBe('3 business days');
    expect(result.rates[0].isLTL).toBe(true);
  });

  it('parses multiple rate quotes from a single SOAP response', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async text() { return SOAP_RESPONSE_TWO_RATES; },
    }));
    const result = await getLTLRates('28792', '28701', VALID_PACKAGES);
    expect(result.success).toBe(true);
    expect(result.rates).toHaveLength(2);
    expect(result.rates[0].cost).toBe(325);
    expect(result.rates[1].cost).toBe(425);
    expect(result.rates[1].code).toBe('wwex-ltl-gtd');
  });

  it('includes correct SOAP body fields in the request', async () => {
    let capturedBody = null;
    __setHandler((url, options) => {
      capturedBody = options.body;
      return { ok: true, status: 200, async text() { return SOAP_RESPONSE_ONE_RATE; } };
    });
    await getLTLRates('28792', '28701', VALID_PACKAGES);
    expect(capturedBody).toContain('<OriginZip>28792</OriginZip>');
    expect(capturedBody).toContain('<DestinationZip>28701</DestinationZip>');
    expect(capturedBody).toContain('<Username>test-user</Username>');
  });

  it('escapes XML special characters in credentials', async () => {
    __setSecrets({
      WWEX_USERNAME: 'user&name',
      WWEX_PASSWORD: 'p<ass>word',
      WWEX_ACCOUNT_NUMBER: 'ACC-123',
    });
    let capturedBody = null;
    __setHandler((url, options) => {
      capturedBody = options.body;
      return { ok: true, status: 200, async text() { return SOAP_RESPONSE_ONE_RATE; } };
    });
    await getLTLRates('28792', '28701', VALID_PACKAGES);
    expect(capturedBody).toContain('user&amp;name');
    expect(capturedBody).toContain('p&lt;ass&gt;word');
    expect(capturedBody).not.toContain('user&name');
  });
});

describe('getLTLRates — HTTP error fallback', () => {
  beforeEach(() => {
    __setSecrets({
      WWEX_USERNAME: 'u',
      WWEX_PASSWORD: 'p',
      WWEX_ACCOUNT_NUMBER: 'a',
    });
  });

  it('returns { success: false, fallback } on HTTP 500', async () => {
    __setHandler(() => ({ ok: false, status: 500, async text() { return ''; } }));
    const result = await getLTLRates('28792', '28701', VALID_PACKAGES);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/500/);
    expect(result.fallback).toBeDefined();
    expect(result.fallback[0].isEstimate).toBe(true);
  });

  it('returns { success: false, fallback } when SOAP response has no RateQuote blocks', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async text() { return '<soap:Envelope><soap:Body><Error>Service Unavailable</Error></soap:Body></soap:Envelope>'; },
    }));
    const result = await getLTLRates('28792', '28701', VALID_PACKAGES);
    expect(result.success).toBe(false);
    expect(result.fallback).toBeDefined();
  });
});

// ── NMFC freight class defaults ───────────────────────────────────────────────

describe('NMFC freight class defaults — by category', () => {
  beforeEach(() => {
    __setSecrets({ WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
  });

  const CATEGORIES = [
    { category: 'futon-frame',    expected: '150' },
    { category: 'futon-mattress', expected: '200' },
    { category: 'murphy-bed',     expected: '150' },
    { category: 'accessory',      expected: '250' },
  ];

  for (const { category, expected } of CATEGORIES) {
    it(`${category} → FreightClass ${expected} in SOAP body`, async () => {
      let capturedBody = null;
      __setHandler((url, options) => {
        capturedBody = options.body;
        return { ok: true, status: 200, async text() { return SOAP_RESPONSE_ONE_RATE; } };
      });
      await getLTLRates('28792', '28701', [{ weight: 200, length: 48, width: 24, height: 6, category }]);
      expect(capturedBody).toContain(`<FreightClass>${expected}</FreightClass>`);
    });
  }

  it('direct freightClass on package overrides category lookup', async () => {
    let capturedBody = null;
    __setHandler((url, options) => {
      capturedBody = options.body;
      return { ok: true, status: 200, async text() { return SOAP_RESPONSE_ONE_RATE; } };
    });
    // futon-frame would normally be 150 but we override with freightClass: '125'
    await getLTLRates('28792', '28701', [
      { weight: 200, length: 48, width: 24, height: 6, category: 'futon-frame', freightClass: '125' },
    ]);
    expect(capturedBody).toContain('<FreightClass>125</FreightClass>');
  });
});

// ── requiresLiftgate ──────────────────────────────────────────────────────────

describe('requiresLiftgate', () => {
  it('returns false for empty packages', () => {
    expect(requiresLiftgate([])).toBe(false);
  });

  it('returns false for null', () => {
    expect(requiresLiftgate(null)).toBe(false);
  });

  it('returns false when total weight ≤ 300 lbs and no single item > 100 lbs', () => {
    expect(requiresLiftgate([{ weight: 80 }, { weight: 80 }])).toBe(false);
  });

  it('returns true when total weight exceeds 300 lbs', () => {
    expect(requiresLiftgate([{ weight: 150 }, { weight: 160 }])).toBe(true);
  });

  it('returns true when a single item exceeds 100 lbs', () => {
    expect(requiresLiftgate([{ weight: 101 }])).toBe(true);
  });

  it('returns false at exactly 100 lbs single item', () => {
    expect(requiresLiftgate([{ weight: 100 }])).toBe(false);
  });
});

describe('requiresLiftgate — propagated to rate objects', () => {
  beforeEach(() => {
    __setSecrets({ WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
  });

  it('rate has requiresLiftgate:false for light shipment', async () => {
    __setHandler(() => ({ ok: true, status: 200, async text() { return SOAP_RESPONSE_ONE_RATE; } }));
    const result = await getLTLRates('28792', '28701', [{ weight: 80, length: 48, width: 24, height: 6 }]);
    expect(result.success).toBe(true);
    expect(result.rates[0].requiresLiftgate).toBe(false);
  });

  it('rate has requiresLiftgate:true for heavy shipment (> 300 lbs total)', async () => {
    __setHandler(() => ({ ok: true, status: 200, async text() { return SOAP_RESPONSE_ONE_RATE; } }));
    const result = await getLTLRates('28792', '28701', [{ weight: 350, length: 72, width: 36, height: 12 }]);
    expect(result.success).toBe(true);
    expect(result.rates[0].requiresLiftgate).toBe(true);
  });

  it('rate has carrier: "WWEX"', async () => {
    __setHandler(() => ({ ok: true, status: 200, async text() { return SOAP_RESPONSE_ONE_RATE; } }));
    const result = await getLTLRates('28792', '28701', VALID_PACKAGES);
    expect(result.success).toBe(true);
    expect(result.rates[0].carrier).toBe('WWEX');
  });

  it('fallback rates include requiresLiftgate and carrier fields', () => {
    const rates = getLTLFallbackRates('28701', [{ weight: 400 }]);
    expect(rates[0].requiresLiftgate).toBe(true);
    expect(rates[0].carrier).toBe('WWEX');
  });
});

// ── extractXmlValue — multiline content ───────────────────────────────────────

const SOAP_RESPONSE_MULTILINE = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RateQuoteResponse>
      <RateQuote>
        <ServiceCode>STD</ServiceCode>
        <ServiceName>Standard LTL</ServiceName>
        <TotalCharge>
          325.00
        </TotalCharge>
        <TransitDays>3</TransitDays>
      </RateQuote>
    </RateQuoteResponse>
  </soap:Body>
</soap:Envelope>`;

describe('getLTLRates — multiline SOAP response', () => {
  beforeEach(() => {
    __setSecrets({ WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
  });

  it('parses TotalCharge with surrounding whitespace/newlines', async () => {
    __setHandler(() => ({
      ok: true,
      status: 200,
      async text() { return SOAP_RESPONSE_MULTILINE; },
    }));
    const result = await getLTLRates('28792', '28701', VALID_PACKAGES);
    expect(result.success).toBe(true);
    expect(result.rates).toHaveLength(1);
    expect(result.rates[0].cost).toBe(325);
  });
});

// ── dead freightClass param removed ─────────────────────────────────────────

describe('getLTLRates — per-package FreightClass, no top-level param', () => {
  beforeEach(() => {
    __setSecrets({ WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
  });

  it('two packages with different categories get distinct FreightClass values', async () => {
    let capturedBody = null;
    __setHandler((url, options) => {
      capturedBody = options.body;
      return { ok: true, status: 200, async text() { return SOAP_RESPONSE_ONE_RATE; } };
    });
    await getLTLRates('28792', '28701', [
      { weight: 100, length: 48, width: 24, height: 6, category: 'futon-mattress' }, // class 200
      { weight: 100, length: 48, width: 24, height: 6, category: 'futon-frame' },    // class 150
    ]);
    expect(capturedBody).toContain('<FreightClass>200</FreightClass>');
    expect(capturedBody).toContain('<FreightClass>150</FreightClass>');
  });
});
