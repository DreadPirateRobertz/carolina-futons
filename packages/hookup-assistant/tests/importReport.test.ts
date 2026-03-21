/**
 * importReport.test.ts — S15 import utilities unit tests.
 *
 * Tests parseImportPayload (pure validation) and applyImportPayload
 * (localStorage writes).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseImportPayload, applyImportPayload } from '../src/utils/importReport.js';
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

// ── parseImportPayload ────────────────────────────────────────────────────────

const VALID_PAYLOAD: ExportPayload = {
  version: 1,
  exportedAt: '2026-03-21T12:00:00.000Z',
  pages: [
    { pageName: 'Home', hookedIds: ['heroTitle'], skippedIds: [], totalElements: 50 },
  ],
};

describe('parseImportPayload — valid input', () => {
  it('returns payload for a valid JSON string', () => {
    const result = parseImportPayload(JSON.stringify(VALID_PAYLOAD));
    expect(result).not.toBeNull();
    expect(result?.version).toBe(1);
  });

  it('preserves pages array', () => {
    const result = parseImportPayload(JSON.stringify(VALID_PAYLOAD));
    expect(result?.pages).toHaveLength(1);
    expect(result?.pages[0].pageName).toBe('Home');
  });

  it('preserves exportedAt', () => {
    const result = parseImportPayload(JSON.stringify(VALID_PAYLOAD));
    expect(result?.exportedAt).toBe('2026-03-21T12:00:00.000Z');
  });
});

describe('parseImportPayload — invalid input', () => {
  it('returns null for malformed JSON', () => {
    expect(parseImportPayload('not json {')).toBeNull();
  });

  it('returns null for JSON with wrong version', () => {
    const bad = JSON.stringify({ ...VALID_PAYLOAD, version: 2 });
    expect(parseImportPayload(bad)).toBeNull();
  });

  it('returns null when version is missing', () => {
    const bad = JSON.stringify({ exportedAt: '2026-03-21', pages: [] });
    expect(parseImportPayload(bad)).toBeNull();
  });

  it('returns null when pages is not an array', () => {
    const bad = JSON.stringify({ version: 1, exportedAt: '2026-03-21', pages: 'oops' });
    expect(parseImportPayload(bad)).toBeNull();
  });

  it('returns null for null JSON value', () => {
    expect(parseImportPayload('null')).toBeNull();
  });

  it('returns null for a plain number', () => {
    expect(parseImportPayload('42')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseImportPayload('')).toBeNull();
  });
});

// ── applyImportPayload ────────────────────────────────────────────────────────

describe('applyImportPayload', () => {
  it('writes hooked IDs to localStorage', () => {
    const payload: ExportPayload = {
      version: 1,
      exportedAt: '2026-03-21T12:00:00.000Z',
      pages: [
        { pageName: 'Home', hookedIds: ['heroTitle', 'heroCTA'], skippedIds: [], totalElements: 50 },
      ],
    };
    applyImportPayload(payload);
    const saved = localStorageMock.getItem('cf-hookup-home-hooked');
    expect(JSON.parse(saved!)).toEqual(['heroTitle', 'heroCTA']);
  });

  it('writes skipped IDs to localStorage', () => {
    const payload: ExportPayload = {
      version: 1,
      exportedAt: '2026-03-21T12:00:00.000Z',
      pages: [
        { pageName: 'Home', hookedIds: [], skippedIds: ['heroBg'], totalElements: 50 },
      ],
    };
    applyImportPayload(payload);
    const saved = localStorageMock.getItem('cf-hookup-home-skipped');
    expect(JSON.parse(saved!)).toEqual(['heroBg']);
  });

  it('returns count of pages written', () => {
    const payload: ExportPayload = {
      version: 1,
      exportedAt: '2026-03-21T12:00:00.000Z',
      pages: [
        { pageName: 'Home', hookedIds: [], skippedIds: [], totalElements: 50 },
        { pageName: 'Product Page', hookedIds: ['productTitle'], skippedIds: [], totalElements: 30 },
      ],
    };
    const count = applyImportPayload(payload);
    expect(count).toBe(2);
  });

  it('writes empty arrays when IDs are empty', () => {
    const payload: ExportPayload = {
      version: 1,
      exportedAt: '2026-03-21T12:00:00.000Z',
      pages: [
        { pageName: 'Home', hookedIds: [], skippedIds: [], totalElements: 50 },
      ],
    };
    applyImportPayload(payload);
    const hooked = localStorageMock.getItem('cf-hookup-home-hooked');
    expect(JSON.parse(hooked!)).toEqual([]);
  });

  it('skips entries with non-string pageName', () => {
    const payload = {
      version: 1 as const,
      exportedAt: '2026-03-21T12:00:00.000Z',
      pages: [
        { pageName: 42 as unknown as string, hookedIds: [], skippedIds: [], totalElements: 0 },
        { pageName: 'Home', hookedIds: ['heroTitle'], skippedIds: [], totalElements: 50 },
      ],
    };
    const count = applyImportPayload(payload);
    expect(count).toBe(1); // only 'Home' written
  });

  it('filters non-string IDs from hookedIds', () => {
    const payload = {
      version: 1 as const,
      exportedAt: '2026-03-21T12:00:00.000Z',
      pages: [
        {
          pageName: 'Home',
          hookedIds: ['heroTitle', 42 as unknown as string, null as unknown as string],
          skippedIds: [],
          totalElements: 50,
        },
      ],
    };
    applyImportPayload(payload);
    const saved = localStorageMock.getItem('cf-hookup-home-hooked');
    expect(JSON.parse(saved!)).toEqual(['heroTitle']);
  });

  it('overwrites existing localStorage state', () => {
    store['cf-hookup-home-hooked'] = JSON.stringify(['oldId']);
    const payload: ExportPayload = {
      version: 1,
      exportedAt: '2026-03-21T12:00:00.000Z',
      pages: [
        { pageName: 'Home', hookedIds: ['newId'], skippedIds: [], totalElements: 50 },
      ],
    };
    applyImportPayload(payload);
    const saved = localStorageMock.getItem('cf-hookup-home-hooked');
    expect(JSON.parse(saved!)).toEqual(['newId']);
  });

  it('handles multi-page round-trip correctly', () => {
    const payload: ExportPayload = {
      version: 1,
      exportedAt: '2026-03-21T12:00:00.000Z',
      pages: [
        { pageName: 'Home', hookedIds: ['heroTitle'], skippedIds: ['heroBg'], totalElements: 50 },
        { pageName: 'Cart Page', hookedIds: ['cartTitle', 'cartSubtitle'], skippedIds: [], totalElements: 20 },
      ],
    };
    applyImportPayload(payload);
    expect(JSON.parse(localStorageMock.getItem('cf-hookup-home-hooked')!)).toEqual(['heroTitle']);
    expect(JSON.parse(localStorageMock.getItem('cf-hookup-home-skipped')!)).toEqual(['heroBg']);
    expect(JSON.parse(localStorageMock.getItem('cf-hookup-cart-page-hooked')!)).toEqual(['cartTitle', 'cartSubtitle']);
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────

describe('parseImportPayload + applyImportPayload round-trip', () => {
  it('restores all IDs after parse→apply', () => {
    const original: ExportPayload = {
      version: 1,
      exportedAt: '2026-03-21T12:00:00.000Z',
      pages: [
        { pageName: 'Home', hookedIds: ['heroTitle', 'heroCTA'], skippedIds: ['heroBg'], totalElements: 50 },
      ],
    };
    const text = JSON.stringify(original);
    const parsed = parseImportPayload(text);
    expect(parsed).not.toBeNull();
    applyImportPayload(parsed!);
    expect(JSON.parse(localStorageMock.getItem('cf-hookup-home-hooked')!)).toEqual(['heroTitle', 'heroCTA']);
    expect(JSON.parse(localStorageMock.getItem('cf-hookup-home-skipped')!)).toEqual(['heroBg']);
  });
});
