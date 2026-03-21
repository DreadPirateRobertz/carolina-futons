/**
 * Tests for CF-67dp: Room Planner S8 — product catalog integration.
 * Covers: getRoomPlannerProducts (pagination, tag filter, error paths),
 * addRoomPlannerTag, removeRoomPlannerTag (CMS tag management).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: vi.fn((_, fn) => fn),
}));

import {
  __seed,
  __reset as resetData,
  __setQueryError,
  __getUpdated,
} from './__mocks__/wix-data.js';
import {
  getRoomPlannerProducts,
  addRoomPlannerTag,
  removeRoomPlannerTag,
} from '../src/backend/roomPlannerProducts.web.js';

const TAG = 'room-planner-compatible';

function makeProduct(id, overrides = {}) {
  return {
    _id: id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    price: 499,
    mainMedia: `https://example.com/${id}.jpg`,
    description: `Description for ${id}`,
    tags: [TAG],
    ...overrides,
  };
}

beforeEach(() => {
  resetData();
});

// ── getRoomPlannerProducts ────────────────────────────────────────────────────

describe('getRoomPlannerProducts', () => {
  it('returns success with items from Stores/Products', async () => {
    __seed('Stores/Products', [makeProduct('p1'), makeProduct('p2')]);
    const result = await getRoomPlannerProducts({});
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
  });

  it('returns only products tagged room-planner-compatible', async () => {
    __seed('Stores/Products', [
      makeProduct('p1'),
      makeProduct('p2', { tags: ['other-tag'] }),
      makeProduct('p3'),
    ]);
    const result = await getRoomPlannerProducts({});
    expect(result.success).toBe(true);
    // hasSome filter should exclude p2
    expect(result.products.some(p => p._id === 'p2')).toBe(false);
  });

  it('returns 20 products per page by default', async () => {
    const products = Array.from({ length: 30 }, (_, i) => makeProduct(`p${i}`));
    __seed('Stores/Products', products);
    const result = await getRoomPlannerProducts({});
    expect(result.products).toHaveLength(20);
  });

  it('respects limit parameter (max 20)', async () => {
    const products = Array.from({ length: 30 }, (_, i) => makeProduct(`p${i}`));
    __seed('Stores/Products', products);
    const result = await getRoomPlannerProducts({ limit: 10 });
    expect(result.products).toHaveLength(10);
  });

  it('caps limit at 20 even if higher value is passed', async () => {
    const products = Array.from({ length: 30 }, (_, i) => makeProduct(`p${i}`));
    __seed('Stores/Products', products);
    const result = await getRoomPlannerProducts({ limit: 50 });
    expect(result.products).toHaveLength(20);
  });

  it('paginates via skip', async () => {
    const products = Array.from({ length: 25 }, (_, i) => makeProduct(`p${i}`));
    __seed('Stores/Products', products);
    const page1 = await getRoomPlannerProducts({ skip: 0, limit: 20 });
    const page2 = await getRoomPlannerProducts({ skip: 20, limit: 20 });
    expect(page1.products).toHaveLength(20);
    expect(page2.products).toHaveLength(5);
  });

  it('returns totalCount in response', async () => {
    __seed('Stores/Products', [makeProduct('p1'), makeProduct('p2'), makeProduct('p3')]);
    const result = await getRoomPlannerProducts({});
    expect(typeof result.totalCount).toBe('number');
    expect(result.totalCount).toBe(3);
  });

  it('returns hasMore: true when more pages exist', async () => {
    const products = Array.from({ length: 25 }, (_, i) => makeProduct(`p${i}`));
    __seed('Stores/Products', products);
    const result = await getRoomPlannerProducts({ skip: 0, limit: 20 });
    expect(result.hasMore).toBe(true);
  });

  it('returns hasMore: false on last page', async () => {
    const products = Array.from({ length: 25 }, (_, i) => makeProduct(`p${i}`));
    __seed('Stores/Products', products);
    const result = await getRoomPlannerProducts({ skip: 20, limit: 20 });
    expect(result.hasMore).toBe(false);
  });

  it('returns empty products array when no products are tagged', async () => {
    __seed('Stores/Products', [makeProduct('p1', { tags: ['other'] })]);
    const result = await getRoomPlannerProducts({});
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('each product has required fields', async () => {
    __seed('Stores/Products', [makeProduct('p1')]);
    const result = await getRoomPlannerProducts({});
    const p = result.products[0];
    expect(p).toHaveProperty('_id');
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('slug');
    expect(p).toHaveProperty('price');
    expect(p).toHaveProperty('mainMedia');
  });

  it('returns success: false and empty products on wixData error', async () => {
    __setQueryError('Stores/Products', new Error('DB connection failed'));
    const result = await getRoomPlannerProducts({});
    expect(result.success).toBe(false);
    expect(result.products).toHaveLength(0);
    expect(typeof result.error).toBe('string');
  });

  it('treats skip < 0 as 0', async () => {
    __seed('Stores/Products', [makeProduct('p1')]);
    const result = await getRoomPlannerProducts({ skip: -5 });
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(1);
  });
});

// ── addRoomPlannerTag ────────────────────────────────────────────────────────

describe('addRoomPlannerTag', () => {
  it('returns success when product exists', async () => {
    __seed('Stores/Products', [makeProduct('p1', { tags: [] })]);
    const result = await addRoomPlannerTag('p1');
    expect(result.success).toBe(true);
  });

  it('returns error when product not found', async () => {
    const result = await addRoomPlannerTag('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('does not write if tag already present (idempotent — no wixData.update call)', async () => {
    __seed('Stores/Products', [makeProduct('p1', { tags: [TAG] })]);
    await addRoomPlannerTag('p1');
    const updated = __getUpdated('Stores/Products');
    // Correct behavior: no write occurs when tag is already present
    expect(updated).toHaveLength(0);
  });

  it('adds the room-planner-compatible tag to the product', async () => {
    __seed('Stores/Products', [makeProduct('p1', { tags: ['other'] })]);
    await addRoomPlannerTag('p1');
    const updated = __getUpdated('Stores/Products');
    expect(updated.length).toBeGreaterThan(0);
    expect(updated[0].tags).toContain(TAG);
  });
});

// ── removeRoomPlannerTag ─────────────────────────────────────────────────────

describe('removeRoomPlannerTag', () => {
  it('returns success when product exists', async () => {
    __seed('Stores/Products', [makeProduct('p1', { tags: [TAG, 'other'] })]);
    const result = await removeRoomPlannerTag('p1');
    expect(result.success).toBe(true);
  });

  it('returns error when product not found', async () => {
    const result = await removeRoomPlannerTag('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('removes the room-planner-compatible tag', async () => {
    __seed('Stores/Products', [makeProduct('p1', { tags: [TAG, 'other'] })]);
    await removeRoomPlannerTag('p1');
    const updated = __getUpdated('Stores/Products');
    expect(updated.length).toBeGreaterThan(0);
    expect(updated[0].tags).not.toContain(TAG);
  });

  it('leaves other tags intact', async () => {
    __seed('Stores/Products', [makeProduct('p1', { tags: [TAG, 'keep-this'] })]);
    await removeRoomPlannerTag('p1');
    const updated = __getUpdated('Stores/Products');
    expect(updated[0].tags).toContain('keep-this');
  });

  it('is a no-op if tag was not present (idempotent — no wixData.update call)', async () => {
    __seed('Stores/Products', [makeProduct('p1', { tags: ['other'] })]);
    await removeRoomPlannerTag('p1');
    const updated = __getUpdated('Stores/Products');
    expect(updated).toHaveLength(0);
  });

  it('handles null tags array gracefully', async () => {
    __seed('Stores/Products', [makeProduct('p1', { tags: null })]);
    const result = await removeRoomPlannerTag('p1');
    expect(result.success).toBe(true);
  });
});

// ── input validation ──────────────────────────────────────────────────────────

describe('addRoomPlannerTag — input validation', () => {
  it('returns error for null productId', async () => {
    const result = await addRoomPlannerTag(null);
    expect(result.success).toBe(false);
  });

  it('returns error for empty string productId', async () => {
    const result = await addRoomPlannerTag('');
    expect(result.success).toBe(false);
  });
});

describe('removeRoomPlannerTag — input validation', () => {
  it('returns error for null productId', async () => {
    const result = await removeRoomPlannerTag(null);
    expect(result.success).toBe(false);
  });

  it('returns error for empty string productId', async () => {
    const result = await removeRoomPlannerTag('');
    expect(result.success).toBe(false);
  });
});

// ── pagination edge cases ────────────────────────────────────────────────────

describe('getRoomPlannerProducts — pagination edge cases', () => {
  it('hasMore is false when exactly PAGE_SIZE products returned (fencepost)', async () => {
    const products = Array.from({ length: 20 }, (_, i) => makeProduct(`p${i}`));
    __seed('Stores/Products', products);
    const result = await getRoomPlannerProducts({ skip: 0, limit: 20 });
    expect(result.products).toHaveLength(20);
    expect(result.hasMore).toBe(false);
  });

  it('products include description field', async () => {
    __seed('Stores/Products', [makeProduct('p1')]);
    const result = await getRoomPlannerProducts({});
    expect(result.products[0]).toHaveProperty('description');
  });
});
