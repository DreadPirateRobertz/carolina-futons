import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  getStockStatus,
  getInventoryDashboard,
  updateStockLevel,
  getRestockSuggestions,
  signUpBackInStock,
  getBackInStockSignups,
  getLowStockAlerts,
  getBackInStockDashboard,
  markSignupsNotified,
  _DEFAULT_LOW_STOCK_THRESHOLD,
  _getVariantStatus,
} from '../src/backend/inventoryService.web.js';

beforeEach(() => {
  __seed('InventoryLevels', []);
  __seed('InventoryLog', []);
  __seed('BackInStockSignups', []);
});

// ── _getVariantStatus ──────────────────────────────────────────────

describe('_getVariantStatus', () => {
  it('returns out_of_stock for 0 quantity', () => {
    expect(_getVariantStatus(0, 5)).toBe('out_of_stock');
  });

  it('returns low_stock when at threshold', () => {
    expect(_getVariantStatus(5, 5)).toBe('low_stock');
  });

  it('returns low_stock when below threshold', () => {
    expect(_getVariantStatus(3, 5)).toBe('low_stock');
  });

  it('returns in_stock when above threshold', () => {
    expect(_getVariantStatus(10, 5)).toBe('in_stock');
  });

  it('default threshold is 5', () => {
    expect(_DEFAULT_LOW_STOCK_THRESHOLD).toBe(5);
  });
});

// ── getStockStatus ─────────────────────────────────────────────────

describe('getStockStatus', () => {
  it('returns in_stock with no inventory records (assumes available)', async () => {
    const result = await getStockStatus('prod-1');
    expect(result.status).toBe('in_stock');
    expect(result.variants).toEqual([]);
  });

  it('returns out_of_stock when all variants at 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 0, threshold: 5 },
      { _id: 'inv-2', productId: 'prod-1', variantId: 'v-2', quantity: 0, threshold: 5 },
    ]);

    const result = await getStockStatus('prod-1');
    expect(result.status).toBe('out_of_stock');
  });

  it('returns low_stock when any variant below threshold', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 3, threshold: 5 },
      { _id: 'inv-2', productId: 'prod-1', variantId: 'v-2', quantity: 20, threshold: 5 },
    ]);

    const result = await getStockStatus('prod-1');
    expect(result.status).toBe('low_stock');
  });

  it('returns in_stock when all above threshold', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 15, threshold: 5 },
    ]);

    const result = await getStockStatus('prod-1');
    expect(result.status).toBe('in_stock');
  });

  it('returns preOrder flag when any variant has preOrder', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 0, threshold: 5, preOrder: true },
    ]);

    const result = await getStockStatus('prod-1');
    expect(result.preOrder).toBe(true);
    // Pre-order products with 0 qty are not out_of_stock
    expect(result.status).not.toBe('out_of_stock');
  });

  it('returns variant details', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', variantLabel: 'Natural', quantity: 8, threshold: 5 },
    ]);

    const result = await getStockStatus('prod-1');
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].variantLabel).toBe('Natural');
    expect(result.variants[0].quantity).toBe(8);
    expect(result.variants[0].status).toBe('in_stock');
  });

  it('handles null productId', async () => {
    const result = await getStockStatus(null);
    expect(result.status).toBe('out_of_stock');
  });
});

// ── updateStockLevel ───────────────────────────────────────────────

