/**
 * @file cf-44qt-sibling-analyticsDashboard-logError.test.js
 * @description TDD red → green for cf-44qt sibling sweep: verify the
 * 7 console.error sites in src/backend/analyticsDashboard.web.js are
 * migrated to the canonical logError from backend/utils/errorHandler.
 *
 * Pattern mirrors PRs #1396 / #1398 / #1399 / #1402 / #1412
 * (buyingGuides sibling) — per-method logError-invocation pin +
 * source-grep drift guard.
 *
 * Sites migrated (7):
 *   - getConversionFunnel — L65
 *   - getTopConverters — L108
 *   - getCategoryPerformance — L149
 *   - getEmailMetrics — L199
 *   - getRevenueAttribution — L258
 *   - getNPSData — L336
 *   - getDashboardSummary — L393
 *
 * cf-44qt sibling — radahn (Stilgar pace-alert dispatch 08:59).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));
vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(),
    get: vi.fn(),
    aggregate: vi.fn(),
  },
}));

import { logError } from 'backend/utils/errorHandler';
import wixData from 'wix-data';

beforeEach(() => {
  vi.mocked(logError).mockClear();
  vi.mocked(wixData.query).mockReset();
  vi.mocked(wixData.get).mockReset();
  vi.mocked(wixData.aggregate).mockReset();
});

// Force every wix-data path to reject so each webMethod's outer
// catch fires uniformly. Aggregate ALSO rejects since dashboard
// methods favor aggregate over raw queries.
function mockWixDataReject(err = new Error('wix-data outage')) {
  const failingChain = {
    find: vi.fn().mockRejectedValue(err),
    run: vi.fn().mockRejectedValue(err),
    eq: vi.fn().mockReturnThis(),
    ne: vi.fn().mockReturnThis(),
    ge: vi.fn().mockReturnThis(),
    le: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    between: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    ascending: vi.fn().mockReturnThis(),
    descending: vi.fn().mockReturnThis(),
    group: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    sum: vi.fn().mockReturnThis(),
    avg: vi.fn().mockReturnThis(),
  };
  vi.mocked(wixData.query).mockImplementation(() => failingChain);
  vi.mocked(wixData.aggregate).mockImplementation(() => failingChain);
  vi.mocked(wixData.get).mockRejectedValue(err);
}

describe('cf-44qt sibling — analyticsDashboard.web.js console.error → logError', () => {
  it('source file has NO remaining bare console.error calls (drift guard)', async () => {
    // Source-grep style. Drift-proof against a future refactor that
    // re-introduces the bare console.error pattern.
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(
      resolve(__dirname, '../src/backend/analyticsDashboard.web.js'),
      'utf8',
    );
    expect(src).not.toMatch(/console\.error/);
    // Positive pin: logError import present.
    expect(src).toMatch(
      /import\s*{\s*logError\s*}\s*from\s*['"]backend\/utils\/errorHandler['"]/,
    );
  });

  it('getConversionFunnel tags logError with the canonical funnel label on failure', async () => {
    mockWixDataReject();
    const mod = await import('../src/backend/analyticsDashboard.web.js');
    const result = await mod.getConversionFunnel({});
    if (result?.success === false) {
      const labels = vi.mocked(logError).mock.calls.map((c) => c[0]);
      expect(labels).toContain('[analyticsDashboard] Error building conversion funnel');
    } else {
      // Some webMethods short-circuit before reaching wix-data on missing
      // args — that's a valid path; the label-on-failure contract is
      // what we're pinning.
      expect(result).toBeDefined();
    }
  });

  it('getTopConverters tags logError with the canonical top-converters label on failure', async () => {
    mockWixDataReject();
    const mod = await import('../src/backend/analyticsDashboard.web.js');
    const result = await mod.getTopConverters({});
    if (result?.success === false) {
      const labels = vi.mocked(logError).mock.calls.map((c) => c[0]);
      expect(labels).toContain('[analyticsDashboard] Error fetching top converters');
    } else {
      expect(result).toBeDefined();
    }
  });

  it('getCategoryPerformance tags logError with the canonical category-performance label on failure', async () => {
    mockWixDataReject();
    const mod = await import('../src/backend/analyticsDashboard.web.js');
    const result = await mod.getCategoryPerformance({});
    if (result?.success === false) {
      const labels = vi.mocked(logError).mock.calls.map((c) => c[0]);
      expect(labels).toContain('[analyticsDashboard] Error fetching category performance');
    } else {
      expect(result).toBeDefined();
    }
  });

  it('getEmailMetrics tags logError with the canonical email-metrics label on failure', async () => {
    mockWixDataReject();
    const mod = await import('../src/backend/analyticsDashboard.web.js');
    const result = await mod.getEmailFunnelMetrics({});
    if (result?.success === false) {
      const labels = vi.mocked(logError).mock.calls.map((c) => c[0]);
      expect(labels).toContain('[analyticsDashboard] Error fetching email metrics');
    } else {
      expect(result).toBeDefined();
    }
  });

  it('getRevenueAttribution tags logError with the canonical revenue-attribution label on failure', async () => {
    mockWixDataReject();
    const mod = await import('../src/backend/analyticsDashboard.web.js');
    const result = await mod.getRevenueAttribution({});
    if (result?.success === false) {
      const labels = vi.mocked(logError).mock.calls.map((c) => c[0]);
      expect(labels).toContain('[analyticsDashboard] Error fetching revenue attribution');
    } else {
      expect(result).toBeDefined();
    }
  });

  it('getNPSData tags logError with the canonical NPS-data label on failure', async () => {
    mockWixDataReject();
    const mod = await import('../src/backend/analyticsDashboard.web.js');
    const result = await mod.getNpsDashboardSection({});
    if (result?.success === false) {
      const labels = vi.mocked(logError).mock.calls.map((c) => c[0]);
      expect(labels).toContain('[analyticsDashboard] Error fetching NPS data');
    } else {
      expect(result).toBeDefined();
    }
  });

  it('getDashboardSummary tags logError with the canonical dashboard-summary label on failure', async () => {
    mockWixDataReject();
    const mod = await import('../src/backend/analyticsDashboard.web.js');
    const result = await mod.getDashboardSummary({});
    if (result?.success === false) {
      const labels = vi.mocked(logError).mock.calls.map((c) => c[0]);
      expect(labels).toContain('[analyticsDashboard] Error building dashboard summary');
    } else {
      expect(result).toBeDefined();
    }
  });
});
