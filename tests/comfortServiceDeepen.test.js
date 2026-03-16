import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed, __setQueryError } from './__mocks__/wix-data.js';

import {
  getComfortLevels,
  getProductComfort,
  getComfortProducts,
} from '../src/backend/comfortService.web.js';

// Shared fixtures
const COMFORT_LEVELS = [
  {
    _id: 'cl-plush', slug: 'plush', name: 'Plush',
    tagline: 'Sink in', description: 'Super soft',
    illustration: 'plush.svg', illustrationAlt: 'Plush alt',
    sortOrder: 1, _createdDate: '2026-01-01', _owner: 'admin',
  },
  {
    _id: 'cl-medium', slug: 'medium', name: 'Medium',
    tagline: 'Balanced', description: 'Mid feel',
    illustration: 'medium.svg', illustrationAlt: 'Medium alt',
    sortOrder: 2, _createdDate: '2026-01-02', _owner: 'admin',
  },
  {
    _id: 'cl-firm', slug: 'firm', name: 'Firm',
    tagline: 'Solid', description: 'Very firm',
    illustration: 'firm.svg', illustrationAlt: 'Firm alt',
    sortOrder: 3, _createdDate: '2026-01-03', _owner: 'admin',
  },
];

const PRODUCT_COMFORT = [
  { _id: 'pc-1', productId: 'prod-1', comfortLevelId: 'cl-plush', sortOrder: 1 },
  { _id: 'pc-2', productId: 'prod-2', comfortLevelId: 'cl-firm', sortOrder: 1 },
  { _id: 'pc-3', productId: 'prod-3', comfortLevelId: 'cl-medium', sortOrder: 1 },
  { _id: 'pc-4', productId: 'prod-4', comfortLevelId: 'cl-plush', sortOrder: 2 },
];

const ALLOWED_FIELDS = ['slug', 'name', 'tagline', 'description', 'illustration', 'illustrationAlt'];

// ── getComfortLevels — deeper coverage ────────────────────────────────

describe('getComfortLevels (deepen)', () => {
  it('returns exactly the 6 projected fields and nothing else', async () => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    const levels = await getComfortLevels();
    for (const level of levels) {
      const keys = Object.keys(level);
      expect(keys).toEqual(expect.arrayContaining(ALLOWED_FIELDS));
      expect(keys).toHaveLength(ALLOWED_FIELDS.length);
      // No CMS internal fields leak through
      expect(level._id).toBeUndefined();
      expect(level._createdDate).toBeUndefined();
      expect(level._owner).toBeUndefined();
      expect(level.sortOrder).toBeUndefined();
    }
  });

  it('handles a single comfort level', async () => {
    __seed('ComfortLevels', [COMFORT_LEVELS[0]]);
    const levels = await getComfortLevels();
    expect(levels).toHaveLength(1);
    expect(levels[0].slug).toBe('plush');
  });

  it('maps all fields completely — no undefined in well-formed data', async () => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    const levels = await getComfortLevels();
    for (const level of levels) {
      for (const field of ALLOWED_FIELDS) {
        expect(level[field]).toBeDefined();
        expect(level[field]).not.toBe('');
      }
    }
  });

  it('returns items with undefined fields when CMS data is sparse', async () => {
    __seed('ComfortLevels', [
      { _id: 'cl-empty', slug: 'bare', name: 'Bare', sortOrder: 1 },
    ]);
    const levels = await getComfortLevels();
    expect(levels).toHaveLength(1);
    expect(levels[0].slug).toBe('bare');
    expect(levels[0].tagline).toBeUndefined();
    expect(levels[0].description).toBeUndefined();
    expect(levels[0].illustration).toBeUndefined();
    expect(levels[0].illustrationAlt).toBeUndefined();
  });

  it('returns empty array when ComfortLevels query throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __setQueryError('ComfortLevels', new Error('CMS timeout'));
    const levels = await getComfortLevels();
    expect(levels).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching comfort levels:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it('preserves stable sort when multiple items share the same sortOrder', async () => {
    __seed('ComfortLevels', [
      { _id: 'cl-a', slug: 'alpha', name: 'Alpha', tagline: '', description: '', illustration: '', illustrationAlt: '', sortOrder: 1 },
      { _id: 'cl-b', slug: 'beta', name: 'Beta', tagline: '', description: '', illustration: '', illustrationAlt: '', sortOrder: 1 },
    ]);
    const levels = await getComfortLevels();
    expect(levels).toHaveLength(2);
    // Both should be returned regardless of tie-breaking
    const slugs = levels.map(l => l.slug);
    expect(slugs).toContain('alpha');
    expect(slugs).toContain('beta');
  });
});

// ── getProductComfort — deeper coverage ───────────────────────────────

