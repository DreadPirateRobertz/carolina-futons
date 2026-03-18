/**
 * socialProofStale.test.js
 *
 * Tests for stale / empty data scenarios in socialProof.web.js:
 *   - Orders older than 48h excluded from recent_purchase
 *   - Analytics older than 24h excluded from popularity
 *   - All notification sources empty → no notifications
 *   - stockLevel = 0 (out-of-stock) → no low_stock shown
 *   - Category-level stale data filtering
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';
import {
  getProductSocialProof,
  getCategorySocialProof,
} from '../src/backend/socialProof.web.js';

beforeEach(() => {
  __reset();
});

// ── recent_purchase — stale order filtering ──────────────────────────

describe('getProductSocialProof — stale order filtering', () => {
  it('does not show recent_purchase for orders older than 48 hours', async () => {
    const staleDate = new Date(Date.now() - 49 * 3600000); // 49h ago
    __seed('Orders', [{
      _id: 'ord-stale',
      _createdDate: staleDate,
      billingInfo: { firstName: 'Old', city: 'Raleigh' },
      lineItems: [{ productId: 'prod-x', name: 'Old Frame' }],
    }]);

    const result = await getProductSocialProof('prod-x', 'Old Frame');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeUndefined();
  });

  it('shows recent_purchase for orders exactly within 48 hours', async () => {
    const recentDate = new Date(Date.now() - 47 * 3600000); // 47h ago
    __seed('Orders', [{
      _id: 'ord-recent',
      _createdDate: recentDate,
      billingInfo: { firstName: 'Jane', city: 'Durham' },
      lineItems: [{ productId: 'prod-y', name: 'Recent Frame' }],
    }]);

    const result = await getProductSocialProof('prod-y', 'Recent Frame');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
  });

  it('returns empty notifications when no orders exist at all', async () => {
    __seed('Orders', []);
    __seed('InventoryLevels', []);
    __seed('ProductAnalytics', []);
    __seed('Reviews', []);

    const result = await getProductSocialProof('prod-empty');
    expect(result.notifications).toEqual([]);
    expect(result.config).toBeDefined();
  });
});

// ── popularity — stale analytics filtering ───────────────────────────

describe('getProductSocialProof — popularity stale data', () => {
  it('does not show popularity for analytics older than 24 hours', async () => {
    const staleTimestamp = new Date(Date.now() - 25 * 3600000); // 25h ago
    const analytics = Array.from({ length: 10 }, (_, i) => ({
      _id: `pa-stale-${i}`,
      productId: 'prod-stale-views',
      timestamp: staleTimestamp,
    }));
    __seed('ProductAnalytics', analytics);

    const result = await getProductSocialProof('prod-stale-views');
    const popularity = result.notifications.find(n => n.type === 'popularity');
    expect(popularity).toBeUndefined();
  });

  it('shows popularity when analytics are within 24 hours', async () => {
    const recentTimestamp = new Date(Date.now() - 2 * 3600000); // 2h ago
    const analytics = Array.from({ length: 7 }, (_, i) => ({
      _id: `pa-recent-${i}`,
      productId: 'prod-fresh-views',
      timestamp: recentTimestamp,
    }));
    __seed('ProductAnalytics', analytics);

    const result = await getProductSocialProof('prod-fresh-views');
    const popularity = result.notifications.find(n => n.type === 'popularity');
    expect(popularity).toBeDefined();
    expect(popularity.message).toContain('7');
  });

  it('does not show popularity when view count is below 5', async () => {
    const now = new Date();
    __seed('ProductAnalytics', [
      { _id: 'pa-1', productId: 'prod-few-views', timestamp: now },
      { _id: 'pa-2', productId: 'prod-few-views', timestamp: now },
      { _id: 'pa-3', productId: 'prod-few-views', timestamp: now },
    ]);

    const result = await getProductSocialProof('prod-few-views');
    const popularity = result.notifications.find(n => n.type === 'popularity');
    expect(popularity).toBeUndefined();
  });
});

// ── low_stock — zero and null stock ─────────────────────────────────

describe('getProductSocialProof — stock edge cases', () => {
  it('does not show low_stock when quantity is 0 (out of stock)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-oos', quantity: 0 },
    ]);

    const result = await getProductSocialProof('prod-oos');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeUndefined();
  });

  it('does not show low_stock when no inventory record exists (null)', async () => {
    __seed('InventoryLevels', []); // empty — no record for product

    const result = await getProductSocialProof('prod-no-inv');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeUndefined();
  });

  it('does not show low_stock when quantity is above threshold (> 5)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-plenty', quantity: 50 },
    ]);

    const result = await getProductSocialProof('prod-plenty');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeUndefined();
  });

  it('shows low_stock with medium urgency when quantity is exactly 5 (threshold)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-threshold', quantity: 5 },
    ]);

    const result = await getProductSocialProof('prod-threshold');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeDefined();
    expect(lowStock.urgency).toBe('medium');
    expect(lowStock.message).toContain('5');
  });

  it('shows low_stock with high urgency when quantity is exactly 2', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-critical', quantity: 2 },
    ]);

    const result = await getProductSocialProof('prod-critical');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeDefined();
    expect(lowStock.urgency).toBe('high');
  });
});

// ── getCategorySocialProof — stale order filtering ───────────────────

describe('getCategorySocialProof — stale data', () => {
  it('does not count orders older than 48 hours in recentSalesCount', async () => {
    const staleDate = new Date(Date.now() - 72 * 3600000); // 72h ago
    __seed('Orders', [
      { _id: 'ord-old-1', _createdDate: staleDate },
      { _id: 'ord-old-2', _createdDate: staleDate },
    ]);
    __seed('InventoryLevels', []);

    const result = await getCategorySocialProof('futon-frames');
    expect(result.recentSalesCount).toBe(0);
  });

  it('counts recent orders within 48h window', async () => {
    const recent = new Date(Date.now() - 2 * 3600000);
    __seed('Orders', [
      { _id: 'ord-new-1', _createdDate: recent },
      { _id: 'ord-new-2', _createdDate: recent },
    ]);
    __seed('InventoryLevels', []);

    const result = await getCategorySocialProof('futon-frames');
    expect(result.recentSalesCount).toBe(2);
  });

  it('returns zero recentSalesCount and empty lowStockProducts for empty collections', async () => {
    __seed('Orders', []);
    __seed('InventoryLevels', []);

    const result = await getCategorySocialProof('futon-frames');
    expect(result.recentSalesCount).toBe(0);
    expect(result.lowStockProducts).toEqual([]);
  });

  it('excludes products with quantity 0 from low stock list', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-oos', productId: 'prod-oos', productName: 'OOS Frame', quantity: 0 },
    ]);
    __seed('Orders', []);

    const result = await getCategorySocialProof('futon-frames');
    const names = result.lowStockProducts.map(p => p.productName);
    expect(names).not.toContain('OOS Frame');
  });

  it('includes products with quantity 1-5 in low stock list', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', productName: 'Frame A', quantity: 1 },
      { _id: 'inv-2', productId: 'prod-2', productName: 'Frame B', quantity: 5 },
      { _id: 'inv-3', productId: 'prod-3', productName: 'Frame C', quantity: 6 }, // above threshold
    ]);
    __seed('Orders', []);

    const result = await getCategorySocialProof('futon-frames');
    const names = result.lowStockProducts.map(p => p.productName);
    expect(names).toContain('Frame A');
    expect(names).toContain('Frame B');
    expect(names).not.toContain('Frame C');
  });
});