describe('updateStockLevel', () => {
  it('creates new inventory record', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLevels') insertedItem = item;
    });

    const result = await updateStockLevel('prod-1', 'v-1', 20, {
      productName: 'Futon Frame',
      variantLabel: 'Natural',
    });

    expect(result.success).toBe(true);
    expect(result.previousQty).toBe(0);
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.quantity).toBe(20);
  });

  it('updates existing inventory record', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 10, threshold: 5 },
    ]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'InventoryLevels') updatedItem = item;
    });

    const result = await updateStockLevel('prod-1', 'v-1', 25);
    expect(result.success).toBe(true);
    expect(result.previousQty).toBe(10);
    expect(updatedItem.quantity).toBe(25);
  });

  it('logs inventory changes', async () => {
    let logItem = null;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLog') logItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', 15);
    expect(logItem).not.toBeNull();
    expect(logItem.change).toBe(15);
  });

  it('returns low_stock alert when below threshold', async () => {
    const result = await updateStockLevel('prod-1', 'v-1', 3, { threshold: 5 });
    expect(result.alerts).toContain('low_stock');
  });

  it('returns out_of_stock alert when going to 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 5, threshold: 5 },
    ]);

    const result = await updateStockLevel('prod-1', 'v-1', 0);
    expect(result.alerts).toContain('out_of_stock');
  });

  it('returns back_in_stock alert when restocking from 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 0, threshold: 5 },
    ]);

    const result = await updateStockLevel('prod-1', 'v-1', 10);
    expect(result.alerts).toContain('back_in_stock');
  });

  it('sets lastRestocked when quantity increases', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 5, threshold: 5 },
    ]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'InventoryLevels') updatedItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', 20);
    expect(updatedItem.lastRestocked).toBeDefined();
  });

  it('clamps quantity to 0 minimum', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLevels') insertedItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', -5);
    expect(insertedItem.quantity).toBe(0);
  });

  it('rejects missing productId', async () => {
    const result = await updateStockLevel(null, 'v-1', 10);
    expect(result.success).toBe(false);
  });

  it('rejects missing variantId', async () => {
    const result = await updateStockLevel('prod-1', null, 10);
    expect(result.success).toBe(false);
  });

  it('supports pre-order flag', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLevels') insertedItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', 0, { preOrder: true });
    expect(insertedItem.preOrder).toBe(true);
  });
});

// ── getInventoryDashboard ──────────────────────────────────────────

describe('getInventoryDashboard', () => {
  it('returns all products sorted by quantity ascending', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', productName: 'Futon', quantity: 20, threshold: 5 },
      { _id: 'inv-2', productId: 'prod-2', variantId: 'v-2', productName: 'Mattress', quantity: 2, threshold: 5 },
    ]);

    const result = await getInventoryDashboard();
    expect(result.products).toHaveLength(2);
    // Sorted ascending by quantity
    expect(result.products[0].quantity).toBeLessThanOrEqual(result.products[1].quantity);
  });

  it('filters by low_stock', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 20, threshold: 5 },
      { _id: 'inv-2', productId: 'prod-2', variantId: 'v-2', quantity: 3, threshold: 5 },
    ]);

    const result = await getInventoryDashboard('low_stock');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].productId).toBe('prod-2');
  });

  it('filters by out_of_stock', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 10, threshold: 5 },
      { _id: 'inv-2', productId: 'prod-2', variantId: 'v-2', quantity: 0, threshold: 5 },
    ]);

    const result = await getInventoryDashboard('out_of_stock');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].quantity).toBe(0);
  });
});

// ── signUpBackInStock ──────────────────────────────────────────────

