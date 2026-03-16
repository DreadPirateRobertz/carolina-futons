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
  getInventoryDashboard,
  updateStockLevel,
  getRestockSuggestions,
  signUpBackInStock,
  getBackInStockSignups,
  getLowStockAlerts as serviceGetAlerts,
  getBackInStockDashboard,
  markSignupsNotified,
  _getVariantStatus,
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
// inventoryService.web.js — falsy-zero threshold fixes
// ═══════════════════════════════════════════════════════════════════

describe('inventoryService — falsy-zero threshold fixes', () => {
  it('getStockStatus: threshold 0 means any quantity > 0 is in_stock', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 1, threshold: 0 },
    ]);
    const r = await serviceStockStatus('p-1');
    expect(r.status).toBe('in_stock');
    expect(r.variants[0].status).toBe('in_stock');
    expect(r.variants[0].threshold).toBe(0);
  });

  it('getStockStatus: threshold 0, quantity 0 is out_of_stock', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 0, threshold: 0 },
    ]);
    const r = await serviceStockStatus('p-1');
    expect(r.status).toBe('out_of_stock');
    expect(r.variants[0].status).toBe('out_of_stock');
  });

  it('getInventoryDashboard: threshold 0 uses 0 not default 5', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 3, threshold: 0, productName: 'Test' },
    ]);
    const r = await getInventoryDashboard('all');
    expect(r.products[0].threshold).toBe(0);
    expect(r.products[0].status).toBe('in_stock'); // 3 > 0
  });

  it('getInventoryDashboard: filter low_stock with threshold 0 excludes item with qty > 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 3, threshold: 0 },
    ]);
    const r = await getInventoryDashboard('low_stock');
    expect(r.products).toHaveLength(0);
  });

  it('getLowStockAlerts: threshold 0 means only qty 0 items are alerted', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 0, threshold: 0 },
      { _id: 'inv-2', productId: 'p-2', variantId: 'v-2', quantity: 1, threshold: 0 },
    ]);
    const r = await serviceGetAlerts();
    // qty(0) <= threshold(0) => alerted, qty(1) > threshold(0) => not alerted
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0].productId).toBe('p-1');
  });
});

// ═══════════════════════════════════════════════════════════════════
// inventoryService.web.js — additional edge cases
// ═══════════════════════════════════════════════════════════════════

