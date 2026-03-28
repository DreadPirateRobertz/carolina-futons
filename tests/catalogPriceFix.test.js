/**
 * Tests for catalogPriceFix.web.js — Call-for-price placeholder fix.
 * CF-azrt: Native Wix gallery price audit
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockProducts = [
  { _id: 'prod-asheville', name: 'Asheville Futon Frame', price: 1, slug: 'asheville-futon-frame' },
  { _id: 'prod-custom-table', name: 'Custom Dining Table', price: 0.99, slug: 'custom-dining-table' },
];

const mockQueryResult = { items: mockProducts };

const mockQuery = {
  le: vi.fn().mockReturnThis(),
  gt: vi.fn().mockReturnThis(),
  find: vi.fn().mockResolvedValue(mockQueryResult),
};

vi.mock('wix-stores-backend', () => ({
  products: {
    queryProducts: vi.fn(() => mockQuery),
    updateProductFields: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin' },
  webMethod: (_perm, fn) => fn,
}));

import { findCallForPriceProducts, fixCallForPricePlaceholders } from '../src/backend/catalogPriceFix.web.js';
import { products } from 'wix-stores-backend';

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery.find.mockResolvedValue(mockQueryResult);
});

// ── findCallForPriceProducts ─────────────────────────────────────────

describe('findCallForPriceProducts', () => {
  it('queries products with price between 0 and 1 (exclusive/inclusive)', async () => {
    const result = await findCallForPriceProducts();

    expect(products.queryProducts).toHaveBeenCalled();
    expect(mockQuery.le).toHaveBeenCalledWith('price', 1);
    expect(mockQuery.gt).toHaveBeenCalledWith('price', 0);
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(2);
  });

  it('returns product id, name, price, and slug', async () => {
    const result = await findCallForPriceProducts();

    expect(result.products[0]).toEqual({
      _id: 'prod-asheville',
      name: 'Asheville Futon Frame',
      price: 1,
      slug: 'asheville-futon-frame',
    });
  });

  it('returns error on query failure', async () => {
    mockQuery.find.mockRejectedValueOnce(new Error('DB error'));

    const result = await findCallForPriceProducts();

    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
    expect(result.error).toBe('DB error');
  });
});

// ── fixCallForPricePlaceholders ─────────────────────────────────────

describe('fixCallForPricePlaceholders', () => {
  it('dry run reports changes without updating', async () => {
    const result = await fixCallForPricePlaceholders(true);

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.updated).toHaveLength(2);
    expect(result.updated[0]).toContain('[DRY RUN]');
    expect(result.updated[0]).toContain('Asheville');
    expect(products.updateProductFields).not.toHaveBeenCalled();
  });

  it('defaults to dry run', async () => {
    const result = await fixCallForPricePlaceholders();

    expect(result.dryRun).toBe(true);
    expect(products.updateProductFields).not.toHaveBeenCalled();
  });

  it('updates products to price=0 when not dry run', async () => {
    const result = await fixCallForPricePlaceholders(false);

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(products.updateProductFields).toHaveBeenCalledTimes(2);
    expect(products.updateProductFields).toHaveBeenCalledWith('prod-asheville', { price: 0 });
    expect(products.updateProductFields).toHaveBeenCalledWith('prod-custom-table', { price: 0 });
    expect(result.updated).toHaveLength(2);
    expect(result.updated[0]).toContain('Updated:');
  });

  it('reports failures per product without aborting', async () => {
    products.updateProductFields
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('Permission denied'));

    const result = await fixCallForPricePlaceholders(false);

    expect(result.success).toBe(true);
    expect(result.updated).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toContain('Permission denied');
  });

  it('returns error on query failure', async () => {
    mockQuery.find.mockRejectedValueOnce(new Error('Network timeout'));

    const result = await fixCallForPricePlaceholders(false);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Network timeout');
  });
});