describe('signUpBackInStock', () => {
  it('records a back-in-stock signup', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BackInStockSignups') insertedItem = item;
    });

    const result = await signUpBackInStock({
      email: 'test@example.com',
      productId: 'prod-1',
      productName: 'Futon Frame',
    });

    expect(result.success).toBe(true);
    expect(insertedItem).not.toBeNull();
    expect(insertedItem.email).toBe('test@example.com');
    expect(insertedItem.notified).toBe(false);
  });

  it('deduplicates signups for same email+product', async () => {
    __seed('BackInStockSignups', [
      { _id: 'bis-1', email: 'test@example.com', productId: 'prod-1', notified: false },
    ]);

    let insertCount = 0;
    __onInsert(() => { insertCount++; });

    const result = await signUpBackInStock({
      email: 'test@example.com',
      productId: 'prod-1',
    });

    expect(result.success).toBe(true);
    expect(insertCount).toBe(0);
  });

  it('rejects invalid email', async () => {
    const result = await signUpBackInStock({
      email: 'not-an-email',
      productId: 'prod-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing productId', async () => {
    const result = await signUpBackInStock({
      email: 'test@example.com',
    });
    expect(result.success).toBe(false);
  });
});

// ── getBackInStockSignups ──────────────────────────────────────────

describe('getBackInStockSignups', () => {
  it('returns pending signups for a product', async () => {
    __seed('BackInStockSignups', [
      { _id: 'bis-1', email: 'a@test.com', productId: 'prod-1', notified: false, signedUpAt: new Date() },
      { _id: 'bis-2', email: 'b@test.com', productId: 'prod-1', notified: true, signedUpAt: new Date() },
    ]);

    const result = await getBackInStockSignups('prod-1');
    expect(result.signups).toHaveLength(1);
    expect(result.signups[0].email).toBe('a@test.com');
  });

  it('returns empty for null productId', async () => {
    const result = await getBackInStockSignups(null);
    expect(result.signups).toEqual([]);
  });
});

// ── getLowStockAlerts ──────────────────────────────────────────────

describe('getLowStockAlerts', () => {
  it('returns products at or below threshold', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', productName: 'Futon', quantity: 3, threshold: 5 },
      { _id: 'inv-2', productId: 'prod-2', variantId: 'v-2', productName: 'Mattress', quantity: 20, threshold: 5 },
      { _id: 'inv-3', productId: 'prod-3', variantId: 'v-3', productName: 'Cover', quantity: 0, threshold: 5 },
    ]);

    const result = await getLowStockAlerts();
    expect(result.alerts).toHaveLength(2);
    expect(result.alerts.map(a => a.productId)).toContain('prod-1');
    expect(result.alerts.map(a => a.productId)).toContain('prod-3');
  });

  it('includes status field', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 0, threshold: 5 },
    ]);

    const result = await getLowStockAlerts();
    expect(result.alerts[0].status).toBe('out_of_stock');
  });
});

// ── getRestockSuggestions ──────────────────────────────────────────

describe('getRestockSuggestions', () => {
  it('calculates restock suggestions based on sales velocity', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', productName: 'Futon', quantity: 10 },
    ]);
    // 30 units sold in last 30 days = 1/day
    __seed('InventoryLog', [
      { _id: 'log-1', productId: 'prod-1', variantId: 'v-1', change: -30, timestamp: new Date(Date.now() - 15 * 86400000) },
    ]);

    const result = await getRestockSuggestions();
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].daysUntilOOS).toBe(10);
    expect(result.suggestions[0].dailySalesRate).toBe(1);
    expect(result.suggestions[0].suggestedRestock).toBe(30);
  });

  it('returns empty when no sales history', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 50 },
    ]);

    const result = await getRestockSuggestions();
    expect(result.suggestions).toEqual([]);
  });

  it('sorts by urgency (lowest days until OOS first)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', productName: 'Futon', quantity: 30 },
      { _id: 'inv-2', productId: 'prod-2', variantId: 'v-2', productName: 'Mattress', quantity: 5 },
    ]);
    __seed('InventoryLog', [
      { _id: 'log-1', productId: 'prod-1', variantId: 'v-1', change: -30, timestamp: new Date() },
      { _id: 'log-2', productId: 'prod-2', variantId: 'v-2', change: -30, timestamp: new Date() },
    ]);

    const result = await getRestockSuggestions();
    expect(result.suggestions[0].productId).toBe('prod-2'); // 5 qty, more urgent
    expect(result.suggestions[1].productId).toBe('prod-1'); // 30 qty, less urgent
  });
});

// ── getBackInStockDashboard ─────────────────────────────────────────

