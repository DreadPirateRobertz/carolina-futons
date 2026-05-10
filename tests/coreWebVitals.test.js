import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert } from './__mocks__/wix-data.js';
import {
  reportMetrics,
  DEFAULT_THRESHOLDS,
  VALID_DEVICE_TYPES,
  clampMetric,
  checkBudgetViolations,
} from '../src/backend/coreWebVitals.web.js';

// ── Helpers ─────────────────────────────────────────────────────────

const baseMetrics = {
  sessionId: 'sess-001',
  page: '/product/eureka-futon',
  deviceType: 'desktop',
  lcp: 1800,
  fid: 50,
  inp: 150,
  cls: 0.05,
  ttfb: 400,
  fcp: 1200,
  connectionType: '4g',
};

const sampleMetricRecords = [
  { ...baseMetrics, _id: 'pm-001', timestamp: new Date(), deviceType: 'desktop', lcp: 2000, cls: 0.08, inp: 180 },
  { ...baseMetrics, _id: 'pm-002', timestamp: new Date(), deviceType: 'desktop', lcp: 2500, cls: 0.12, inp: 220 },
  { ...baseMetrics, _id: 'pm-003', timestamp: new Date(), deviceType: 'mobile', lcp: 3500, cls: 0.15, inp: 350 },
  { ...baseMetrics, _id: 'pm-004', timestamp: new Date(), deviceType: 'mobile', lcp: 4200, cls: 0.30, inp: 600 },
];

beforeEach(() => {
  __reset();
  __seed('PerformanceMetrics', []);
  __seed('PerformanceBudgets', []);
});

// ── clampMetric ─────────────────────────────────────────────────────

describe('clampMetric', () => {
  it('clamps within range', () => {
    expect(clampMetric(500, 0, 1000)).toBe(500);
  });

  it('clamps below min', () => {
    expect(clampMetric(-10, 0, 1000)).toBe(0);
  });

  it('clamps above max', () => {
    expect(clampMetric(99999, 0, 60000)).toBe(60000);
  });

  it('returns 0 for non-number', () => {
    expect(clampMetric('hello', 0, 1000)).toBe(0);
    expect(clampMetric(null, 0, 1000)).toBe(0);
    expect(clampMetric(undefined, 0, 1000)).toBe(0);
  });

  it('returns 0 for NaN', () => {
    expect(clampMetric(NaN, 0, 1000)).toBe(0);
  });
});

// ── checkBudgetViolations ───────────────────────────────────────────

describe('checkBudgetViolations', () => {
  it('returns no violations for good metrics', () => {
    const record = { lcp: 1500, inp: 100, cls: 0.05 };
    expect(checkBudgetViolations(record)).toHaveLength(0);
  });

  it('flags poor LCP', () => {
    const record = { lcp: 5000, inp: 100, cls: 0.05 };
    const violations = checkBudgetViolations(record);
    expect(violations).toHaveLength(1);
    expect(violations[0].metric).toBe('lcp');
    expect(violations[0].severity).toBe('poor');
  });

  it('flags needs-improvement CLS', () => {
    const record = { lcp: 1500, inp: 100, cls: 0.15 };
    const violations = checkBudgetViolations(record);
    expect(violations).toHaveLength(1);
    expect(violations[0].metric).toBe('cls');
    expect(violations[0].severity).toBe('needs-improvement');
  });

  it('flags multiple violations', () => {
    const record = { lcp: 5000, inp: 600, cls: 0.5 };
    const violations = checkBudgetViolations(record);
    expect(violations).toHaveLength(3);
  });

  it('skips zero values', () => {
    const record = { lcp: 0, inp: 0, cls: 0 };
    expect(checkBudgetViolations(record)).toHaveLength(0);
  });
});

// ── reportMetrics ───────────────────────────────────────────────────

describe('reportMetrics', () => {
  it('stores metrics successfully', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    const result = await reportMetrics(baseMetrics);
    expect(result.success).toBe(true);
    expect(inserted).not.toBeNull();
    expect(inserted.sessionId).toBe('sess-001');
    expect(inserted.lcp).toBe(1800);
    expect(inserted.cls).toBe(0.05);
  });

  it('returns budget violations for poor metrics', async () => {
    const result = await reportMetrics({
      ...baseMetrics,
      lcp: 5000,
      cls: 0.5,
    });
    expect(result.success).toBe(true);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some(v => v.metric === 'lcp')).toBe(true);
  });

  it('returns empty violations for good metrics', async () => {
    const result = await reportMetrics(baseMetrics);
    expect(result.success).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects missing sessionId', async () => {
    const result = await reportMetrics({ page: '/home' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects missing page', async () => {
    const result = await reportMetrics({ sessionId: 'sess-001' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects null data', async () => {
    const result = await reportMetrics(null);
    expect(result.success).toBe(false);
  });

  it('defaults deviceType to desktop for invalid value', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    await reportMetrics({ ...baseMetrics, deviceType: 'smartwatch' });
    expect(inserted.deviceType).toBe('desktop');
  });

  it('clamps extreme LCP values', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    await reportMetrics({ ...baseMetrics, lcp: 999999 });
    expect(inserted.lcp).toBe(60000);
  });

  it('handles non-numeric metric values', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    await reportMetrics({ ...baseMetrics, lcp: 'fast', cls: 'low' });
    expect(inserted.lcp).toBe(0);
    expect(inserted.cls).toBe(0);
  });

  it('sanitizes connection type', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'PerformanceMetrics') inserted = item;
    });

    await reportMetrics({ ...baseMetrics, connectionType: '<script>alert(1)</script>4g' });
    expect(inserted.connectionType).not.toContain('<script>');
  });
});

// ── Constants ───────────────────────────────────────────────────────

describe('constants', () => {
  it('exports device types', () => {
    expect(VALID_DEVICE_TYPES).toContain('mobile');
    expect(VALID_DEVICE_TYPES).toContain('desktop');
  });

  it('has thresholds for all core metrics', () => {
    expect(DEFAULT_THRESHOLDS.lcp).toBeDefined();
    expect(DEFAULT_THRESHOLDS.cls).toBeDefined();
    expect(DEFAULT_THRESHOLDS.inp).toBeDefined();
    expect(DEFAULT_THRESHOLDS.lcp.good).toBe(2500);
    expect(DEFAULT_THRESHOLDS.cls.good).toBe(0.1);
  });
});
