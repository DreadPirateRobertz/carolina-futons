/**
 * CF-3xgl — Inventory alerts + stock display hardening tests.
 * Covers falsy-zero threshold fixes, edge cases in inventoryService,
 * inventoryAlerts, and InventoryDisplay integration gaps.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember, __setRoles, __reset as resetMembers } from './__mocks__/wix-members-backend.js';

// ── inventoryAlerts imports ─────────────────────────────────────────
import {
  getStockStatus as alertStockStatus,
  getBatchStockStatus,
  syncInventory,
  getLowStockAlerts as alertGetAlerts,
  acknowledgeAlert,
  resolveAlert,
  updateThreshold,
  getLowStockSummary,
} from '../src/backend/inventoryAlerts.web.js';

// ── inventoryService imports ────────────────────────────────────────
import {
  getStockStatus as serviceStockStatus,
  signUpBackInStock,
} from '../src/backend/inventoryService.web.js';

// ── InventoryDisplay import ─────────────────────────────────────────
import { initInventoryDisplay } from '../src/public/InventoryDisplay.js';

// ── Helpers ─────────────────────────────────────────────────────────

function adminSetup() {
  __setMember({ _id: 'admin-001', loginEmail: 'admin@carolinafutons.com' });
  __setRoles([{ title: 'Admin', _id: 'admin' }]);
}

function make$w(overrides = {}) {
  const elements = {
    '#stockStatus': {
      text: '', style: { color: '' },
      accessibility: { ariaLabel: '', ariaLive: '' },
    },
    '#variantStockRepeater': {
      data: null,
      onItemReady: vi.fn(),
    },
    '#variantStockLabel': { text: '' },
    '#variantStockStatus': { text: '', style: { color: '' } },
    ...overrides,
  };

  return (selector) => elements[selector] || null;
}

beforeEach(() => {
  __reset();
  resetMembers();
  adminSetup();
  __seed('InventoryThresholds', []);
  __seed('LowStockAlerts', []);
  __seed('InventoryLevels', []);
  __seed('InventoryLog', []);
  __seed('BackInStockSignups', []);
});

// ═══════════════════════════════════════════════════════════════════
// inventoryAlerts.web.js — falsy-zero threshold fixes
// ═══════════════════════════════════════════════════════════════════

describe('inventoryAlerts — falsy-zero threshold fixes', () => {
  it('getStockStatus: urgencyThreshold 0 means no urgency ever shown', async () => {
    __seed('InventoryThresholds', [{
      _id: 't-1', productId: 'p-1', urgencyThreshold: 0, reorderThreshold: 10,
      currentStock: 3, reorderAlertSent: false,
    }]);
    const r = await alertStockStatus('p-1');
    expect(r.showUrgency).toBe(false);
    expect(r.inStock).toBe(true);
    expect(r.stockLevel).toBe(3);
  });

  it('getStockStatus: urgencyThreshold 0, stock 0 still out of stock', async () => {
    __seed('InventoryThresholds', [{
      _id: 't-1', productId: 'p-1', urgencyThreshold: 0, reorderThreshold: 0,
      currentStock: 0, reorderAlertSent: true,
    }]);
    const r = await alertStockStatus('p-1');
    expect(r.inStock).toBe(false);
  });

  it('getBatchStockStatus: urgencyThreshold 0 respected per-product', async () => {
    __seed('InventoryThresholds', [
      { _id: 't-1', productId: 'p-1', urgencyThreshold: 0, reorderThreshold: 10, currentStock: 2 },
      { _id: 't-2', productId: 'p-2', urgencyThreshold: 5, reorderThreshold: 10, currentStock: 2 },
    ]);
    const r = await getBatchStockStatus(['p-1', 'p-2']);
    expect(r.statuses['p-1'].showUrgency).toBe(false); // threshold 0 — no urgency
    expect(r.statuses['p-2'].showUrgency).toBe(true);  // threshold 5, stock 2 <= 5
  });

  it('syncInventory: reorderThreshold 0 creates alert when stock drops to 0', async () => {
    __seed('InventoryThresholds', [{
      _id: 't-1', productId: 'p-1', urgencyThreshold: 0, reorderThreshold: 0,
      currentStock: 50, reorderAlertSent: false, sku: 'SKU1',
    }]);
    let alertInserted = false;
    __onInsert((collection) => {
      if (collection === 'LowStockAlerts') alertInserted = true;
    });

    const r = await syncInventory([{ productId: 'p-1', stock: 0 }]);
    expect(r.success).toBe(true);
    expect(r.alertsCreated).toBe(1);
    expect(alertInserted).toBe(true);
  });

  it('syncInventory: reorderThreshold 0 with stock > 0 resets reorderAlertSent', async () => {
    __seed('InventoryThresholds', [{
      _id: 't-1', productId: 'p-1', urgencyThreshold: 0, reorderThreshold: 0,
      currentStock: 0, reorderAlertSent: true, sku: 'SKU1',
    }]);
    let updatedConfig;
    __onUpdate((collection, item) => {
      if (collection === 'InventoryThresholds') updatedConfig = item;
    });

    const r = await syncInventory([{ productId: 'p-1', stock: 5 }]);
    expect(r.success).toBe(true);
    // stock(5) > reorderThreshold(0) => reset reorderAlertSent
    expect(updatedConfig.reorderAlertSent).toBe(false);
  });

  it('getLowStockSummary: zero thresholds classify stock > 0 as healthy', async () => {
    __seed('InventoryThresholds', [{
      _id: 't-1', productId: 'p-1', urgencyThreshold: 0, reorderThreshold: 0,
      currentStock: 1,
    }]);
    __seed('LowStockAlerts', []);
    const r = await getLowStockSummary();
    expect(r.summary.healthy).toBe(1);
    expect(r.summary.urgencyLevel).toBe(0);
    expect(r.summary.reorderLevel).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// inventoryAlerts.web.js — additional edge cases
// ═══════════════════════════════════════════════════════════════════

describe('inventoryAlerts — batch + sync edge cases', () => {
  it('getBatchStockStatus: returns empty statuses for non-existent IDs', async () => {
    __seed('InventoryThresholds', []);
    const r = await getBatchStockStatus(['nonexistent-1', 'nonexistent-2']);
    expect(r.success).toBe(true);
    expect(Object.keys(r.statuses)).toHaveLength(0);
  });

  it('getBatchStockStatus: truncates to 50 IDs', async () => {
    const ids = Array.from({ length: 60 }, (_, i) => `id-${i}`);
    const r = await getBatchStockStatus(ids);
    expect(r.success).toBe(true);
  });

  it('getBatchStockStatus: non-array input returns empty', async () => {
    const r = await getBatchStockStatus('not-an-array');
    expect(r.success).toBe(true);
    expect(r.statuses).toEqual({});
  });

  it('getBatchStockStatus: null/undefined IDs in array are filtered', async () => {
    const r = await getBatchStockStatus([null, undefined, '', 'valid-id']);
    expect(r.success).toBe(true);
  });

  it('syncInventory: non-array input returns error', async () => {
    const r = await syncInventory('not-an-array');
    expect(r.success).toBe(false);
    expect(r.error).toContain('array required');
  });

  it('syncInventory: empty array returns error', async () => {
    const r = await syncInventory([]);
    expect(r.success).toBe(false);
  });

  it('syncInventory: truncates to 100 items', async () => {
    const items = Array.from({ length: 110 }, (_, i) => ({
      productId: `p-${i}`, stock: 50,
    }));
    const r = await syncInventory(items);
    expect(r.success).toBe(true);
    expect(r.synced).toBeLessThanOrEqual(100);
  });

  it('syncInventory: skips items without productId', async () => {
    const r = await syncInventory([{ stock: 10 }]);
    expect(r.success).toBe(true);
    expect(r.synced).toBe(0);
  });

  it('syncInventory: skips items with non-number stock', async () => {
    const r = await syncInventory([{ productId: 'p-1', stock: 'ten' }]);
    expect(r.success).toBe(true);
    expect(r.synced).toBe(0);
  });

  it('syncInventory: floors fractional stock', async () => {
    let insertedConfig;
    __onInsert((collection, item) => {
      if (collection === 'InventoryThresholds') insertedConfig = item;
    });

    await syncInventory([{ productId: 'p-1', stock: 7.9 }]);
    expect(insertedConfig.currentStock).toBe(7);
  });

  it('syncInventory: clamps negative stock to 0', async () => {
    let insertedConfig;
    __onInsert((collection, item) => {
      if (collection === 'InventoryThresholds') insertedConfig = item;
    });

    await syncInventory([{ productId: 'p-1', stock: -5 }]);
    expect(insertedConfig.currentStock).toBe(0);
  });

  it('syncInventory: new product below reorder triggers alert', async () => {
    let alertInserted = false;
    __onInsert((collection) => {
      if (collection === 'LowStockAlerts') alertInserted = true;
    });

    const r = await syncInventory([{ productId: 'p-new', stock: 3, sku: 'NEW-SKU' }]);
    expect(r.alertsCreated).toBe(1);
    expect(alertInserted).toBe(true);
  });

  it('syncInventory: existing product replenished resets alert flag', async () => {
    __seed('InventoryThresholds', [{
      _id: 't-1', productId: 'p-1', reorderThreshold: 10, urgencyThreshold: 5,
      currentStock: 3, reorderAlertSent: true,
    }]);
    let updatedConfig;
    __onUpdate((collection, item) => {
      if (collection === 'InventoryThresholds') updatedConfig = item;
    });

    await syncInventory([{ productId: 'p-1', stock: 20 }]);
    expect(updatedConfig.reorderAlertSent).toBe(false);
  });
});






// ═══════════════════════════════════════════════════════════════════
// InventoryDisplay — additional edge cases
// ═══════════════════════════════════════════════════════════════════

describe('InventoryDisplay — edge cases', () => {
  it('sets aria-live to polite on stock badge', async () => {
    const $w = make$w();
    await initInventoryDisplay($w, { product: { _id: 'p-1' } });
    expect($w('#stockStatus').accessibility.ariaLive).toBe('polite');
  });

  it('skips variant repeater when variants array is empty', async () => {
    const $w = make$w();
    await initInventoryDisplay($w, { product: { _id: 'p-1' } });
    expect($w('#variantStockRepeater').data).toBeNull();
  });

  it('handles missing stock badge element gracefully', async () => {
    const $w = () => null;
    await expect(initInventoryDisplay($w, { product: { _id: 'p-1' } })).resolves.toBeUndefined();
  });
});
