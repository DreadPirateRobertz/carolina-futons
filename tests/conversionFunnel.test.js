/**
 * @file conversionFunnel.test.js
 * @description TDD tests for conversionFunnel.web.js — Wave 32, CF-wave32 blaidd
 *
 * Covers:
 *  - FUNNEL_STAGES constant
 *  - trackFunnelEvent: inserts, dedup, validation, error handling
 *  - getFunnelReport: stage counts, drop-off rates, overall conversion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __setInsertError,
  __setQueryError,
  __setUniqueField,
} from './__mocks__/wix-data.js';

vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
}));

import { checkRateLimit } from '../src/backend/utils/rateLimit.js';

import {
  trackFunnelEvent,
  getFunnelReport,
  FUNNEL_STAGES,
} from '../src/backend/conversionFunnel.web.js';

beforeEach(() => __reset());

const NOW = new Date();
const YESTERDAY = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
const TWO_DAYS_AGO = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000);

const BASE = { sessionId: 'sess-abc', productId: 'prod-1' };

// ── FUNNEL_STAGES ──────────────────────────────────────────────────

describe('FUNNEL_STAGES', () => {
  it('contains 5 stages in the correct pipeline order', () => {
    expect(FUNNEL_STAGES).toEqual([
      'page_view', 'product_view', 'add_to_cart', 'checkout_start', 'purchase',
    ]);
  });
});

// ── trackFunnelEvent ───────────────────────────────────────────────

describe('trackFunnelEvent', () => {
  it('inserts a FunnelEvents record for a valid stage', async () => {
    const result = await trackFunnelEvent('product_view', BASE);
    expect(result.success).toBe(true);
    const rows = __getInserted('FunnelEvents');
    expect(rows).toHaveLength(1);
    expect(rows[0].stage).toBe('product_view');
    expect(rows[0].sessionId).toBe('sess-abc');
  });

  it('uses sessionId_stage as _id for idempotent dedup', async () => {
    await trackFunnelEvent('add_to_cart', BASE);
    const rows = __getInserted('FunnelEvents');
    expect(rows[0]._id).toBe('sess-abc_add_to_cart');
  });

  it('stores productId', async () => {
    await trackFunnelEvent('product_view', BASE);
    expect(__getInserted('FunnelEvents')[0].productId).toBe('prod-1');
  });

  it('stores memberId when provided', async () => {
    await trackFunnelEvent('page_view', { ...BASE, memberId: 'mem-1' });
    expect(__getInserted('FunnelEvents')[0].memberId).toBe('mem-1');
  });

  it('stores experimentId and variantId when provided', async () => {
    await trackFunnelEvent('add_to_cart', { ...BASE, experimentId: 'exp-1', variantId: 'control' });
    const row = __getInserted('FunnelEvents')[0];
    expect(row.experimentId).toBe('exp-1');
    expect(row.variantId).toBe('control');
  });

  it('stores revenue for purchase events', async () => {
    await trackFunnelEvent('purchase', { ...BASE, revenue: 899.00 });
    const row = __getInserted('FunnelEvents')[0];
    expect(row.revenue).toBe(899.00);
  });

  it('records a timestamp', async () => {
    await trackFunnelEvent('checkout_start', BASE);
    expect(__getInserted('FunnelEvents')[0].timestamp).toBeInstanceOf(Date);
  });

  it('returns { success: false, error } for an invalid stage', async () => {
    const result = await trackFunnelEvent('buy_now', BASE);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(__getInserted('FunnelEvents')).toHaveLength(0);
  });

  it('returns { success: false } when sessionId is missing', async () => {
    const result = await trackFunnelEvent('page_view', { productId: 'p1' });
    expect(result.success).toBe(false);
  });

  it('rejects empty string sessionId', async () => {
    const result = await trackFunnelEvent('page_view', { sessionId: '', productId: 'p1' });
    expect(result.success).toBe(false);
  });

  it('returns { success: true, duplicate: true } on duplicate sessionId+stage', async () => {
    __setUniqueField('FunnelEvents', '_id');
    await trackFunnelEvent('add_to_cart', BASE);
    const second = await trackFunnelEvent('add_to_cart', BASE);
    expect(second.success).toBe(true);
    expect(second.duplicate).toBe(true);
    // Only one row inserted
    expect(__getInserted('FunnelEvents')).toHaveLength(1);
  });

  it('allows different stages for the same session (no false dedup)', async () => {
    await trackFunnelEvent('product_view', BASE);
    await trackFunnelEvent('add_to_cart', BASE);
    expect(__getInserted('FunnelEvents')).toHaveLength(2);
  });

  it('returns { success: false } on unexpected DB error (non-duplicate)', async () => {
    __setInsertError('FunnelEvents', new Error('connection timeout'));
    const result = await trackFunnelEvent('page_view', BASE);
    expect(result.success).toBe(false);
  });

  it('truncates oversized sessionId via sanitize', async () => {
    const long = 'x'.repeat(300);
    const result = await trackFunnelEvent('page_view', { sessionId: long });
    expect(result.success).toBe(true);
    const row = __getInserted('FunnelEvents')[0];
    expect(row.sessionId.length).toBeLessThanOrEqual(254);
  });

  it('coerces non-string sessionId (number) to string via String()', async () => {
    // Code does String(rawSession) — numeric sessionIds must work without crashing.
    const result = await trackFunnelEvent('page_view', { sessionId: 12345 });
    expect(result.success).toBe(true);
    const row = __getInserted('FunnelEvents')[0];
    expect(row.sessionId).toBe('12345');
    expect(row._id).toBe('12345_page_view');
  });

  it('calls checkRateLimit with the correct collection and sessionId', async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: true });
    await trackFunnelEvent('page_view', BASE);
    expect(checkRateLimit).toHaveBeenCalledWith(
      'FunnelEventRateLimit',
      'sess-abc',
      expect.objectContaining({ max: 10, windowMs: 60_000 }),
    );
  });

  it('returns { success: false, error: "rate_limited" } when rate limit is exceeded', async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false });
    const result = await trackFunnelEvent('page_view', BASE);
    expect(result.success).toBe(false);
    expect(result.error).toBe('rate_limited');
    expect(__getInserted('FunnelEvents')).toHaveLength(0);
  });

  it('inserts the record when rate limit allows', async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: true });
    const result = await trackFunnelEvent('checkout_start', BASE);
    expect(result.success).toBe(true);
    expect(__getInserted('FunnelEvents')).toHaveLength(1);
  });
});

// ── getFunnelReport ────────────────────────────────────────────────

describe('getFunnelReport', () => {
  // 3 sessions enter page_view; 2 reach product_view; 1 reaches purchase
  const SAMPLE = [
    { stage: 'page_view',      sessionId: 's1', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
    { stage: 'page_view',      sessionId: 's2', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
    { stage: 'page_view',      sessionId: 's3', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
    { stage: 'product_view',   sessionId: 's1', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
    { stage: 'product_view',   sessionId: 's2', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
    { stage: 'add_to_cart',    sessionId: 's1', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
    { stage: 'checkout_start', sessionId: 's1', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
    { stage: 'purchase',       sessionId: 's1', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
  ];

  it('returns a stages object with a count for every FUNNEL_STAGES entry', async () => {
    __seed('FunnelEvents', SAMPLE);
    const { report } = await getFunnelReport();
    for (const stage of FUNNEL_STAGES) {
      expect(report.stages[stage]).toBeDefined();
      expect(typeof report.stages[stage].count).toBe('number');
    }
  });

  it('counts each stage correctly', async () => {
    __seed('FunnelEvents', SAMPLE);
    const { report } = await getFunnelReport();
    expect(report.stages.page_view.count).toBe(3);
    expect(report.stages.product_view.count).toBe(2);
    expect(report.stages.add_to_cart.count).toBe(1);
    expect(report.stages.checkout_start.count).toBe(1);
    expect(report.stages.purchase.count).toBe(1);
  });

  it('computes drop-off rate from the prior stage', async () => {
    __seed('FunnelEvents', SAMPLE);
    const { report } = await getFunnelReport();
    // product_view: 1 - (2/3) ≈ 33.33%
    expect(report.stages.product_view.dropOffRate).toBeCloseTo(33.33, 0);
    // add_to_cart: 1 - (1/2) = 50%
    expect(report.stages.add_to_cart.dropOffRate).toBeCloseTo(50, 0);
    // page_view has no prior stage — dropOffRate is 0
    expect(report.stages.page_view.dropOffRate).toBe(0);
  });

  it('computes overall conversion rate (page_view → purchase)', async () => {
    __seed('FunnelEvents', SAMPLE);
    const { report } = await getFunnelReport();
    // 1 purchase / 3 page_views ≈ 33.33%
    expect(report.overallConversionRate).toBeCloseTo(33.33, 0);
  });

  it('returns overallConversionRate 0 when no page_views', async () => {
    __seed('FunnelEvents', []);
    const { report } = await getFunnelReport();
    expect(report.overallConversionRate).toBe(0);
  });

  it('includes period metadata', async () => {
    __seed('FunnelEvents', SAMPLE);
    const { report } = await getFunnelReport({ days: 14 });
    expect(report.period.days).toBe(14);
    expect(report.period.since).toBeDefined();
  });

  it('returns success:false on DB error', async () => {
    __setQueryError('FunnelEvents', new Error('db error'));
    const result = await getFunnelReport();
    expect(result.success).toBe(false);
  });

  it('clamps days to 1–90', async () => {
    __seed('FunnelEvents', []);
    const { report } = await getFunnelReport({ days: 999 });
    expect(report.period.days).toBe(90);
    const { report: r2 } = await getFunnelReport({ days: 0 });
    expect(r2.period.days).toBe(1);
  });

  it('paginates beyond PAGE_SIZE — fetches all events when dataset exceeds 500', async () => {
    // 501 events forces two fetches (500 + 1), covering the while-loop continuation branch
    const largeDataset = Array.from({ length: 501 }, (_, i) => ({
      stage: 'page_view', sessionId: `s${i}`, memberId: null,
      timestamp: YESTERDAY, productId: 'p1',
    }));
    __seed('FunnelEvents', largeDataset);
    const { report } = await getFunnelReport();
    expect(report.stages.page_view.count).toBe(501);
  });

  it('filters by productId when provided', async () => {
    __seed('FunnelEvents', [
      { stage: 'page_view', sessionId: 's1', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
      { stage: 'page_view', sessionId: 's2', memberId: null, timestamp: YESTERDAY, productId: 'p2' },
      { stage: 'page_view', sessionId: 's3', memberId: null, timestamp: YESTERDAY, productId: 'p1' },
    ]);
    const { report } = await getFunnelReport({ productId: 'p1' });
    expect(report.stages.page_view.count).toBe(2);
  });
});
