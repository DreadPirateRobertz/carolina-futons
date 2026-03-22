/**
 * Tests for inventorySync.web.js
 * CF-st0c: Live Inventory Low Stock badges
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as resetData, __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { products as mockProducts, __reset as resetStores, __setProducts, __setQueryError } from './__mocks__/wix-stores-backend.js';

import {
  syncInventoryFromStore,
  _computeProductStock,
  _BATCH_SIZE,
  _PAGE_SIZE,
} from '../src/backend/inventorySync.web.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-001',
    name: 'Night & Day Murphy Bed',
    sku: 'NDB-001',
    stock: { trackInventory: true, inStock: true, quantity: 20 },
    variants: [],
    ...overrides,
  };
}

function makeVariantProduct(variants) {
  return makeProduct({
    _id: 'prod-variant',
    name: 'Futon Frame with Variants',
    variants,
  });
}

function makeThresholdRecord(overrides = {}) {
  return {
    _id: 'thresh-001',
    productId: 'prod-001',
    sku: 'NDB-001',
    productName: 'Night & Day Murphy Bed',
    urgencyThreshold: 5,
    reorderThreshold: 10,
    currentStock: 20,
    reorderAlertSent: false,
    lastChecked: new Date('2026-01-01'),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. computeProductStock
// ═══════════════════════════════════════════════════════════════════════

describe('computeProductStock', () => {
  it('returns 0 for null product', () => {
    expect(_computeProductStock(null)).toBe(0);
  });

  it('returns 0 when stock is missing', () => {
    expect(_computeProductStock({ _id: 'p1' })).toBe(0);
  });

  it('returns 1 when trackInventory=false and inStock=true', () => {
    const product = makeProduct({ stock: { trackInventory: false, inStock: true } });
    expect(_computeProductStock(product)).toBe(1);
  });

  it('returns 0 when trackInventory=false and inStock=false', () => {
    const product = makeProduct({ stock: { trackInventory: false, inStock: false } });
    expect(_computeProductStock(product)).toBe(0);
  });

  it('returns product-level quantity when tracked, no variants', () => {
    const product = makeProduct({
      stock: { trackInventory: true, quantity: 15 },
      variants: [],
    });
    expect(_computeProductStock(product)).toBe(15);
  });

  it('returns 0 when tracked, no variants, quantity is 0', () => {
    const product = makeProduct({
      stock: { trackInventory: true, quantity: 0 },
      variants: [],
    });
    expect(_computeProductStock(product)).toBe(0);
  });

  it('sums variant quantities when variants present', () => {
    const product = makeVariantProduct([
      { _id: 'v1', sku: 'A', stock: { quantity: 8 } },
      { _id: 'v2', sku: 'B', stock: { quantity: 3 } },
    ]);
    expect(_computeProductStock(product)).toBe(11);
  });

  it('skips variants with null/negative quantities', () => {
    const product = makeVariantProduct([
      { _id: 'v1', sku: 'A', stock: { quantity: 5 } },
      { _id: 'v2', sku: 'B', stock: { quantity: null } },
      { _id: 'v3', sku: 'C', stock: { quantity: -2 } },
    ]);
    expect(_computeProductStock(product)).toBe(5);
  });

  it('skips null entries in variants array', () => {
    const product = makeVariantProduct([
      null,
      { _id: 'v1', sku: 'A', stock: { quantity: 7 } },
    ]);
    expect(_computeProductStock(product)).toBe(7);
  });

  it('returns 0 when all variants are out of stock', () => {
    const product = makeVariantProduct([
      { _id: 'v1', sku: 'A', stock: { quantity: 0 } },
      { _id: 'v2', sku: 'B', stock: { quantity: 0 } },
    ]);
    expect(_computeProductStock(product)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. syncInventoryFromStore — happy path
// ═══════════════════════════════════════════════════════════════════════

describe('syncInventoryFromStore — happy path', () => {
  beforeEach(() => {
    resetData();
    resetStores();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns success with zero counts when no products', async () => {
    __setProducts([]);
    const result = await syncInventoryFromStore();
    expect(result).toEqual({ success: true, synced: 0, alertsCreated: 0, errors: 0 });
  });

  it('inserts new InventoryThresholds record for a new product', async () => {
    const product = makeProduct({ stock: { trackInventory: true, quantity: 15 }, variants: [] });
    __setProducts([product]);

    const inserts = [];
    __onInsert((collection, item) => { if (collection === 'InventoryThresholds') inserts.push(item); });

    const result = await syncInventoryFromStore();
    expect(result.synced).toBe(1);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].productId).toBe('prod-001');
    expect(inserts[0].currentStock).toBe(15);
  });

  it('does not raise alert for new product with stock above reorder threshold', async () => {
    const product = makeProduct({ stock: { trackInventory: true, quantity: 20 }, variants: [] });
    __setProducts([product]);

    const alertInserts = [];
    __onInsert((collection, item) => { if (collection === 'LowStockAlerts') alertInserts.push(item); });

    const result = await syncInventoryFromStore();
    expect(result.alertsCreated).toBe(0);
    expect(alertInserts).toHaveLength(0);
  });

  it('raises LowStockAlerts for new product at or below reorder threshold', async () => {
    const product = makeProduct({ stock: { trackInventory: true, quantity: 8 }, variants: [] });
    __setProducts([product]);

    const alertInserts = [];
    __onInsert((collection, item) => { if (collection === 'LowStockAlerts') alertInserts.push(item); });

    const result = await syncInventoryFromStore();
    expect(result.alertsCreated).toBe(1);
    expect(alertInserts[0].stockLevel).toBe(8);
    expect(alertInserts[0].thresholdType).toBe('reorder');
    expect(alertInserts[0].status).toBe('active');
  });

  it('sets thresholdType to out_of_stock when quantity is 0', async () => {
    const product = makeProduct({ stock: { trackInventory: true, quantity: 0 }, variants: [] });
    __setProducts([product]);

    const alertInserts = [];
    __onInsert((collection, item) => { if (collection === 'LowStockAlerts') alertInserts.push(item); });

    await syncInventoryFromStore();
    expect(alertInserts[0].thresholdType).toBe('out_of_stock');
  });

  it('updates existing InventoryThresholds without raising duplicate alert', async () => {
    const product = makeProduct({ stock: { trackInventory: true, quantity: 12 }, variants: [] });
    __setProducts([product]);
    __seed('InventoryThresholds', [makeThresholdRecord({ currentStock: 15, reorderAlertSent: false })]);

    const updates = [];
    const alertInserts = [];
    __onUpdate((collection, item) => { if (collection === 'InventoryThresholds') updates.push(item); });
    __onInsert((collection, item) => { if (collection === 'LowStockAlerts') alertInserts.push(item); });

    const result = await syncInventoryFromStore();
    expect(result.synced).toBe(1);
    expect(updates[0].currentStock).toBe(12);
    expect(alertInserts).toHaveLength(0); // 12 > 10 reorder threshold — no alert
  });

  it('raises alert when existing product stock drops below reorder threshold', async () => {
    const product = makeProduct({ stock: { trackInventory: true, quantity: 7 }, variants: [] });
    __setProducts([product]);
    __seed('InventoryThresholds', [makeThresholdRecord({ currentStock: 15, reorderAlertSent: false })]);

    const alertInserts = [];
    __onInsert((collection, item) => { if (collection === 'LowStockAlerts') alertInserts.push(item); });

    const result = await syncInventoryFromStore();
    expect(result.alertsCreated).toBe(1);
    expect(alertInserts[0].stockLevel).toBe(7);
  });

  it('does not raise duplicate alert when reorderAlertSent is already true', async () => {
    const product = makeProduct({ stock: { trackInventory: true, quantity: 3 }, variants: [] });
    __setProducts([product]);
    __seed('InventoryThresholds', [makeThresholdRecord({ currentStock: 3, reorderAlertSent: true })]);

    const alertInserts = [];
    __onInsert((collection, item) => { if (collection === 'LowStockAlerts') alertInserts.push(item); });

    const result = await syncInventoryFromStore();
    expect(result.alertsCreated).toBe(0);
    expect(alertInserts).toHaveLength(0);
  });

  it('resets reorderAlertSent when stock recovers above threshold', async () => {
    const product = makeProduct({ stock: { trackInventory: true, quantity: 25 }, variants: [] });
    __setProducts([product]);
    __seed('InventoryThresholds', [makeThresholdRecord({ currentStock: 3, reorderAlertSent: true })]);

    const updates = [];
    __onUpdate((collection, item) => { if (collection === 'InventoryThresholds') updates.push(item); });

    await syncInventoryFromStore();
    expect(updates.some(u => u.reorderAlertSent === false)).toBe(true);
  });

  it('syncs multiple products', async () => {
    const p1 = makeProduct({ _id: 'p1', name: 'P1', stock: { trackInventory: true, quantity: 20 }, variants: [] });
    const p2 = makeProduct({ _id: 'p2', name: 'P2', stock: { trackInventory: true, quantity: 3 }, variants: [] });
    __setProducts([p1, p2]);

    const result = await syncInventoryFromStore();
    expect(result.synced).toBe(2);
    expect(result.alertsCreated).toBe(1); // p2 is below reorder threshold
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. syncInventoryFromStore — error handling
// ═══════════════════════════════════════════════════════════════════════

describe('syncInventoryFromStore — error handling', () => {
  beforeEach(() => {
    resetData();
    resetStores();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns success:false when queryProducts throws', async () => {
    __setQueryError(new Error('Stores API unavailable'));
    const result = await syncInventoryFromStore();
    expect(result.success).toBe(false);
    expect(result.synced).toBe(0);
  });

  it('counts individual product errors without aborting the batch', async () => {
    const p1 = makeProduct({ _id: 'p1', stock: { trackInventory: true, quantity: 5 }, variants: [] });
    const p2 = makeProduct({ _id: 'p2-bad', name: null, stock: null, variants: [] }); // stock=null will cause upsert to fail
    const p3 = makeProduct({ _id: 'p3', stock: { trackInventory: true, quantity: 20 }, variants: [] });
    __setProducts([p1, p2, p3]);

    const result = await syncInventoryFromStore();
    expect(result.synced).toBeGreaterThanOrEqual(2); // p1 and p3 succeed
    expect(result.success).toBe(true); // does not abort
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. Constants sanity
// ═══════════════════════════════════════════════════════════════════════

describe('module constants', () => {
  it('BATCH_SIZE is a positive integer', () => {
    expect(Number.isInteger(_BATCH_SIZE) && _BATCH_SIZE > 0).toBe(true);
  });

  it('PAGE_SIZE is a positive integer', () => {
    expect(Number.isInteger(_PAGE_SIZE) && _PAGE_SIZE > 0).toBe(true);
  });
});