describe('getProductComfort (deepen)', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    __seed('ProductComfort', PRODUCT_COMFORT);
  });

  it('returns exactly the 6 projected fields for a valid product', async () => {
    const comfort = await getProductComfort('prod-1');
    const keys = Object.keys(comfort);
    expect(keys).toEqual(expect.arrayContaining(ALLOWED_FIELDS));
    expect(keys).toHaveLength(ALLOWED_FIELDS.length);
    expect(comfort._id).toBeUndefined();
    expect(comfort.comfortLevelId).toBeUndefined();
    expect(comfort.productId).toBeUndefined();
  });

  it('uses the first mapping when multiple mappings exist for a product', async () => {
    __seed('ProductComfort', [
      { _id: 'pc-dup1', productId: 'prod-dup', comfortLevelId: 'cl-plush', sortOrder: 1 },
      { _id: 'pc-dup2', productId: 'prod-dup', comfortLevelId: 'cl-firm', sortOrder: 2 },
    ]);
    const comfort = await getProductComfort('prod-dup');
    // limit(1) means the first matching item is used
    expect(comfort).not.toBeNull();
    expect(comfort.slug).toBe('plush');
  });

  it('returns null when productId is an empty string (falsy guard)', async () => {
    const comfort = await getProductComfort('');
    expect(comfort).toBeNull();
  });

  it('returns null when mapping exists but comfort level was deleted', async () => {
    __seed('ProductComfort', [
      { _id: 'pc-orphan', productId: 'prod-orphan', comfortLevelId: 'cl-deleted', sortOrder: 1 },
    ]);
    // ComfortLevels has no entry with _id='cl-deleted'
    const comfort = await getProductComfort('prod-orphan');
    expect(comfort).toBeNull();
  });

  it('returns null on ProductComfort query error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __setQueryError('ProductComfort', new Error('Network error'));
    const comfort = await getProductComfort('prod-1');
    expect(comfort).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching product comfort:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it('returns null on ComfortLevels query error (after successful mapping lookup)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Seed ProductComfort normally, but make ComfortLevels query fail
    __setQueryError('ComfortLevels', new Error('CMS down'));
    const comfort = await getProductComfort('prod-1');
    expect(comfort).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('does not leak sortOrder or _createdDate from comfort level', async () => {
    const comfort = await getProductComfort('prod-3');
    expect(comfort).not.toBeNull();
    expect(comfort.slug).toBe('medium');
    expect(comfort.sortOrder).toBeUndefined();
    expect(comfort._createdDate).toBeUndefined();
    expect(comfort._owner).toBeUndefined();
  });
});

// ── getComfortProducts — deeper coverage ──────────────────────────────

describe('getComfortProducts (deepen)', () => {
  beforeEach(() => {
    __seed('ComfortLevels', COMFORT_LEVELS);
    __seed('ProductComfort', PRODUCT_COMFORT);
  });

  it('returns empty array for null slug (early return)', async () => {
    const ids = await getComfortProducts(null);
    expect(ids).toEqual([]);
  });

  it('returns empty array for undefined slug (early return)', async () => {
    const ids = await getComfortProducts(undefined);
    expect(ids).toEqual([]);
  });

  it('returns empty array for empty string slug (early return)', async () => {
    const ids = await getComfortProducts('');
    expect(ids).toEqual([]);
  });

  it('returns empty array when comfort level slug is not found', async () => {
    const ids = await getComfortProducts('ultra-plush');
    expect(ids).toEqual([]);
  });

  it('returns empty array when level exists but has no product mappings', async () => {
    __seed('ProductComfort', []);
    const ids = await getComfortProducts('plush');
    expect(ids).toEqual([]);
  });

  it('returns product IDs sorted by sortOrder', async () => {
    __seed('ProductComfort', [
      { _id: 'pc-z', productId: 'prod-last', comfortLevelId: 'cl-plush', sortOrder: 99 },
      { _id: 'pc-a', productId: 'prod-first', comfortLevelId: 'cl-plush', sortOrder: 1 },
      { _id: 'pc-m', productId: 'prod-mid', comfortLevelId: 'cl-plush', sortOrder: 50 },
    ]);
    const ids = await getComfortProducts('plush');
    expect(ids).toEqual(['prod-first', 'prod-mid', 'prod-last']);
  });

  it('only returns product IDs for the requested comfort level', async () => {
    const plushIds = await getComfortProducts('plush');
    const firmIds = await getComfortProducts('firm');
    const mediumIds = await getComfortProducts('medium');

    expect(plushIds).toEqual(expect.arrayContaining(['prod-1', 'prod-4']));
    expect(plushIds).toHaveLength(2);

    expect(firmIds).toEqual(['prod-2']);
    expect(mediumIds).toEqual(['prod-3']);
  });

  it('returns empty array on ComfortLevels query error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __setQueryError('ComfortLevels', new Error('DB unavailable'));
    const ids = await getComfortProducts('plush');
    expect(ids).toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error fetching comfort products:',
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it('returns empty array on ProductComfort query error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    __setQueryError('ProductComfort', new Error('Query failed'));
    const ids = await getComfortProducts('plush');
    expect(ids).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns only string values — no objects or extra CMS data', async () => {
    const ids = await getComfortProducts('plush');
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(typeof id).toBe('string');
    }
  });
});
