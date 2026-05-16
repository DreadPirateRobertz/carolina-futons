/**
 * @file cf-44qt-logError-batch4.test.js
 * @description TDD red → green for cf-44qt batch4: verify console.error sites
 * in abTestDashboard, analyticsDigest, badgeService, bundleBuilder, and
 * buyingGuideOgCards are migrated to canonical logError.
 *
 * All tests RED until source migration applied.
 * cf-1f5t (cf-44qt wave batch4)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));
vi.mock('backend/buyingGuides.web', () => ({
  getBuyingGuide: vi.fn(),
  getBuyingGuideSlugs: vi.fn(),
}));

import { logError } from '../src/backend/utils/errorHandler.js';
import { getBuyingGuide } from '../src/backend/buyingGuides.web.js';
import { listExperiments } from '../src/backend/abTestDashboard.web.js';
import { fetchOrderMetrics } from '../src/backend/analyticsDigest.web.js';
import { getProductBadges } from '../src/backend/badgeService.web.js';
import { getBundlePageProducts } from '../src/backend/bundleBuilder.web.js';
import { getOgCardSpec } from '../src/backend/buyingGuideOgCards.web.js';

beforeEach(() => {
  resetData();
  vi.mocked(logError).mockClear();
  vi.mocked(getBuyingGuide).mockResolvedValue({ success: true, guide: null });
});

// ── abTestDashboard ───────────────────────────────────────────────────────────

describe('abTestDashboard.listExperiments', () => {
  it('calls canonical logError when AbTests query fails', async () => {
    __setQueryError('AbTests', new Error('DB offline'));

    const result = await listExperiments();

    expect(result).toEqual({ success: false, tests: [], total: 0 });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[abTestDashboard]'),
      expect.any(Error),
    );
  });
});

// ── analyticsDigest ───────────────────────────────────────────────────────────

describe('analyticsDigest.fetchOrderMetrics', () => {
  it('calls canonical logError when Stores/Orders query fails', async () => {
    __setQueryError('Stores/Orders', new Error('query failed'));

    const result = await fetchOrderMetrics(new Date('2026-01-01'));

    expect(result).toEqual({ orderCount: 0, totalRevenue: 0, avgOrderValue: 0, topProducts: [] });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('analyticsDigest:'),
      expect.any(Error),
    );
  });
});

// ── badgeService ──────────────────────────────────────────────────────────────

describe('badgeService.getProductBadges', () => {
  it('calls canonical logError when ProductBadges query fails', async () => {
    __seed('ProductBadges', []);
    __setQueryError('ProductBadges', new Error('CMS unavailable'));

    const result = await getProductBadges('prod-123', {});

    expect(result.success).toBe(false);
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[badgeService]'),
      expect.any(Error),
    );
  });
});

// ── bundleBuilder ─────────────────────────────────────────────────────────────

describe('bundleBuilder.getBundlePageProducts', () => {
  it('calls canonical logError when Stores/Products query fails', async () => {
    __setQueryError('Stores/Products', new Error('products query failed'));

    const result = await getBundlePageProducts();

    expect(result).toEqual(expect.objectContaining({ success: false }));
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[bundleBuilder]'),
      expect.any(Error),
    );
  });
});

// ── buyingGuideOgCards ────────────────────────────────────────────────────────

describe('buyingGuideOgCards.getOgCardSpec', () => {
  it('calls canonical logError when getBuyingGuide throws', async () => {
    vi.mocked(getBuyingGuide).mockRejectedValueOnce(new Error('guide service down'));

    const result = await getOgCardSpec('futon-frames');

    expect(result).toEqual({ success: false, error: 'Failed to generate OG card spec.' });
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('[buyingGuideOgCards]'),
      expect.any(Error),
    );
  });
});
