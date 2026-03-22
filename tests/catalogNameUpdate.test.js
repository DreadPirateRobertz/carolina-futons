/**
 * @file catalogNameUpdate.test.js
 * @description Tests for src/backend/catalogNameUpdate.web.js (hq-dd6g).
 *
 * Covers:
 *  - CF_NAME_MAP: all 16 entries present, keys and values non-empty
 *  - runCatalogNameUpdate: dry run lists changes without writing
 *  - runCatalogNameUpdate: live run calls updateProductFields for matched products
 *  - runCatalogNameUpdate: skips products not in the map
 *  - runCatalogNameUpdate: captures per-product update errors without aborting
 *  - runCatalogNameUpdate: handles query failure gracefully
 *  - runCatalogNameUpdate: paginates when product count exceeds 100
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Capture webMethod permission for security assertion ──────────────────────
// vi.mock is hoisted above let declarations — use vi.hoisted() so the ref is
// available when the factory runs.

const { capturedPermission } = vi.hoisted(() => ({ capturedPermission: { value: null } }));
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (perm, fn) => { capturedPermission.value = perm; return fn; },
}));

// ── Mock wix-stores-backend ──────────────────────────────────────────────────

let _productPages = [];

vi.mock('wix-stores-backend', () => ({
  products: {
    queryProducts: vi.fn(() => {
      let _skip = 0;
      let _limit = 100;
      const builder = {
        skip: vi.fn((n) => { _skip = n; return builder; }),
        limit: vi.fn((n) => { _limit = n; return builder; }),
        find: vi.fn(async () => {
          // Return the page corresponding to the current skip
          const pageIndex = _skip / _limit;
          const page = _productPages[pageIndex] ?? [];
          return { items: page };
        }),
      };
      return builder;
    }),
    updateProductFields: vi.fn(async () => {}),
  },
}));

import { products as storeMock } from 'wix-stores-backend';
import { CF_NAME_MAP, runCatalogNameUpdate } from '../src/backend/catalogNameUpdate.web.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProduct(id, name) {
  return { _id: id, name };
}

beforeEach(() => {
  _productPages = [];
  storeMock.queryProducts.mockClear();
  storeMock.updateProductFields.mockClear();
});

// ── Permission guard ─────────────────────────────────────────────────────────

describe('runCatalogNameUpdate — permission', () => {
  it('is restricted to Admin (not Anyone or SiteMember)', () => {
    expect(capturedPermission.value).toBe('Admin');
  });
});

// ── CF_NAME_MAP ──────────────────────────────────────────────────────────────

describe('CF_NAME_MAP', () => {
  it('contains exactly 16 entries', () => {
    expect(Object.keys(CF_NAME_MAP)).toHaveLength(16);
  });

  it('all keys are non-empty strings', () => {
    for (const key of Object.keys(CF_NAME_MAP)) {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it('all values are non-empty strings', () => {
    for (const value of Object.values(CF_NAME_MAP)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('contains futon entries', () => {
    expect(CF_NAME_MAP['Gemini']).toBe('The Gemini Full Futon');
    expect(CF_NAME_MAP['Gemini II']).toBe('The Gemini Queen Futon');
    expect(CF_NAME_MAP['Chandler']).toBe('The Chandler Full Futon');
    expect(CF_NAME_MAP['Mesa']).toBe('The Mesa Full Futon');
    expect(CF_NAME_MAP['Mesa 5000']).toBe('The Mesa Queen Futon');
    expect(CF_NAME_MAP['Yuma']).toBe('The Yuma Full Futon');
    expect(CF_NAME_MAP['Prescott']).toBe('The Prescott Full Futon');
    expect(CF_NAME_MAP['Sedona']).toBe('The Sedona Queen Futon');
    expect(CF_NAME_MAP['Flagstaff']).toBe('The Flagstaff Twin Futon');
    expect(CF_NAME_MAP['Tucson']).toBe('The Tucson Loveseat Futon');
  });

  it('contains murphy bed entries', () => {
    expect(CF_NAME_MAP['Vail']).toBe('The Vail Queen Murphy Cabinet Bed');
    expect(CF_NAME_MAP['Aspen']).toBe('The Aspen Full Murphy Cabinet');
    expect(CF_NAME_MAP['Breckenridge']).toBe('The Breckenridge Queen Bookcase Murphy');
    expect(CF_NAME_MAP['Telluride']).toBe('The Telluride Twin Cabinet Bed');
    expect(CF_NAME_MAP['Durango']).toBe('The Durango Queen Desk Murphy');
    expect(CF_NAME_MAP['Silverton']).toBe('The Silverton Full Storage Murphy');
  });
});

// ── runCatalogNameUpdate — dry run ───────────────────────────────────────────

describe('runCatalogNameUpdate — dry run', () => {
  it('lists changes without calling updateProductFields', async () => {
    _productPages = [
      [makeProduct('prod-1', 'Gemini'), makeProduct('prod-2', 'Vail')],
    ];

    const result = await runCatalogNameUpdate({ dryRun: true });

    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(storeMock.updateProductFields).not.toHaveBeenCalled();
  });

  it('populates changes array with from/to/id', async () => {
    _productPages = [
      [makeProduct('prod-1', 'Mesa')],
    ];

    const result = await runCatalogNameUpdate({ dryRun: true });

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toEqual({
      id: 'prod-1',
      from: 'Mesa',
      to: 'The Mesa Full Futon',
    });
  });

  it('skips unknown products in dry run', async () => {
    _productPages = [
      [makeProduct('prod-1', 'Unknown Product'), makeProduct('prod-2', 'Gemini')],
    ];

    const result = await runCatalogNameUpdate({ dryRun: true });

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].from).toBe('Gemini');
  });
});

// ── runCatalogNameUpdate — live run ─────────────────────────────────────────

describe('runCatalogNameUpdate — live run', () => {
  it('calls updateProductFields for each matched product', async () => {
    _productPages = [
      [
        makeProduct('prod-1', 'Gemini'),
        makeProduct('prod-2', 'Vail'),
        makeProduct('prod-3', 'Unknown'),
      ],
    ];

    const result = await runCatalogNameUpdate();

    expect(storeMock.updateProductFields).toHaveBeenCalledTimes(2);
    expect(storeMock.updateProductFields).toHaveBeenCalledWith('prod-1', { name: 'The Gemini Full Futon' });
    expect(storeMock.updateProductFields).toHaveBeenCalledWith('prod-2', { name: 'The Vail Queen Murphy Cabinet Bed' });
    expect(result.updated).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('returns correct changes array on live run', async () => {
    _productPages = [
      [makeProduct('prod-a', 'Chandler')],
    ];

    const result = await runCatalogNameUpdate();

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toEqual({
      id: 'prod-a',
      from: 'Chandler',
      to: 'The Chandler Full Futon',
    });
  });

  it('skips products not in the map and does not call update for them', async () => {
    _productPages = [
      [makeProduct('prod-x', 'Not In Map'), makeProduct('prod-y', 'Also Unknown')],
    ];

    const result = await runCatalogNameUpdate();

    expect(storeMock.updateProductFields).not.toHaveBeenCalled();
    expect(result.skipped).toBe(2);
    expect(result.updated).toBe(0);
  });

  it('captures per-product update errors without aborting the batch', async () => {
    _productPages = [
      [makeProduct('prod-1', 'Gemini'), makeProduct('prod-2', 'Mesa')],
    ];

    // First update succeeds, second throws
    storeMock.updateProductFields
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('API timeout'));

    const result = await runCatalogNameUpdate();

    expect(result.updated).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Mesa');
    expect(result.errors[0]).toContain('API timeout');
  });

  it('handles query failure gracefully and returns error', async () => {
    storeMock.queryProducts.mockImplementationOnce(() => ({
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockRejectedValueOnce(new Error('DB unavailable')),
    }));

    const result = await runCatalogNameUpdate();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Query failed');
    expect(result.updated).toBe(0);
  });

  it('paginates when product count equals page size (100)', async () => {
    // Page 0: 100 products (exactly at limit — triggers another page)
    const page0 = Array.from({ length: 100 }, (_, i) =>
      makeProduct(`prod-${i}`, i === 0 ? 'Gemini' : `Unknown-${i}`)
    );
    // Page 1: fewer than 100 — signals end of results
    const page1 = [makeProduct('prod-100', 'Vail')];

    _productPages = [page0, page1];

    const result = await runCatalogNameUpdate();

    // 2 matched across 2 pages
    expect(result.updated).toBe(2);
    expect(storeMock.updateProductFields).toHaveBeenCalledWith('prod-0', { name: 'The Gemini Full Futon' });
    expect(storeMock.updateProductFields).toHaveBeenCalledWith('prod-100', { name: 'The Vail Queen Murphy Cabinet Bed' });
  });

  it('empty catalog returns zero counts and no errors', async () => {
    _productPages = [[]];

    const result = await runCatalogNameUpdate();

    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(result.changes).toHaveLength(0);
  });
});
