/**
 * exportReport.test.ts — S15 export utilities unit tests.
 *
 * Tests buildExportPayload (localStorage-based) and buildTextSummary (pure).
 * triggerJsonDownload/triggerTextDownload are thin browser-API wrappers
 * and are not tested here.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildExportPayload, buildTextSummary } from '../src/utils/exportReport.js';
import type { ExportPayload } from '../src/utils/exportReport.js';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

// ── buildExportPayload ────────────────────────────────────────────────────────

describe('buildExportPayload', () => {
  it('returns version 1 payload', () => {
    const payload = buildExportPayload();
    expect(payload.version).toBe(1);
  });

  it('includes exportedAt ISO timestamp', () => {
    const payload = buildExportPayload();
    expect(payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes all pages from PAGES data', () => {
    const payload = buildExportPayload();
    expect(payload.pages.length).toBeGreaterThan(0);
  });

  it('each page entry has required fields', () => {
    const payload = buildExportPayload();
    for (const p of payload.pages) {
      expect(typeof p.pageName).toBe('string');
      expect(Array.isArray(p.hookedIds)).toBe(true);
      expect(Array.isArray(p.skippedIds)).toBe(true);
      expect(typeof p.totalElements).toBe('number');
    }
  });

  it('reads hooked IDs from localStorage for a page', () => {
    store['cf-hookup-home-hooked'] = JSON.stringify(['heroTitle', 'heroCTA']);
    const payload = buildExportPayload();
    const home = payload.pages.find((p) => p.pageName === 'Home');
    expect(home?.hookedIds).toEqual(['heroTitle', 'heroCTA']);
  });

  it('reads skipped IDs from localStorage for a page', () => {
    store['cf-hookup-home-skipped'] = JSON.stringify(['heroBg']);
    const payload = buildExportPayload();
    const home = payload.pages.find((p) => p.pageName === 'Home');
    expect(home?.skippedIds).toEqual(['heroBg']);
  });

  it('returns empty arrays for a page with no localStorage data', () => {
    const payload = buildExportPayload();
    const home = payload.pages.find((p) => p.pageName === 'Home');
    expect(home?.hookedIds).toEqual([]);
    expect(home?.skippedIds).toEqual([]);
  });

  it('totalElements matches the PAGES data count', () => {
    const payload = buildExportPayload();
    const home = payload.pages.find((p) => p.pageName === 'Home');
    // Home page has a known non-zero element count
    expect(home?.totalElements).toBeGreaterThan(0);
  });
});

// ── buildTextSummary ──────────────────────────────────────────────────────────

function makePayload(overrides: Partial<ExportPayload> = {}): ExportPayload {
  return {
    version: 1,
    exportedAt: '2026-03-21T12:00:00.000Z',
    pages: [],
    ...overrides,
  };
}

describe('buildTextSummary', () => {
  it('includes the report header', () => {
    const text = buildTextSummary(makePayload());
    expect(text).toContain('CF Hookup Assistant — Progress Report');
  });

  it('includes the exportedAt timestamp', () => {
    const text = buildTextSummary(makePayload({ exportedAt: '2026-03-21T12:00:00.000Z' }));
    expect(text).toContain('2026-03-21T12:00:00.000Z');
  });

  it('includes totals line', () => {
    const text = buildTextSummary(makePayload());
    expect(text).toContain('Total:');
  });

  it('shows pages with progress', () => {
    const payload = makePayload({
      pages: [
        { pageName: 'Home', hookedIds: ['heroTitle', 'heroCTA'], skippedIds: [], totalElements: 50 },
        { pageName: 'Product Page', hookedIds: [], skippedIds: [], totalElements: 30 },
      ],
    });
    const text = buildTextSummary(payload);
    expect(text).toContain('Home: 2/50 hooked');
    // Product Page has no progress — should be omitted
    expect(text).not.toContain('Product Page:');
  });

  it('includes skipped count when non-zero', () => {
    const payload = makePayload({
      pages: [
        { pageName: 'Home', hookedIds: ['heroTitle'], skippedIds: ['heroBg', 'heroOverlay'], totalElements: 50 },
      ],
    });
    const text = buildTextSummary(payload);
    expect(text).toContain('2 skipped');
  });

  it('omits skipped count when zero', () => {
    const payload = makePayload({
      pages: [
        { pageName: 'Home', hookedIds: ['heroTitle'], skippedIds: [], totalElements: 50 },
      ],
    });
    const text = buildTextSummary(payload);
    expect(text).not.toContain('skipped');
  });

  it('totals line sums across all pages', () => {
    const payload = makePayload({
      pages: [
        { pageName: 'Home', hookedIds: ['a', 'b'], skippedIds: ['c'], totalElements: 10 },
        { pageName: 'Cart Page', hookedIds: ['x'], skippedIds: [], totalElements: 20 },
      ],
    });
    const text = buildTextSummary(payload);
    expect(text).toContain('Total: 3/30 elements hooked');
    expect(text).toContain('1 skipped');
  });

  it('totals line omits skipped when all zero', () => {
    const payload = makePayload({
      pages: [
        { pageName: 'Home', hookedIds: ['a'], skippedIds: [], totalElements: 10 },
      ],
    });
    const text = buildTextSummary(payload);
    expect(text).not.toContain('skipped');
  });
});
