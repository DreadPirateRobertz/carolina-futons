import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  getProductSocialProof,
  getCategorySocialProof,
  getSocialProofConfig,
} from '../src/backend/socialProof.web.js';

// ── getProductSocialProof ────────────────────────────────────────────

describe('getProductSocialProof', () => {
  it('returns empty notifications for no productId', async () => {
    const result = await getProductSocialProof(null);
    expect(result.notifications).toEqual([]);
    expect(result.config).toBeDefined();
  });

  it('returns config with every response', async () => {
    const result = await getProductSocialProof('prod-123');
    expect(result.config.maxPerSession).toBe(5);
    expect(result.config.minIntervalMs).toBe(60000);
    expect(result.config.autoDismissMs).toBe(5000);
    expect(result.config.position).toBe('bottom-left');
    expect(result.config.mobilePosition).toBe('bottom-full');
  });

  it('returns recent purchase notification when orders exist', async () => {
    const recentDate = new Date();
    recentDate.setHours(recentDate.getHours() - 2);
    __seed('Orders', [
      {
        _id: 'ord-1',
        _createdDate: recentDate,
        billingInfo: { firstName: 'Sarah', city: 'Asheville' },
        lineItems: [{ productId: 'prod-abc', name: 'Queen Futon Frame' }],
      },
    ]);
    const result = await getProductSocialProof('prod-abc', 'Queen Futon Frame');
    expect(result.notifications.length).toBeGreaterThan(0);
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('Sarah');
    expect(purchase.message).toContain('Asheville');
    expect(purchase.priority).toBe(1);
  });

  it('returns low stock notification when inventory is low', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-low', quantity: 3, productName: 'Hardwood Frame' },
    ]);
    const result = await getProductSocialProof('prod-low');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeDefined();
    expect(lowStock.message).toContain('3');
    expect(lowStock.message).toContain('left in stock');
    expect(lowStock.priority).toBe(2);
    expect(lowStock.urgency).toBe('medium');
  });

  it('marks urgency high when stock <= 2', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-vlow', quantity: 1 },
    ]);
    const result = await getProductSocialProof('prod-vlow');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeDefined();
    expect(lowStock.urgency).toBe('high');
  });

  it('does not show low stock when quantity is 0 (out of stock)', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-oos', quantity: 0 },
    ]);
    const result = await getProductSocialProof('prod-oos');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeUndefined();
  });

  it('does not show low stock when quantity > threshold', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-plenty', quantity: 20 },
    ]);
    const result = await getProductSocialProof('prod-plenty');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeUndefined();
  });

  it('returns popularity notification when views >= 5', async () => {
    const recentDate = new Date();
    const analytics = [];
    for (let i = 0; i < 7; i++) {
      analytics.push({
        _id: `pa-${i}`,
        productId: 'prod-popular',
        timestamp: recentDate,
      });
    }
    __seed('ProductAnalytics', analytics);
    const result = await getProductSocialProof('prod-popular');
    const popularity = result.notifications.find(n => n.type === 'popularity');
    expect(popularity).toBeDefined();
    expect(popularity.message).toContain('7');
    expect(popularity.message).toContain('viewed');
    expect(popularity.priority).toBe(3);
  });

  it('does not show popularity when views < 5', async () => {
    __seed('ProductAnalytics', [
      { _id: 'pa-1', productId: 'prod-few', timestamp: new Date() },
      { _id: 'pa-2', productId: 'prod-few', timestamp: new Date() },
    ]);
    const result = await getProductSocialProof('prod-few');
    const popularity = result.notifications.find(n => n.type === 'popularity');
    expect(popularity).toBeUndefined();
  });

  it('does not match orders for different products', async () => {
    __seed('Orders', [
      {
        _id: 'ord-1',
        _createdDate: new Date(),
        billingInfo: { firstName: 'John' },
        lineItems: [{ productId: 'prod-other', name: 'Other Item' }],
      },
    ]);
    const result = await getProductSocialProof('prod-target');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeUndefined();
  });

  it('anonymizes customer name (first name only, capitalized)', async () => {
    __seed('Orders', [
      {
        _id: 'ord-1',
        _createdDate: new Date(),
        billingInfo: { firstName: 'SARAH', city: 'asheville' },
        lineItems: [{ productId: 'prod-x', name: 'Frame' }],
      },
    ]);
    const result = await getProductSocialProof('prod-x');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase.message).toContain('Sarah');
    expect(purchase.message).not.toContain('SARAH');
    expect(purchase.message).toContain('Asheville');
  });

  it('handles missing billing info gracefully', async () => {
    __seed('Orders', [
      {
        _id: 'ord-1',
        _createdDate: new Date(),
        billingInfo: {},
        lineItems: [{ productId: 'prod-y', name: 'Frame' }],
      },
    ]);
    const result = await getProductSocialProof('prod-y');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('Someone');
  });

  it('sums inventory across variants', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-multi', quantity: 2 },
      { _id: 'inv-2', productId: 'prod-multi', quantity: 1 },
    ]);
    const result = await getProductSocialProof('prod-multi');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeDefined();
    expect(lowStock.message).toContain('3');
  });

  it('returns empty array on error (graceful degradation)', async () => {
    // Empty productId returns gracefully
    const result = await getProductSocialProof('');
    expect(result.notifications).toEqual([]);
    expect(result.config).toBeDefined();
  });
});

