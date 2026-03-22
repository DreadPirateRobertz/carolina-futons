/**
 * @file shippingIntelligence.test.js
 * @description Unit tests for shippingIntelligence.web.js — product-page and bundle
 * shipping estimate webMethods.
 *
 * Covers:
 *  - getShippingEstimate: input validation, UPS routing, LTL routing, local zone appended
 *  - calculateBundleQuote: input validation, multi-item aggregation, subtotal affects free delivery
 *  - buildShippingResponse: UPS path, LTL path, WWEX fallback, empty options guard
 *  - _resolveProfile: CMS hit, CMS miss → null, null productId → null, query error → null
 *  - _routeToCarrier: weight thresholds, requiresPallet, requiresFreight flags
 *  - Response shape: cost (number), estimatedDelivery, carrier, requiresLiftgate on all options
 *  - ZIP edge cases: PR, GU, 4-digit, 6-digit, alpha
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset as resetWixData,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';
import {
  __reset as resetMembers,
  __setMember,
} from './__mocks__/wix-members-backend.js';

// Mock the carrier webMethods before importing the module under test
vi.mock('backend/ups-shipping.web', () => ({
  getUPSRates: vi.fn().mockResolvedValue([
    {
      code: 'ups-ground',
      title: 'UPS Ground',
      cost: 49.99,
      currency: 'USD',
      estimatedDelivery: '5-7 business days',
      isEstimate: false,
    },
  ]),
  getPackageDimensions: vi.fn().mockResolvedValue({
    length: 72, width: 24, height: 6, weight: 80,
  }),
}));

vi.mock('backend/wwex-freight.web', () => ({
  shouldUseLTL: vi.fn().mockReturnValue(false),
  getLTLRates: vi.fn().mockResolvedValue({ success: true, rates: [
    { code: 'wwex-ltl-std', title: '🚛 Standard LTL', cost: 299, currency: 'USD', estimatedDays: '5-7 business days', icon: '🚛', badge: null, upsellMessage: null, isLTL: true, isEstimate: false },
  ]}),
  getLTLFallbackRates: vi.fn().mockReturnValue([
    { code: 'wwex-ltl-est', title: '🚛 LTL Freight (Estimated)', cost: 199, currency: 'USD', estimatedDays: '5-10 business days', icon: '🚛', badge: null, upsellMessage: null, isLTL: true, isEstimate: true },
  ]),
  LTL_THRESHOLDS: { maxParcelWeightLbs: 150, maxParcelLengthIn: 108, minLTLWeightLbs: 100 },
}));

import { getShippingEstimate, calculateBundleQuote, _resolveProfile, _routeToCarrier } from '../src/backend/shippingIntelligence.web.js';
import { shouldUseLTL, getLTLRates, getLTLFallbackRates } from '../src/backend/wwex-freight.web.js';
import { getUPSRates, getPackageDimensions } from '../src/backend/ups-shipping.web.js';

beforeEach(() => {
  resetWixData();
  resetMembers();
  vi.clearAllMocks();
  // Default: not LTL
  shouldUseLTL.mockReturnValue(false);
  getLTLRates.mockResolvedValue({ success: true, rates: [
    { code: 'wwex-ltl-std', title: '🚛 Standard LTL', cost: 299, currency: 'USD', estimatedDays: '5-7 business days', icon: '🚛', badge: null, upsellMessage: null, isLTL: true, isEstimate: false },
  ]});
  getLTLFallbackRates.mockReturnValue([
    { code: 'wwex-ltl-est', title: '🚛 LTL Freight (Estimated)', cost: 199, currency: 'USD', estimatedDays: '5-10 business days', icon: '🚛', badge: null, upsellMessage: null, isLTL: true, isEstimate: true },
  ]);
  getUPSRates.mockResolvedValue([
    { code: 'ups-ground', title: 'UPS Ground', cost: 49.99, currency: 'USD', estimatedDelivery: '5-7 business days', isEstimate: false },
  ]);
  getPackageDimensions.mockResolvedValue({ length: 72, width: 24, height: 6, weight: 80 });
});

// ── getShippingEstimate — input validation ─────────────────────────────────────

describe('getShippingEstimate — input validation', () => {
  it('returns { success: false } when productId is missing', async () => {
    const result = await getShippingEstimate(null, '28701');
    expect(result.success).toBe(false);
    expect(result.options).toEqual([]);
  });

  it('returns { success: false } when zip is missing', async () => {
    const result = await getShippingEstimate('prod-1', null);
    expect(result.success).toBe(false);
  });

  it('returns { success: false } for non-5-digit zip', async () => {
    const result = await getShippingEstimate('prod-1', '287');
    expect(result.success).toBe(false);
  });

  it('returns { success: false } for 6-digit zip', async () => {
    const result = await getShippingEstimate('prod-1', '287010');
    expect(result.success).toBe(false);
  });
});

// ── getShippingEstimate — UPS parcel path ─────────────────────────────────────

describe('getShippingEstimate — UPS parcel path', () => {
  it('returns success:true with UPS option when shouldUseLTL is false', async () => {
    shouldUseLTL.mockReturnValue(false);
    const result = await getShippingEstimate('prod-1', '10001'); // non-local zip
    expect(result.success).toBe(true);
    const upsCodes = result.options.map(o => o.code);
    expect(upsCodes.some(c => c.includes('ups'))).toBe(true);
  });

  it('calls getUPSRates with the provided zip', async () => {
    await getShippingEstimate('prod-1', '10001');
    expect(getUPSRates).toHaveBeenCalledWith(
      expect.objectContaining({ postalCode: '10001', country: 'US' }),
      expect.any(Array),
      expect.any(Number)
    );
  });

  it('uses ProductShippingProfiles CMS record for dimensions when available', async () => {
    __seed('ProductShippingProfiles', [{
      _id: 'psp-1', productId: 'prod-murphy', productName: 'Murphy Bed', category: 'murphy-bed',
      length: 84, width: 36, height: 12, weight: 250,
    }]);
    await getShippingEstimate('prod-murphy', '10001');
    // getPackageDimensions should NOT be called when profile provides dims
    expect(getPackageDimensions).not.toHaveBeenCalled();
  });

  it('falls back to getPackageDimensions when no CMS profile exists', async () => {
    await getShippingEstimate('prod-unknown', '10001');
    expect(getPackageDimensions).toHaveBeenCalled();
  });
});

// ── getShippingEstimate — LTL path ────────────────────────────────────────────

describe('getShippingEstimate — LTL path', () => {
  it('routes to WWEX LTL when shouldUseLTL returns true', async () => {
    shouldUseLTL.mockReturnValue(true);
    const result = await getShippingEstimate('prod-1', '10001');
    expect(result.success).toBe(true);
    expect(getLTLRates).toHaveBeenCalled();
    expect(getUPSRates).not.toHaveBeenCalled();
    const codes = result.options.map(o => o.code);
    expect(codes.some(c => c.includes('wwex'))).toBe(true);
  });

  it('uses WWEX fallback rates when getLTLRates returns success:false', async () => {
    shouldUseLTL.mockReturnValue(true);
    getLTLRates.mockResolvedValue({ success: false, error: 'WWEX down' });
    const result = await getShippingEstimate('prod-1', '10001');
    expect(result.success).toBe(true);
    expect(getLTLFallbackRates).toHaveBeenCalled();
    const codes = result.options.map(o => o.code);
    expect(codes.some(c => c.includes('wwex'))).toBe(true);
  });

  it('LTL options have isLTL:true', async () => {
    shouldUseLTL.mockReturnValue(true);
    const result = await getShippingEstimate('prod-1', '10001');
    const ltlOptions = result.options.filter(o => o.isLTL);
    expect(ltlOptions.length).toBeGreaterThan(0);
  });
});

// ── getShippingEstimate — local zone appended ─────────────────────────────────

describe('getShippingEstimate — local zone options', () => {
  it('appends local delivery option for a WNC zip (28701)', async () => {
    const result = await getShippingEstimate('prod-1', '28701');
    expect(result.success).toBe(true);
    const codes = result.options.map(o => o.code);
    expect(codes.some(c => c.startsWith('local-delivery-'))).toBe(true);
  });

  it('appends white-glove option for a WNC zip', async () => {
    const result = await getShippingEstimate('prod-1', '28701');
    const codes = result.options.map(o => o.code);
    expect(codes.some(c => c.startsWith('white-glove-'))).toBe(true);
  });

  it('does not append local delivery for a non-SE zip (10001 NY)', async () => {
    const result = await getShippingEstimate('prod-1', '10001');
    const codes = result.options.map(o => o.code);
    expect(codes.some(c => c.startsWith('local-delivery-'))).toBe(false);
  });
});

// ── calculateBundleQuote — input validation ───────────────────────────────────

describe('calculateBundleQuote — input validation', () => {
  it('returns { success: false } when items is empty', async () => {
    const result = await calculateBundleQuote([], '28701');
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when items is null', async () => {
    const result = await calculateBundleQuote(null, '28701');
    expect(result.success).toBe(false);
  });

  it('returns { success: false } when zip is invalid', async () => {
    const result = await calculateBundleQuote([{ productId: 'p1', quantity: 1 }], 'bad-zip');
    expect(result.success).toBe(false);
  });
});

// ── calculateBundleQuote — multi-item aggregation ─────────────────────────────

describe('calculateBundleQuote — multi-item aggregation', () => {
  it('returns { success: true, options } for a valid single-item bundle', async () => {
    const result = await calculateBundleQuote(
      [{ productId: 'p1', quantity: 1, price: 299 }],
      '10001'
    );
    expect(result.success).toBe(true);
    expect(result.options.length).toBeGreaterThan(0);
  });

  it('calls getPackageDimensions for each item', async () => {
    await calculateBundleQuote(
      [
        { productId: 'p1', quantity: 1, price: 100 },
        { productId: 'p2', quantity: 1, price: 200 },
      ],
      '10001'
    );
    expect(getPackageDimensions).toHaveBeenCalledTimes(2);
  });

  it('expands packages by quantity (qty=2 → 2 packages)', async () => {
    await calculateBundleQuote(
      [{ productId: 'p1', quantity: 2, price: 100 }],
      '10001'
    );
    // getUPSRates should receive 2 packages
    const [, packages] = getUPSRates.mock.calls[0];
    expect(packages).toHaveLength(2);
  });

  it('passes accumulated orderSubtotal to getUPSRates', async () => {
    await calculateBundleQuote(
      [
        { productId: 'p1', quantity: 2, price: 100 },  // 200
        { productId: 'p2', quantity: 1, price: 50 },   // 50
      ],
      '10001'
    );
    const [, , orderSubtotal] = getUPSRates.mock.calls[0];
    expect(orderSubtotal).toBe(250);
  });
});

// ── _resolveProfile ────────────────────────────────────────────────────────────

describe('_resolveProfile', () => {
  it('returns CMS record when productId matches', async () => {
    __seed('ProductShippingProfiles', [
      { productId: 'prod-abc', weight_lbs: 45, length_in: 72, width_in: 24, height_in: 6 },
    ]);
    const profile = await _resolveProfile('prod-abc');
    expect(profile).not.toBeNull();
    expect(profile.weight_lbs).toBe(45);
  });

  it('returns null when productId has no matching CMS record', async () => {
    __seed('ProductShippingProfiles', []);
    const profile = await _resolveProfile('nonexistent-prod');
    expect(profile).toBeNull();
  });

  it('returns null when productId is null', async () => {
    const profile = await _resolveProfile(null);
    expect(profile).toBeNull();
  });

  it('returns null when productId is undefined', async () => {
    const profile = await _resolveProfile(undefined);
    expect(profile).toBeNull();
  });

  it('returns null (and warns) when CMS query throws', async () => {
    __setQueryError('ProductShippingProfiles', new Error('CMS unavailable'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const profile = await _resolveProfile('prod-abc');
    expect(profile).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('ProductShippingProfiles lookup failed'),
      'prod-abc',
      expect.any(String)
    );
    warnSpy.mockRestore();
  });

  it('returns first item only when multiple records match', async () => {
    __seed('ProductShippingProfiles', [
      { productId: 'prod-dup', weight_lbs: 10 },
      { productId: 'prod-dup', weight_lbs: 99 },
    ]);
    const profile = await _resolveProfile('prod-dup');
    expect(profile.weight_lbs).toBe(10);
  });
});

// ── _routeToCarrier ────────────────────────────────────────────────────────────

describe('_routeToCarrier', () => {
  it('returns "ups" for weight under 150 lbs with no flags', () => {
    expect(_routeToCarrier(100, [{}])).toBe('ups');
  });

  it('returns "ups" for weight exactly 150 lbs', () => {
    expect(_routeToCarrier(150, [{}])).toBe('ups');
  });

  it('returns "ltl" for weight over 150 lbs', () => {
    expect(_routeToCarrier(151, [{}])).toBe('ltl');
  });

  it('returns "ltl" when any profile has requiresPallet=true', () => {
    expect(_routeToCarrier(50, [{ requiresPallet: true }])).toBe('ltl');
  });

  it('returns "ltl" when any profile has requiresFreight=true', () => {
    expect(_routeToCarrier(50, [{ requiresFreight: true }])).toBe('ltl');
  });

  it('returns "ltl" when requiresPallet is on one of many profiles', () => {
    expect(_routeToCarrier(80, [{ requiresPallet: false }, { requiresPallet: true }])).toBe('ltl');
  });

  it('returns "ups" for empty profiles array below threshold', () => {
    expect(_routeToCarrier(100, [])).toBe('ups');
  });

  it('returns "ups" when profiles is array of nulls', () => {
    expect(_routeToCarrier(100, [null, null])).toBe('ups');
  });
});

// ── Response shape — cost / estimatedDelivery / carrier / requiresLiftgate ─────

describe('UPS option response shape', () => {
  it('includes cost as a number (not just price string)', async () => {
    shouldUseLTL.mockReturnValue(false);
    const result = await getShippingEstimate('prod-1', '10001');
    expect(result.success).toBe(true);
    const upsOpt = result.options.find(o => o.carrier === 'UPS');
    expect(upsOpt).toBeDefined();
    expect(typeof upsOpt.cost).toBe('number');
    expect(upsOpt.cost).toBe(49.99);
  });

  it('includes estimatedDelivery string on UPS options', async () => {
    shouldUseLTL.mockReturnValue(false);
    const result = await getShippingEstimate('prod-1', '10001');
    const upsOpt = result.options.find(o => o.carrier === 'UPS');
    expect(upsOpt.estimatedDelivery).toBe('5-7 business days');
  });

  it('includes carrier="UPS" on parcel options', async () => {
    shouldUseLTL.mockReturnValue(false);
    const result = await getShippingEstimate('prod-1', '10001');
    const upsOpt = result.options.find(o => o.code === 'ups-ground');
    expect(upsOpt.carrier).toBe('UPS');
  });

  it('includes requiresLiftgate=false on UPS parcel options', async () => {
    shouldUseLTL.mockReturnValue(false);
    const result = await getShippingEstimate('prod-1', '10001');
    const upsOpt = result.options.find(o => o.carrier === 'UPS');
    expect(upsOpt.requiresLiftgate).toBe(false);
  });
});

describe('LTL option response shape', () => {
  it('includes cost as a number on LTL options', async () => {
    shouldUseLTL.mockReturnValue(true);
    const result = await getShippingEstimate('prod-heavy', '10001');
    expect(result.success).toBe(true);
    const ltlOpt = result.options.find(o => o.isLTL);
    expect(typeof ltlOpt.cost).toBe('number');
    expect(ltlOpt.cost).toBe(299);
  });

  it('includes carrier="WWEX" on LTL options', async () => {
    shouldUseLTL.mockReturnValue(true);
    const result = await getShippingEstimate('prod-heavy', '10001');
    const ltlOpt = result.options.find(o => o.isLTL);
    expect(ltlOpt.carrier).toBe('WWEX');
  });

  it('includes requiresLiftgate=true on LTL options (default)', async () => {
    shouldUseLTL.mockReturnValue(true);
    const result = await getShippingEstimate('prod-heavy', '10001');
    const ltlOpt = result.options.find(o => o.isLTL);
    expect(ltlOpt.requiresLiftgate).toBe(true);
  });

  it('includes estimatedDelivery string on LTL options', async () => {
    shouldUseLTL.mockReturnValue(true);
    const result = await getShippingEstimate('prod-heavy', '10001');
    const ltlOpt = result.options.find(o => o.isLTL);
    expect(ltlOpt.estimatedDelivery).toBe('5-7 business days');
  });
});

describe('local delivery option response shape', () => {
  it('includes carrier="Carolina Futons" on local delivery option', async () => {
    shouldUseLTL.mockReturnValue(false);
    // NC zip → local zone
    const result = await getShippingEstimate('prod-1', '28701');
    const localOpt = result.options.find(o => o.code && o.code.startsWith('local-delivery-'));
    expect(localOpt).toBeDefined();
    expect(localOpt.carrier).toBe('Carolina Futons');
  });

  it('includes carrier="Carolina Futons" on white glove option', async () => {
    shouldUseLTL.mockReturnValue(false);
    const result = await getShippingEstimate('prod-1', '28701');
    const wgOpt = result.options.find(o => o.code && o.code.startsWith('white-glove-'));
    expect(wgOpt).toBeDefined();
    expect(wgOpt.carrier).toBe('Carolina Futons');
  });

  it('includes requiresLiftgate=false on local options', async () => {
    shouldUseLTL.mockReturnValue(false);
    const result = await getShippingEstimate('prod-1', '28701');
    const localOpts = result.options.filter(o => o.carrier === 'Carolina Futons');
    expect(localOpts.length).toBeGreaterThan(0);
    localOpts.forEach(o => expect(o.requiresLiftgate).toBe(false));
  });
});

// ── ZIP edge cases ─────────────────────────────────────────────────────────────

describe('getShippingEstimate — ZIP edge cases', () => {
  it('rejects 4-digit ZIP', async () => {
    const result = await getShippingEstimate('prod-1', '2870');
    expect(result.success).toBe(false);
  });

  it('rejects alpha ZIP', async () => {
    const result = await getShippingEstimate('prod-1', 'ABCDE');
    expect(result.success).toBe(false);
  });

  it('accepts PR ZIP 00900 (5-digit numeric, no local zone)', async () => {
    shouldUseLTL.mockReturnValue(false);
    const result = await getShippingEstimate('prod-1', '00900');
    expect(result.success).toBe(true);
    // No local zone for PR
    expect(result.options.some(o => o.carrier === 'Carolina Futons')).toBe(false);
  });
});
