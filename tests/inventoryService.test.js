import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate, __setQueryError } from './__mocks__/wix-data.js';
import { withRateLimit } from './helpers/withRateLimit.js';
import {
  getStockStatus,
  signUpBackInStock,
  getInventoryUrgency,
} from '../src/backend/inventoryService.web.js';

beforeEach(() => {
  __seed('InventoryLevels', []);
  __seed('InventoryLog', []);
  __seed('BackInStockSignups', []);
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

    withRateLimit('BackInStockRateLimit', { key: 'test@example.com' });
    let insertCount = 0;
    __onInsert((col) => { if (col === 'BackInStockSignups') insertCount++; });

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






// ── getInventoryUrgency ─────────────────────────────────────────────

describe('getInventoryUrgency', () => {
  beforeEach(() => {
    __seed('InventoryLevels', []);
  });

  it('returns none for empty productId', async () => {
    const result = await getInventoryUrgency('');
    expect(result.level).toBe('none');
    expect(result.message).toBe('');
  });

  it('returns none for null productId', async () => {
    const result = await getInventoryUrgency(null);
    expect(result.level).toBe('none');
  });

  it('returns none when no inventory records', async () => {
    const result = await getInventoryUrgency('prod-unknown');
    expect(result.level).toBe('none');
    expect(result.count).toBe(0);
  });

  it('returns out when total quantity is 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', variantId: 'v-1', quantity: 0 },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('out');
    expect(result.message).toBe('Out of stock');
  });

  it('returns out when all variants at 0', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 0 },
      { _id: 'inv-2', productId: 'prod-1', quantity: 0 },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('out');
  });

  it('returns low with Only X left message when total ≤ 5', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 3 },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('low');
    expect(result.message).toBe('Only 3 left!');
    expect(result.count).toBe(3);
  });

  it('returns low when total is exactly 5 (boundary)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 5 },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('low');
    expect(result.message).toBe('Only 5 left!');
  });

  it('returns none when total is 6 (above threshold — no false urgency)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 6 },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('none');
    expect(result.message).toBe('');
  });

  it('returns none for well-stocked item', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 50 },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('none');
  });

  it('returns just_restocked when variant restocked within 48h', async () => {
    const recent = new Date(Date.now() - 24 * 60 * 60 * 1000);
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 20, lastRestocked: recent },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('just_restocked');
    expect(result.message).toBe('Just restocked!');
  });

  it('just_restocked takes precedence over low stock', async () => {
    const recent = new Date(Date.now() - 10 * 60 * 1000);
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 2, lastRestocked: recent },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('just_restocked');
  });

  it('does not return just_restocked when restock was 49h ago', async () => {
    const old = new Date(Date.now() - 49 * 60 * 60 * 1000);
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 20, lastRestocked: old },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('none');
  });

  it('aggregates total quantity across variants', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 2 },
      { _id: 'inv-2', productId: 'prod-1', quantity: 2 },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.count).toBe(4);
    expect(result.level).toBe('low');
    expect(result.message).toBe('Only 4 left!');
  });

  it('handles missing quantity field (treats as 0)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1' },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('out');
  });

  it('returns none on database error (catch path)', async () => {
    __setQueryError('InventoryLevels', new Error('DB unavailable'));
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('none');
    expect(result.count).toBe(0);
    expect(result.message).toBe('');
  });

  it('boundary: lastRestocked exactly at 48h is excluded (> not >=)', async () => {
    const exactly48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', quantity: 20, lastRestocked: exactly48h },
    ]);
    const result = await getInventoryUrgency('prod-1');
    expect(result.level).toBe('none');
  });
});