describe('inventoryService — edge cases', () => {
  it('getStockStatus: null productId returns out_of_stock', async () => {
    const r = await serviceStockStatus(null);
    expect(r.status).toBe('out_of_stock');
    expect(r.variants).toEqual([]);
  });

  it('getStockStatus: empty string productId returns out_of_stock', async () => {
    const r = await serviceStockStatus('');
    expect(r.status).toBe('out_of_stock');
  });

  it('getStockStatus: product with preOrder variant still in_stock when qty 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 0, threshold: 5, preOrder: true },
    ]);
    const r = await serviceStockStatus('p-1');
    expect(r.status).toBe('in_stock');
    expect(r.preOrder).toBe(true);
  });

  it('getStockStatus: mixed variants some in_stock some out_of_stock', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 0, threshold: 5 },
      { _id: 'inv-2', productId: 'p-1', variantId: 'v-2', quantity: 20, threshold: 5 },
    ]);
    const r = await serviceStockStatus('p-1');
    expect(r.status).toBe('in_stock');
    expect(r.variants[0].status).toBe('out_of_stock');
    expect(r.variants[1].status).toBe('in_stock');
  });

  it('updateStockLevel: missing productId returns failure', async () => {
    const r = await updateStockLevel(null, 'v-1', 10);
    expect(r.success).toBe(false);
  });

  it('updateStockLevel: missing variantId returns failure', async () => {
    const r = await updateStockLevel('p-1', null, 10);
    expect(r.success).toBe(false);
  });

  it('updateStockLevel: negative quantity clamped to 0', async () => {
    let inserted;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLevels') inserted = item;
    });

    const r = await updateStockLevel('p-1', 'v-1', -5);
    expect(r.success).toBe(true);
    expect(inserted.quantity).toBe(0);
  });

  it('updateStockLevel: fractional quantity floored', async () => {
    let inserted;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLevels') inserted = item;
    });

    await updateStockLevel('p-1', 'v-1', 7.8);
    expect(inserted.quantity).toBe(7);
  });

  it('updateStockLevel: creates new record if none exists', async () => {
    let inserted;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLevels') inserted = item;
    });

    const r = await updateStockLevel('p-1', 'v-1', 10);
    expect(r.success).toBe(true);
    expect(r.previousQty).toBe(0);
    expect(inserted).toBeDefined();
  });

  it('updateStockLevel: logs change when qty differs', async () => {
    let logInserted;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLog') logInserted = item;
    });

    await updateStockLevel('p-1', 'v-1', 10);
    expect(logInserted).toBeDefined();
    expect(logInserted.change).toBe(10);
  });

  it('updateStockLevel: does not log when qty unchanged', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 10, threshold: 5 },
    ]);
    let logInserted = false;
    __onInsert((collection) => {
      if (collection === 'InventoryLog') logInserted = true;
    });

    await updateStockLevel('p-1', 'v-1', 10);
    expect(logInserted).toBe(false);
  });

  it('updateStockLevel: alerts out_of_stock when dropping to 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 5, threshold: 3 },
    ]);
    const r = await updateStockLevel('p-1', 'v-1', 0);
    expect(r.alerts).toContain('out_of_stock');
  });

  it('updateStockLevel: alerts back_in_stock when restocking from 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 0, threshold: 5 },
    ]);
    const r = await updateStockLevel('p-1', 'v-1', 10);
    expect(r.alerts).toContain('back_in_stock');
  });

  it('updateStockLevel: alerts low_stock when dropping below threshold', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 10, threshold: 5 },
    ]);
    const r = await updateStockLevel('p-1', 'v-1', 3);
    expect(r.alerts).toContain('low_stock');
  });

  it('updateStockLevel: sets lastRestocked when qty increases', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 5, threshold: 3,
        lastRestocked: new Date('2025-01-01') },
    ]);
    let updated;
    __onUpdate((collection, item) => {
      if (collection === 'InventoryLevels') updated = item;
    });

    await updateStockLevel('p-1', 'v-1', 20);
    expect(updated.lastRestocked).not.toEqual(new Date('2025-01-01'));
  });

  it('updateStockLevel: preserves lastRestocked when qty decreases', async () => {
    const oldDate = new Date('2025-01-01');
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 20, threshold: 3,
        lastRestocked: oldDate },
    ]);
    let updated;
    __onUpdate((collection, item) => {
      if (collection === 'InventoryLevels') updated = item;
    });

    await updateStockLevel('p-1', 'v-1', 10);
    expect(updated.lastRestocked).toEqual(oldDate);
  });
});

// ═══════════════════════════════════════════════════════════════════
// inventoryService — signUpBackInStock + markSignupsNotified
// ═══════════════════════════════════════════════════════════════════

