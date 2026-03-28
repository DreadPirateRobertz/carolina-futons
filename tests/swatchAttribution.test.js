/**
 * @file swatchAttribution.test.js
 * @description Tests for swatch → purchase attribution (cf-rmf2).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import {
  checkSwatchAttribution,
  getSwatchAnalytics,
  _ATTRIBUTION_WINDOW_DAYS,
} from '../src/backend/swatchAttribution.web.js';

beforeEach(() => {
  __reset();
});

const NOW = new Date();
const DAYS_AGO = (d) => new Date(NOW.getTime() - d * 24 * 60 * 60 * 1000);

// ── Attribution Check ───────────────────────────────────────────────

describe('checkSwatchAttribution', () => {
  it('attributes purchase to recent swatch request', async () => {
    __seed('SwatchRequests', [
      { _id: 'sw-1', contactEmail: 'buyer@example.com', requestedAt: DAYS_AGO(10), productSlug: 'eureka' },
    ]);
    __seed('SwatchAttributions', []);

    const result = await checkSwatchAttribution('buyer@example.com', 'order-1', 499);
    expect(result.success).toBe(true);
    expect(result.attributed).toBe(true);
    expect(result.swatchRequestId).toBe('sw-1');
    expect(result.daysToPurchase).toBeCloseTo(10, 0);

    const inserted = __getInserted('SwatchAttributions');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].orderId).toBe('order-1');
    expect(inserted[0].orderTotal).toBe(499);
  });

  it('does not attribute when no swatch request exists', async () => {
    __seed('SwatchRequests', []);
    __seed('SwatchAttributions', []);

    const result = await checkSwatchAttribution('buyer@example.com', 'order-1', 499);
    expect(result.attributed).toBe(false);
    expect(__getInserted('SwatchAttributions')).toHaveLength(0);
  });

  it('does not attribute for requests older than 90 days', async () => {
    __seed('SwatchRequests', [
      { _id: 'sw-1', contactEmail: 'buyer@example.com', requestedAt: DAYS_AGO(100) },
    ]);
    __seed('SwatchAttributions', []);

    const result = await checkSwatchAttribution('buyer@example.com', 'order-1', 499);
    expect(result.attributed).toBe(false);
  });

  it('deduplicates — second call for same email still succeeds', async () => {
    __seed('SwatchRequests', [
      { _id: 'sw-1', contactEmail: 'buyer@example.com', requestedAt: DAYS_AGO(5) },
    ]);
    __seed('SwatchAttributions', []);

    // First attribution
    const first = await checkSwatchAttribution('buyer@example.com', 'order-1', 499);
    expect(first.attributed).toBe(true);

    // Second call with different order still works (different order)
    const second = await checkSwatchAttribution('buyer@example.com', 'order-2', 299);
    expect(second.attributed).toBe(true);
  });

  it('normalizes email to lowercase', async () => {
    __seed('SwatchRequests', [
      { _id: 'sw-1', contactEmail: 'buyer@example.com', requestedAt: DAYS_AGO(3) },
    ]);
    __seed('SwatchAttributions', []);

    const result = await checkSwatchAttribution('Buyer@Example.COM', 'order-2', 299);
    expect(result.attributed).toBe(true);
  });

  it('handles missing email gracefully', async () => {
    const result = await checkSwatchAttribution('', 'order-1', 499);
    expect(result.success).toBe(false);
  });

  it('logs to AuditLog on attribution', async () => {
    __seed('SwatchRequests', [
      { _id: 'sw-1', contactEmail: 'buyer@example.com', requestedAt: DAYS_AGO(7) },
    ]);
    __seed('SwatchAttributions', []);

    await checkSwatchAttribution('buyer@example.com', 'order-1', 499);
    const audits = __getInserted('AuditLog');
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('attributed');
  });
});

// ── Analytics ────────────────────────────────────────────────────────

describe('getSwatchAnalytics', () => {
  it('computes conversion rate and avg days', async () => {
    __seed('SwatchRequests', [
      { requestedAt: DAYS_AGO(30) },
      { requestedAt: DAYS_AGO(20) },
      { requestedAt: DAYS_AGO(10) },
      { requestedAt: DAYS_AGO(5) },
    ]);
    __seed('SwatchAttributions', [
      { purchaseDate: DAYS_AGO(20), daysToPurchase: 10, orderTotal: 499 },
      { purchaseDate: DAYS_AGO(2), daysToPurchase: 8, orderTotal: 699 },
    ]);

    const result = await getSwatchAnalytics(90);
    expect(result.success).toBe(true);
    expect(result.analytics.totalRequests).toBe(4);
    expect(result.analytics.totalAttributed).toBe(2);
    expect(result.analytics.conversionRate).toBe(50);
    expect(result.analytics.avgDaysToPurchase).toBe(9);
    expect(result.analytics.totalRevenue).toBe(1198);
    expect(result.analytics.avgOrderValue).toBe(599);
  });

  it('returns distribution buckets', async () => {
    __seed('SwatchRequests', []);
    __seed('SwatchAttributions', [
      { purchaseDate: NOW, daysToPurchase: 3, orderTotal: 100 },
      { purchaseDate: NOW, daysToPurchase: 12, orderTotal: 200 },
      { purchaseDate: NOW, daysToPurchase: 45, orderTotal: 300 },
    ]);

    const result = await getSwatchAnalytics(90);
    expect(result.analytics.distribution['0-7']).toBe(1);
    expect(result.analytics.distribution['8-14']).toBe(1);
    expect(result.analytics.distribution['31-60']).toBe(1);
  });

  it('handles zero requests', async () => {
    __seed('SwatchRequests', []);
    __seed('SwatchAttributions', []);

    const result = await getSwatchAnalytics(90);
    expect(result.analytics.conversionRate).toBe(0);
    expect(result.analytics.avgDaysToPurchase).toBe(0);
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('swatch attribution constants', () => {
  it('attribution window is 90 days', () => {
    expect(_ATTRIBUTION_WINDOW_DAYS).toBe(90);
  });
});