describe('getBackInStockDashboard', () => {
  it('returns zero counts when no signups exist', async () => {
    const result = await getBackInStockDashboard();
    expect(result.pendingSignups).toBe(0);
    expect(result.notifiedCount).toBe(0);
    expect(result.productBreakdown).toEqual([]);
  });

  it('counts pending vs notified signups', async () => {
    __seed('BackInStockSignups', [
      { _id: 's-1', productId: 'prod-1', productName: 'Futon A', email: 'a@test.com', notified: false, signedUpAt: new Date('2026-03-01') },
      { _id: 's-2', productId: 'prod-1', productName: 'Futon A', email: 'b@test.com', notified: false, signedUpAt: new Date('2026-03-02') },
      { _id: 's-3', productId: 'prod-2', productName: 'Futon B', email: 'c@test.com', notified: false, signedUpAt: new Date('2026-03-03') },
      { _id: 's-4', productId: 'prod-1', productName: 'Futon A', email: 'd@test.com', notified: true, signedUpAt: new Date('2026-02-15') },
    ]);

    const result = await getBackInStockDashboard();
    expect(result.pendingSignups).toBe(3);
    expect(result.notifiedCount).toBe(1);
    expect(result.productBreakdown).toHaveLength(2);

    const prod1 = result.productBreakdown.find(p => p.productId === 'prod-1');
    expect(prod1.count).toBe(2);
    expect(prod1.productName).toBe('Futon A');

    const prod2 = result.productBreakdown.find(p => p.productId === 'prod-2');
    expect(prod2.count).toBe(1);
  });

  it('tracks oldest signup date per product', async () => {
    __seed('BackInStockSignups', [
      { _id: 's-1', productId: 'prod-1', productName: 'Futon A', email: 'a@test.com', notified: false, signedUpAt: new Date('2026-03-10') },
      { _id: 's-2', productId: 'prod-1', productName: 'Futon A', email: 'b@test.com', notified: false, signedUpAt: new Date('2026-03-01') },
    ]);

    const result = await getBackInStockDashboard();
    const prod1 = result.productBreakdown.find(p => p.productId === 'prod-1');
    expect(prod1.oldestSignup).toEqual(new Date('2026-03-01'));
  });
});

// ── markSignupsNotified ─────────────────────────────────────────────

describe('markSignupsNotified', () => {
  it('marks pending signups as notified for a product', async () => {
    const updates = [];
    __onUpdate((collection, item) => {
      if (collection === 'BackInStockSignups') updates.push(item);
    });

    __seed('BackInStockSignups', [
      { _id: 's-1', productId: 'prod-1', email: 'a@test.com', notified: false },
      { _id: 's-2', productId: 'prod-1', email: 'b@test.com', notified: false },
      { _id: 's-3', productId: 'prod-2', email: 'c@test.com', notified: false },
    ]);

    const result = await markSignupsNotified('prod-1');
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(updates).toHaveLength(2);
    expect(updates[0].notified).toBe(true);
    expect(updates[0].notifiedAt).toBeInstanceOf(Date);
  });

  it('returns count 0 when no pending signups', async () => {
    __seed('BackInStockSignups', [
      { _id: 's-1', productId: 'prod-1', email: 'a@test.com', notified: true },
    ]);

    const result = await markSignupsNotified('prod-1');
    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
  });

  it('returns failure for missing productId', async () => {
    const result = await markSignupsNotified('');
    expect(result.success).toBe(false);
  });

  it('returns failure for null productId', async () => {
    const result = await markSignupsNotified(null);
    expect(result.success).toBe(false);
  });

  it('reports partial success when some updates fail', async () => {
    let updateCount = 0;
    __onUpdate((collection, item) => {
      if (collection === 'BackInStockSignups') {
        updateCount += 1;
        if (updateCount === 2) throw new Error('DB write failed');
      }
    });

    __seed('BackInStockSignups', [
      { _id: 's-1', productId: 'prod-1', email: 'a@test.com', notified: false },
      { _id: 's-2', productId: 'prod-1', email: 'b@test.com', notified: false },
      { _id: 's-3', productId: 'prod-1', email: 'c@test.com', notified: false },
    ]);

    const result = await markSignupsNotified('prod-1');
    expect(result.success).toBe(false);
    expect(result.count).toBe(2); // 1st and 3rd succeeded
    expect(result.failed).toBe(1);
  });
});