describe('inventoryService — back-in-stock signups', () => {
  it('signUpBackInStock: rejects invalid email', async () => {
    const r = await signUpBackInStock({ email: 'not-email', productId: 'p-1' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('email');
  });

  it('signUpBackInStock: rejects missing productId', async () => {
    const r = await signUpBackInStock({ email: 'test@example.com' });
    expect(r.success).toBe(false);
  });

  it('signUpBackInStock: deduplicates existing signup', async () => {
    __seed('BackInStockSignups', [{
      _id: 'bis-1', email: 'test@example.com', productId: 'p-1', notified: false,
    }]);
    let insertCount = 0;
    __onInsert((collection) => {
      if (collection === 'BackInStockSignups') insertCount++;
    });

    const r = await signUpBackInStock({ email: 'test@example.com', productId: 'p-1' });
    expect(r.success).toBe(true);
    expect(insertCount).toBe(0); // deduped
  });

  it('signUpBackInStock: allows re-signup after notification', async () => {
    __seed('BackInStockSignups', [{
      _id: 'bis-1', email: 'test@example.com', productId: 'p-1', notified: true,
    }]);
    let inserted = false;
    __onInsert((collection) => {
      if (collection === 'BackInStockSignups') inserted = true;
    });

    const r = await signUpBackInStock({ email: 'test@example.com', productId: 'p-1' });
    expect(r.success).toBe(true);
    expect(inserted).toBe(true);
  });

  it('signUpBackInStock: normalizes email to lowercase', async () => {
    let insertedItem;
    __onInsert((collection, item) => {
      if (collection === 'BackInStockSignups') insertedItem = item;
    });

    await signUpBackInStock({ email: 'Test@Example.COM', productId: 'p-1' });
    expect(insertedItem.email).toBe('test@example.com');
  });

  it('markSignupsNotified: returns failure without productId', async () => {
    const r = await markSignupsNotified(null);
    expect(r.success).toBe(false);
    expect(r.count).toBe(0);
  });

  it('markSignupsNotified: marks all pending signups for product', async () => {
    __seed('BackInStockSignups', [
      { _id: 'bis-1', email: 'a@b.com', productId: 'p-1', notified: false },
      { _id: 'bis-2', email: 'c@d.com', productId: 'p-1', notified: false },
      { _id: 'bis-3', email: 'e@f.com', productId: 'p-2', notified: false },
    ]);
    const r = await markSignupsNotified('p-1');
    expect(r.success).toBe(true);
    expect(r.count).toBe(2);
  });

  it('markSignupsNotified: skips already notified signups', async () => {
    __seed('BackInStockSignups', [
      { _id: 'bis-1', email: 'a@b.com', productId: 'p-1', notified: true },
    ]);
    const r = await markSignupsNotified('p-1');
    expect(r.count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// inventoryService — getRestockSuggestions
// ═══════════════════════════════════════════════════════════════════

describe('inventoryService — restock suggestions', () => {
  it('returns empty suggestions when no sales data', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 10, threshold: 5 },
    ]);
    const r = await getRestockSuggestions();
    expect(r.suggestions).toEqual([]);
  });

  it('calculates days until OOS based on sales velocity', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 30, productName: 'Test' },
    ]);
    __seed('InventoryLog', [
      { productId: 'p-1', variantId: 'v-1', change: -30, timestamp: new Date() },
    ]);
    const r = await getRestockSuggestions();
    expect(r.suggestions).toHaveLength(1);
    expect(r.suggestions[0].daysUntilOOS).toBe(30);
    expect(r.suggestions[0].suggestedRestock).toBe(30);
  });

  it('sorts by urgency (lowest days until OOS first)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 30 },
      { _id: 'inv-2', productId: 'p-2', variantId: 'v-2', quantity: 5 },
    ]);
    __seed('InventoryLog', [
      { productId: 'p-1', variantId: 'v-1', change: -30, timestamp: new Date() },
      { productId: 'p-2', variantId: 'v-2', change: -30, timestamp: new Date() },
    ]);
    const r = await getRestockSuggestions();
    expect(r.suggestions[0].productId).toBe('p-2');
    expect(r.suggestions[1].productId).toBe('p-1');
  });

  it('skips restocks (positive changes) in velocity calc', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 10 },
    ]);
    __seed('InventoryLog', [
      { productId: 'p-1', variantId: 'v-1', change: 50, timestamp: new Date() },
    ]);
    const r = await getRestockSuggestions();
    expect(r.suggestions).toEqual([]);
  });

  it('returns daysUntilOOS 0 for out-of-stock items', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'p-1', variantId: 'v-1', quantity: 0 },
    ]);
    __seed('InventoryLog', [
      { productId: 'p-1', variantId: 'v-1', change: -10, timestamp: new Date() },
    ]);
    const r = await getRestockSuggestions();
    expect(r.suggestions[0].daysUntilOOS).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// inventoryService — getBackInStockDashboard
// ═══════════════════════════════════════════════════════════════════

describe('inventoryService — back-in-stock dashboard', () => {
  it('returns zero counts when no signups', async () => {
    const r = await getBackInStockDashboard();
    expect(r.pendingSignups).toBe(0);
    expect(r.notifiedCount).toBe(0);
    expect(r.productBreakdown).toEqual([]);
  });

  it('groups pending signups by product', async () => {
    __seed('BackInStockSignups', [
      { _id: 'b-1', email: 'a@b.com', productId: 'p-1', productName: 'Frame A', notified: false, signedUpAt: new Date('2025-01-02') },
      { _id: 'b-2', email: 'c@d.com', productId: 'p-1', productName: 'Frame A', notified: false, signedUpAt: new Date('2025-01-01') },
      { _id: 'b-3', email: 'e@f.com', productId: 'p-2', productName: 'Frame B', notified: false, signedUpAt: new Date('2025-01-03') },
    ]);
    const r = await getBackInStockDashboard();
    expect(r.pendingSignups).toBe(3);
    expect(r.productBreakdown).toHaveLength(2);
    const p1 = r.productBreakdown.find(p => p.productId === 'p-1');
    expect(p1.count).toBe(2);
    expect(p1.oldestSignup).toEqual(new Date('2025-01-01'));
  });

  it('separates notified from pending', async () => {
    __seed('BackInStockSignups', [
      { _id: 'b-1', email: 'a@b.com', productId: 'p-1', notified: false, signedUpAt: new Date() },
      { _id: 'b-2', email: 'c@d.com', productId: 'p-1', notified: true, signedUpAt: new Date() },
    ]);
    const r = await getBackInStockDashboard();
    expect(r.pendingSignups).toBe(1);
    expect(r.notifiedCount).toBe(1);
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
