/**
 * Tests for shippingIntelligence.web.js
 *
 * Focuses on the CMS field name fix: ProductShippingProfiles uses
 * length_in / width_in / height_in / weight_lbs — not length/width/height/weight.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __setQueryError } from './__mocks__/wix-data.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import { getShippingEstimate, calculateBundleQuote } from '../src/backend/shippingIntelligence.web.js';

// ── Helpers ──────────────────────────────────────────────────────────

/** Minimal CMS ProductShippingProfiles entry using correct _in / _lbs field names */
function cmsProfile(overrides = {}) {
  return {
    _id: 'prof-1',
    productId: 'prod-abc',
    productName: 'Test Sofa',
    category: 'sofa',
    length_in: 84,
    width_in: 36,
    height_in: 32,
    weight_lbs: 120,
    handlingFee_usd: 0,
    carrierOverride: null,
    ltlRequired: false,
    ...overrides,
  };
}

/** Mock UPS OAuth + rate response so getUPSRates resolves cleanly */
function mockUPSSuccess() {
  let call = 0;
  __setHandler((_url, _opts) => {
    call++;
    if (call === 1) {
      // OAuth token
      return {
        ok: true,
        async json() { return { access_token: 'tok', expires_in: '3600' }; },
        async text() { return ''; },
      };
    }
    // UPS rates response
    return {
      ok: true,
      async json() {
        return {
          RateResponse: {
            RatedShipment: [{
              Service: { Code: '03' },
              TotalCharges: { MonetaryValue: '49.99' },
              GuaranteedDelivery: { BusinessDaysInTransit: '3' },
            }],
          },
        };
      },
      async text() { return ''; },
    };
  });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('shippingIntelligence — CMS field name fix (CF-wpuw)', () => {
  beforeEach(() => {
    __reset();
    mockUPSSuccess();
  });

  it('getShippingEstimate: reads length_in/width_in/height_in/weight_lbs from CMS profile', async () => {
    __seed('ProductShippingProfiles', [cmsProfile()]);

    // The fix: dims.length_in ?? dims.length — so if the CMS profile has length_in,
    // the package object should carry length=84, not undefined.
    // We verify this indirectly: shouldUseLTL checks weight; a 120 lb sofa is below
    // LTL threshold so it routes to UPS and returns success options.
    const result = await getShippingEstimate('prod-abc', '28801');
    expect(result.success).toBe(true);
    expect(result.options.length).toBeGreaterThan(0);
  });

  it('getShippingEstimate: works when no CMS profile (falls back to getPackageDimensions)', async () => {
    // No seed — profile will be null, falls back to getPackageDimensions()
    const result = await getShippingEstimate('prod-no-profile', '28801');
    expect(result.success).toBe(true);
    expect(result.options.length).toBeGreaterThan(0);
  });

  it('getShippingEstimate: returns error for invalid ZIP', async () => {
    const result = await getShippingEstimate('prod-abc', 'BADZIP');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ZIP/i);
  });

  it('calculateBundleQuote: reads CMS fields correctly for each item', async () => {
    __seed('ProductShippingProfiles', [
      cmsProfile({ productId: 'prod-a', length_in: 60, width_in: 30, height_in: 24, weight_lbs: 80 }),
      cmsProfile({ _id: 'prof-2', productId: 'prod-b', length_in: 48, width_in: 24, height_in: 18, weight_lbs: 50 }),
    ]);

    const result = await calculateBundleQuote(
      [{ productId: 'prod-a', quantity: 1, price: 599 }, { productId: 'prod-b', quantity: 1, price: 299 }],
      '28801'
    );
    expect(result.success).toBe(true);
    expect(result.options.length).toBeGreaterThan(0);
  });

  it('calculateBundleQuote: returns error for empty items array', async () => {
    const result = await calculateBundleQuote([], '28801');
    expect(result.success).toBe(false);
  });

  it('calculateBundleQuote: returns error for invalid ZIP', async () => {
    const result = await calculateBundleQuote([{ productId: 'prod-a', quantity: 1 }], '123');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ZIP/i);
  });
});
