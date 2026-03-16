/**
 * Deep coverage tests for inventoryService.web.js — edge cases in stock status
 * calculation, quantity clamping, alert generation, and back-in-stock signup.
 */
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
  _DEFAULT_LOW_STOCK_THRESHOLD,
  _getVariantStatus,
} from '../src/backend/inventoryService.web.js';

beforeEach(() => {
  __seed('InventoryLevels', []);
  __seed('InventoryLog', []);
  __seed('BackInStockSignups', []);
});

// ── _getVariantStatus edge cases ─────────────────────────────────────

describe('_getVariantStatus — edge cases', () => {
  it('returns out_of_stock for negative quantity', () => {
    expect(_getVariantStatus(-1, 5)).toBe('out_of_stock');
  });

  it('returns low_stock for quantity of 1 with default threshold', () => {
    expect(_getVariantStatus(1, _DEFAULT_LOW_STOCK_THRESHOLD)).toBe('low_stock');
  });

  it('returns in_stock for quantity just above threshold', () => {
    expect(_getVariantStatus(6, 5)).toBe('in_stock');
  });

  it('handles threshold of 0 — only out_of_stock at 0', () => {
    expect(_getVariantStatus(0, 0)).toBe('out_of_stock');
    expect(_getVariantStatus(1, 0)).toBe('in_stock');
  });
});

// ── getStockStatus edge cases ────────────────────────────────────────

describe('getStockStatus — edge cases', () => {
  it('returns out_of_stock for empty string productId', async () => {
    const result = await getStockStatus('');
    expect(result.status).toBe('out_of_stock');
  });

  it('returns out_of_stock for undefined productId', async () => {
    const result = await getStockStatus(undefined);
    expect(result.status).toBe('out_of_stock');
  });

  it('uses default threshold when item has no threshold', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 3 },
    ]);

    const result = await getStockStatus('prod-1');
    expect(result.variants[0].threshold).toBe(_DEFAULT_LOW_STOCK_THRESHOLD);
    expect(result.variants[0].status).toBe('low_stock');
  });

  it('returns in_stock with preOrder when qty=0 and preOrder=true', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 0, preOrder: true },
    ]);

    const result = await getStockStatus('prod-1');
    expect(result.preOrder).toBe(true);
    expect(result.status).toBe('in_stock');
  });

  it('handles mixed variants with one in_stock and one out_of_stock', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 20, threshold: 5 },
      { _id: 'inv-2', productId: 'prod-1', variantId: 'v-2', quantity: 0, threshold: 5 },
    ]);

    const result = await getStockStatus('prod-1');
    // totalQty=20, but lowestQty=0 → low_stock check: 0 > 0 is false, so in_stock
    // Wait — 0 <= 0 and not preOrder → out_of_stock? No — totalQty > 0 so not out_of_stock
    // lowestQty=0, 0 > 0 is false, so low_stock check fails → falls through to in_stock
    expect(result.status).toBe('in_stock');
  });

  it('sets variantLabel to empty string when missing', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 10 },
    ]);

    const result = await getStockStatus('prod-1');
    expect(result.variants[0].variantLabel).toBe('');
  });

  it('preOrder flag is false for non-preorder variants', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 10 },
    ]);

    const result = await getStockStatus('prod-1');
    expect(result.variants[0].preOrder).toBe(false);
  });
});

// ── updateStockLevel edge cases ──────────────────────────────────────

describe('updateStockLevel — edge cases', () => {
  it('clamps fractional quantity to floor', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLevels') insertedItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', 7.8);
    expect(insertedItem.quantity).toBe(7);
  });

  it('handles NaN quantity as 0', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLevels') insertedItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', NaN);
    expect(insertedItem.quantity).toBe(0);
  });

  it('handles string quantity via Number coercion', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLevels') insertedItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', '15');
    expect(insertedItem.quantity).toBe(15);
  });

  it('rejects empty string productId', async () => {
    const result = await updateStockLevel('', 'v-1', 10);
    expect(result.success).toBe(false);
  });

  it('rejects empty string variantId', async () => {
    const result = await updateStockLevel('prod-1', '', 10);
    expect(result.success).toBe(false);
  });

  it('does not log when quantity unchanged', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 10, threshold: 5 },
    ]);

    let logInserted = false;
    __onInsert((collection) => {
      if (collection === 'InventoryLog') logInserted = true;
    });

    await updateStockLevel('prod-1', 'v-1', 10);
    expect(logInserted).toBe(false);
  });

  it('does not set lastRestocked when quantity decreases', async () => {
    const oldDate = new Date('2025-01-01');
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 20, threshold: 5, lastRestocked: oldDate },
    ]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'InventoryLevels') updatedItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', 10);
    expect(updatedItem.lastRestocked).toBe(oldDate);
  });

  it('returns both low_stock and back_in_stock when restocking to below threshold', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 0, threshold: 10 },
    ]);

    const result = await updateStockLevel('prod-1', 'v-1', 3);
    expect(result.alerts).toContain('low_stock');
    expect(result.alerts).toContain('back_in_stock');
  });

  it('preserves existing sku when not provided in options', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 10, sku: 'CF-FR-NAT', threshold: 5 },
    ]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'InventoryLevels') updatedItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', 15);
    expect(updatedItem.sku).toBe('CF-FR-NAT');
  });

  it('sanitizes reason string', async () => {
    let logItem = null;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLog') logItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', 10, { reason: 'Restocked from warehouse' });
    expect(logItem.reason).toBe('Restocked from warehouse');
  });

  it('uses empty reason when not provided', async () => {
    let logItem = null;
    __onInsert((collection, item) => {
      if (collection === 'InventoryLog') logItem = item;
    });

    await updateStockLevel('prod-1', 'v-1', 10);
    expect(logItem.reason).toBe('');
  });
});

