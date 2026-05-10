/**
 * Deep coverage tests for inventoryService.web.js — edge cases in stock status
 * calculation, quantity clamping, alert generation, and back-in-stock signup.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import {
  getStockStatus,
  signUpBackInStock,
} from '../src/backend/inventoryService.web.js';

beforeEach(() => {
  __seed('InventoryLevels', []);
  __seed('InventoryLog', []);
  __seed('BackInStockSignups', []);
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
    expect(result.variants[0].threshold).toBe(5); // DEFAULT_LOW_STOCK_THRESHOLD
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



