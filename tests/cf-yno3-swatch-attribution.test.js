/**
 * @file cf-yno3-swatch-attribution.test.js
 * @description CF-yno3: Swatch → purchase attribution tracking.
 *
 * Covers:
 *  - checkSwatchAttribution: records attribution when swatch in window
 *  - checkSwatchAttribution: no attribution when no swatch request
 *  - checkSwatchAttribution: no attribution when swatch outside 90-day window
 *  - checkSwatchAttribution: dedup — does not double-record same orderId
 *  - checkSwatchAttribution: rejects invalid email
 *  - checkSwatchAttribution: rejects missing orderId
 *  - getSwatchAnalytics: returns totals, conversionRate, avgDaysToPurchase
 *  - getSwatchAnalytics: conversionRate = 0 when no swatch requests
 *  - getSwatchAnalytics: clamps lookback to [1, 365]
 *  - getSwatchAnalytics: distribution buckets correct
 *  - events.js wixEcom_onOrderCreated calls checkSwatchAttribution
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __onInsert, __seed, __getCollection } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';

beforeEach(() => {
  __reset();
  __resetSecrets();
  vi.clearAllMocks();
});

import {
  checkSwatchAttribution,
  getSwatchAnalytics,
  _ATTRIBUTION_WINDOW_DAYS,
} from '../src/backend/swatchAttribution.web.js';

const BUYER_EMAIL = 'buyer@test.com';

function makeSwatchRequest(overrides = {}) {
  return {
    _id: 'sr-1',
    contactEmail: BUYER_EMAIL,
    requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    productSlug: 'mocha-linen-sofa',
    swatchNames: ['Mocha Linen'],
    ...overrides,
  };
}

// ── checkSwatchAttribution ─────────────────────────────────────────────

describe('checkSwatchAttribution', () => {
  it('records attribution and returns attributed:true when swatch in window', async () => {
    __seed('SwatchRequests', [makeSwatchRequest()]);
    const inserts = [];
    __onInsert((col, item) => { if (col === 'SwatchAttributions') inserts.push(item); });

    const result = await checkSwatchAttribution(BUYER_EMAIL, 'order-1', 299.99);

    expect(result.success).toBe(true);
    expect(result.attributed).toBe(true);
    expect(result.swatchRequestId).toBe('sr-1');
    expect(typeof result.daysToPurchase).toBe('number');
    expect(result.daysToPurchase).toBeGreaterThanOrEqual(10);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].orderId).toBe('order-1');
    expect(inserts[0].email).toBe(BUYER_EMAIL);
    expect(inserts[0].orderTotal).toBe(299.99);
  });

  it('returns attributed:false when no swatch request found', async () => {
    __seed('SwatchRequests', []);

    const result = await checkSwatchAttribution(BUYER_EMAIL, 'order-2', 100);

    expect(result.success).toBe(true);
    expect(result.attributed).toBe(false);
    expect(result.swatchRequestId).toBeNull();
    expect(result.daysToPurchase).toBeNull();
  });

  it('returns attributed:false when swatch is outside 90-day window', async () => {
    const oldRequest = makeSwatchRequest({
      requestedAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
    });
    __seed('SwatchRequests', [oldRequest]);

    const result = await checkSwatchAttribution(BUYER_EMAIL, 'order-3', 200);

    expect(result.attributed).toBe(false);
  });

  it('deduplicates — does not insert if orderId already attributed', async () => {
    __seed('SwatchRequests', [makeSwatchRequest()]);
    __seed('SwatchAttributions', [{ orderId: 'order-dup' }]);
    const inserts = [];
    __onInsert((col, item) => { if (col === 'SwatchAttributions') inserts.push(item); });

    const result = await checkSwatchAttribution(BUYER_EMAIL, 'order-dup', 150);

    expect(result.attributed).toBe(true);
    expect(inserts).toHaveLength(0); // no new insert
  });

  it('returns failure when email is empty', async () => {
    const result = await checkSwatchAttribution('', 'order-5', 100);
    expect(result.success).toBe(false);
    expect(result.attributed).toBe(false);
  });

  it('returns failure when orderId is missing', async () => {
    const result = await checkSwatchAttribution(BUYER_EMAIL, '', 100);
    expect(result.success).toBe(false);
    expect(result.attributed).toBe(false);
  });

  it('stores productSlug from swatch request', async () => {
    __seed('SwatchRequests', [makeSwatchRequest({ productSlug: 'espresso-futon' })]);
    const inserts = [];
    __onInsert((col, item) => { if (col === 'SwatchAttributions') inserts.push(item); });

    await checkSwatchAttribution(BUYER_EMAIL, 'order-slug', 200);

    expect(inserts[0].productSlug).toBe('espresso-futon');
  });

  it('normalises email to lowercase before matching', async () => {
    __seed('SwatchRequests', [makeSwatchRequest({ contactEmail: 'buyer@test.com' })]);
    const inserts = [];
    __onInsert((col, item) => { if (col === 'SwatchAttributions') inserts.push(item); });

    const result = await checkSwatchAttribution('BUYER@TEST.COM', 'order-case', 100);

    expect(result.attributed).toBe(true);
    expect(inserts[0].email).toBe('buyer@test.com');
  });
});

// ── getSwatchAnalytics ─────────────────────────────────────────────────

describe('getSwatchAnalytics', () => {
  it('returns conversionRate and avgDaysToPurchase', async () => {
    __seed('SwatchRequests', [makeSwatchRequest(), makeSwatchRequest({ _id: 'sr-2' })]);
    __seed('SwatchAttributions', [
      { orderId: 'o1', daysToPurchase: 5, orderTotal: 300, purchaseDate: new Date() },
    ]);

    const result = await getSwatchAnalytics(90);

    expect(result.success).toBe(true);
    expect(result.analytics.totalRequests).toBe(2);
    expect(result.analytics.totalAttributed).toBe(1);
    expect(result.analytics.conversionRate).toBe(50);
    expect(result.analytics.avgDaysToPurchase).toBe(5);
    expect(result.analytics.totalRevenue).toBe(300);
  });

  it('returns conversionRate = 0 when no swatch requests', async () => {
    __seed('SwatchRequests', []);
    __seed('SwatchAttributions', []);

    const result = await getSwatchAnalytics(90);

    expect(result.analytics.conversionRate).toBe(0);
    expect(result.analytics.totalRequests).toBe(0);
  });

  it('clamps lookback to minimum 1 day', async () => {
    __seed('SwatchRequests', []);
    __seed('SwatchAttributions', []);

    const result = await getSwatchAnalytics(-5);
    expect(result.success).toBe(true);
    expect(result.analytics.period).toBe(1);
  });

  it('clamps lookback to maximum 365 days', async () => {
    __seed('SwatchRequests', []);
    __seed('SwatchAttributions', []);

    const result = await getSwatchAnalytics(999);
    expect(result.analytics.period).toBe(365);
  });

  it('places attributions in correct distribution buckets', async () => {
    __seed('SwatchRequests', []);
    __seed('SwatchAttributions', [
      { orderId: 'a', daysToPurchase: 3, orderTotal: 100, purchaseDate: new Date() },
      { orderId: 'b', daysToPurchase: 10, orderTotal: 100, purchaseDate: new Date() },
      { orderId: 'c', daysToPurchase: 20, orderTotal: 100, purchaseDate: new Date() },
      { orderId: 'd', daysToPurchase: 45, orderTotal: 100, purchaseDate: new Date() },
      { orderId: 'e', daysToPurchase: 80, orderTotal: 100, purchaseDate: new Date() },
    ]);

    const result = await getSwatchAnalytics(90);

    expect(result.analytics.distribution['0-7']).toBe(1);
    expect(result.analytics.distribution['8-14']).toBe(1);
    expect(result.analytics.distribution['15-30']).toBe(1);
    expect(result.analytics.distribution['31-60']).toBe(1);
    expect(result.analytics.distribution['61-90']).toBe(1);
  });

  it('defaults to 90-day lookback when called with no argument', async () => {
    __seed('SwatchRequests', []);
    __seed('SwatchAttributions', []);

    const result = await getSwatchAnalytics();
    expect(result.analytics.period).toBe(90);
  });
});

// ── Constants ──────────────────────────────────────────────────────────

describe('attribution window', () => {
  it('_ATTRIBUTION_WINDOW_DAYS is 90', () => {
    expect(_ATTRIBUTION_WINDOW_DAYS).toBe(90);
  });
});

// ── events.js wiring ───────────────────────────────────────────────────

describe('events.js wixEcom_onOrderCreated wires attribution', () => {
  it('calls checkSwatchAttribution when order is created', async () => {
    const { wixEcom_onOrderCreated } = await import('../src/backend/events.js');

    const inserts = [];
    __seed('SwatchRequests', [makeSwatchRequest()]);
    __onInsert((col, item) => { if (col === 'SwatchAttributions') inserts.push(item); });

    const event = {
      entity: {
        buyerInfo: { email: BUYER_EMAIL, contactId: 'c-1', memberId: 'm-1' },
        billingInfo: { firstName: 'Sam' },
        number: 'W-999',
        priceSummary: { total: { amount: 350 } },
        lineItems: [],
      },
    };

    await wixEcom_onOrderCreated(event);

    expect(inserts.some(i => i.orderId === 'W-999')).toBe(true);
  });

  it('does not throw when buyer email is missing', async () => {
    const { wixEcom_onOrderCreated } = await import('../src/backend/events.js');

    const event = {
      entity: {
        buyerInfo: { email: '', contactId: '', memberId: '' },
        number: 'W-empty',
        priceSummary: { total: { amount: 0 } },
        lineItems: [],
      },
    };

    await expect(wixEcom_onOrderCreated(event)).resolves.not.toThrow();
  });
});