// ── signUpBackInStock edge cases ─────────────────────────────────────

describe('signUpBackInStock — edge cases', () => {
  it('normalizes email to lowercase', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BackInStockSignups') insertedItem = item;
    });

    await signUpBackInStock({ email: 'TEST@EXAMPLE.COM', productId: 'prod-1' });
    expect(insertedItem.email).toBe('test@example.com');
  });

  it('handles missing variantId as empty string', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BackInStockSignups') insertedItem = item;
    });

    await signUpBackInStock({ email: 'a@b.com', productId: 'prod-1' });
    expect(insertedItem.variantId).toBe('');
  });

  it('rejects missing email', async () => {
    const result = await signUpBackInStock({ productId: 'prod-1' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('rejects null email', async () => {
    const result = await signUpBackInStock({ email: null, productId: 'prod-1' });
    expect(result.success).toBe(false);
  });

  it('rejects empty params', async () => {
    const result = await signUpBackInStock({});
    expect(result.success).toBe(false);
  });

  it('rejects no params', async () => {
    const result = await signUpBackInStock();
    expect(result.success).toBe(false);
  });

  it('handles missing productName gracefully', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'BackInStockSignups') insertedItem = item;
    });

    await signUpBackInStock({ email: 'a@b.com', productId: 'prod-1' });
    expect(insertedItem.productName).toBe('');
  });
});

// ── getInventoryDashboard edge cases ─────────────────────────────────

describe('getInventoryDashboard — edge cases', () => {
  it('returns empty products for empty inventory', async () => {
    const result = await getInventoryDashboard();
    expect(result.products).toEqual([]);
  });

  it('defaults to all filter when no filter provided', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 20, threshold: 5 },
      { _id: 'inv-2', productId: 'prod-2', variantId: 'v-2', quantity: 0, threshold: 5 },
    ]);

    const result = await getInventoryDashboard();
    expect(result.products).toHaveLength(2);
  });

  it('ignores unknown filter values (returns all)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 20, threshold: 5 },
    ]);

    const result = await getInventoryDashboard('unknown_filter');
    expect(result.products).toHaveLength(1);
  });

  it('uses default threshold for items without threshold', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 3 },
    ]);

    const result = await getInventoryDashboard();
    expect(result.products[0].threshold).toBe(_DEFAULT_LOW_STOCK_THRESHOLD);
  });

  it('includes sku field with empty default', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 10 },
    ]);

    const result = await getInventoryDashboard();
    expect(result.products[0].sku).toBe('');
  });
});

// ── getLowStockAlerts edge cases ─────────────────────────────────────

describe('getLowStockAlerts — edge cases', () => {
  it('returns empty when all products above threshold', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 50, threshold: 5 },
    ]);

    const result = await getLowStockAlerts();
    expect(result.alerts).toEqual([]);
  });

  it('uses default threshold when item threshold is missing', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 4 },
    ]);

    const result = await getLowStockAlerts();
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].threshold).toBe(_DEFAULT_LOW_STOCK_THRESHOLD);
  });

  it('includes out_of_stock items in alerts', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 0, threshold: 5 },
    ]);

    const result = await getLowStockAlerts();
    expect(result.alerts[0].status).toBe('out_of_stock');
  });
});

// ── getRestockSuggestions edge cases ──────────────────────────────────

describe('getRestockSuggestions — edge cases', () => {
  it('ignores positive changes (restocks) in velocity calculation', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 10 },
    ]);
    __seed('InventoryLog', [
      { _id: 'log-1', productId: 'prod-1', variantId: 'v-1', change: 50, timestamp: new Date() }, // restock
    ]);

    const result = await getRestockSuggestions();
    expect(result.suggestions).toEqual([]);
  });

  it('returns 0 daysUntilOOS when quantity is 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 0 },
    ]);
    __seed('InventoryLog', [
      { _id: 'log-1', productId: 'prod-1', variantId: 'v-1', change: -10, timestamp: new Date() },
    ]);

    const result = await getRestockSuggestions();
    expect(result.suggestions[0].daysUntilOOS).toBe(0);
  });

  it('uses empty string for missing productName and variantLabel', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 5 },
    ]);
    __seed('InventoryLog', [
      { _id: 'log-1', productId: 'prod-1', variantId: 'v-1', change: -15, timestamp: new Date() },
    ]);

    const result = await getRestockSuggestions();
    expect(result.suggestions[0].productName).toBe('');
    expect(result.suggestions[0].variantLabel).toBe('');
  });
});