// ── getCategorySocialProof ───────────────────────────────────────────

describe('getCategorySocialProof', () => {
  it('returns empty for no categorySlug', async () => {
    const result = await getCategorySocialProof(null);
    expect(result.recentSalesCount).toBe(0);
    expect(result.lowStockProducts).toEqual([]);
    expect(result.config).toBeDefined();
  });

  it('returns low stock products', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-1', productName: 'Queen Frame', quantity: 3 },
      { _id: 'inv-2', productId: 'prod-2', productName: 'King Frame', quantity: 20 },
    ]);
    const result = await getCategorySocialProof('futon-frames');
    expect(result.lowStockProducts.length).toBe(1);
    expect(result.lowStockProducts[0].productName).toBe('Queen Frame');
    expect(result.lowStockProducts[0].quantity).toBe(3);
  });

  it('limits low stock products to 5', async () => {
    const items = [];
    for (let i = 0; i < 8; i++) {
      items.push({
        _id: `inv-${i}`,
        productId: `prod-${i}`,
        productName: `Item ${i}`,
        quantity: 2,
      });
    }
    __seed('InventoryLevels', items);
    const result = await getCategorySocialProof('futon-frames');
    expect(result.lowStockProducts.length).toBeLessThanOrEqual(5);
  });

  it('counts recent sales', async () => {
    const recent = new Date();
    recent.setHours(recent.getHours() - 1);
    __seed('Orders', [
      { _id: 'ord-1', _createdDate: recent },
      { _id: 'ord-2', _createdDate: recent },
      { _id: 'ord-3', _createdDate: recent },
    ]);
    const result = await getCategorySocialProof('futon-frames');
    expect(result.recentSalesCount).toBe(3);
  });

  it('excludes out-of-stock from low stock list', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-1', productId: 'prod-oos', productName: 'OOS Frame', quantity: 0 },
      { _id: 'inv-2', productId: 'prod-low', productName: 'Low Frame', quantity: 4 },
    ]);
    const result = await getCategorySocialProof('futon-frames');
    const names = result.lowStockProducts.map(p => p.productName);
    expect(names).not.toContain('OOS Frame');
    expect(names).toContain('Low Frame');
  });

  it('returns config with every response', async () => {
    const result = await getCategorySocialProof('mattresses');
    expect(result.config.maxPerSession).toBe(5);
    expect(result.config.autoDismissMs).toBe(5000);
  });
});

// ── getSocialProofConfig ─────────────────────────────────────────────

describe('getSocialProofConfig', () => {
  it('returns display configuration', async () => {
    const config = await getSocialProofConfig();
    expect(config.maxPerSession).toBe(5);
    expect(config.minIntervalMs).toBe(60000);
    expect(config.autoDismissMs).toBe(5000);
    expect(config.position).toBe('bottom-left');
    expect(config.mobilePosition).toBe('bottom-full');
  });
});
