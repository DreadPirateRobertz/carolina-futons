/**
 * socialProofCoverage.test.js
 *
 * Targets uncovered error-catch lines in socialProof.web.js:
 *   Line 108 — getProductSocialProof outer catch
 *   Line 224 — getStockLevel catch → return null
 *   Line 237 — getApproxViewCount catch → return 0
 *   Line 274 — getReviewCount catch → return { count: 0, averageRating: 0 }
 *
 * Also covers edge-cases in helper functions and combined notification paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import wixData from './__mocks__/wix-data.js';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import {
  getProductSocialProof,
  getCategorySocialProof,
  getSocialProofConfig,
} from '../src/backend/socialProof.web.js';

beforeEach(() => {
  resetData();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// Error-path coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('error path — getProductSocialProof outer catch (line 108)', () => {
  it('returns { notifications: [], config } when wixData.query throws synchronously', async () => {
    vi.spyOn(wixData, 'query').mockImplementation(() => {
      throw new Error('Fatal DB failure');
    });
    const result = await getProductSocialProof('prod-xyz');
    expect(result.notifications).toEqual([]);
    expect(result.config).toBeDefined();
    expect(result.config.maxPerSession).toBe(5);
  });
});

describe('error path — getStockLevel catch (line 224)', () => {
  it('suppresses low_stock when InventoryLevels query throws', async () => {
    const origQuery = wixData.query.bind(wixData);
    vi.spyOn(wixData, 'query').mockImplementation((collection) => {
      if (collection === 'InventoryLevels') {
        return {
          eq: () => ({ find: () => Promise.reject(new Error('DB down')) }),
        };
      }
      return origQuery(collection);
    });

    const result = await getProductSocialProof('prod-stock-err');
    expect(result.notifications.find(n => n.type === 'low_stock')).toBeUndefined();
    expect(result.config).toBeDefined();
  });
});

describe('error path — getApproxViewCount catch (line 237)', () => {
  it('suppresses popularity when ProductAnalytics query throws', async () => {
    const origQuery = wixData.query.bind(wixData);
    vi.spyOn(wixData, 'query').mockImplementation((collection) => {
      if (collection === 'ProductAnalytics') {
        return {
          eq: () => ({
            ge: () => ({
              count: () => Promise.reject(new Error('DB down')),
            }),
          }),
        };
      }
      return origQuery(collection);
    });

    const result = await getProductSocialProof('prod-analytics-err');
    expect(result.notifications.find(n => n.type === 'popularity')).toBeUndefined();
    expect(result.config).toBeDefined();
  });

  it('does not affect other notifications when ProductAnalytics throws', async () => {
    __seed('InventoryLevels', [{ _id: 'inv-1', productId: 'prod-pa-err', quantity: 3 }]);

    const origQuery = wixData.query.bind(wixData);
    vi.spyOn(wixData, 'query').mockImplementation((collection) => {
      if (collection === 'ProductAnalytics') {
        return {
          eq: () => ({
            ge: () => ({
              count: () => Promise.reject(new Error('DB down')),
            }),
          }),
        };
      }
      return origQuery(collection);
    });

    const result = await getProductSocialProof('prod-pa-err');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeDefined();
    expect(result.notifications.find(n => n.type === 'popularity')).toBeUndefined();
  });
});

describe('error path — getReviewCount catch (line 274)', () => {
  it('suppresses review_count when Reviews query throws', async () => {
    const origQuery = wixData.query.bind(wixData);
    vi.spyOn(wixData, 'query').mockImplementation((collection) => {
      if (collection === 'Reviews') {
        return {
          eq: () => ({
            eq: () => ({
              find: () => Promise.reject(new Error('DB down')),
            }),
          }),
        };
      }
      return origQuery(collection);
    });

    const result = await getProductSocialProof('prod-reviews-err');
    expect(result.notifications.find(n => n.type === 'review_count')).toBeUndefined();
    expect(result.config).toBeDefined();
  });

  it('does not affect other notifications when Reviews throws', async () => {
    __seed('InventoryLevels', [{ _id: 'inv-1', productId: 'prod-rev-err', quantity: 2 }]);

    const origQuery = wixData.query.bind(wixData);
    vi.spyOn(wixData, 'query').mockImplementation((collection) => {
      if (collection === 'Reviews') {
        return {
          eq: () => ({
            eq: () => ({
              find: () => Promise.reject(new Error('DB down')),
            }),
          }),
        };
      }
      return origQuery(collection);
    });

    const result = await getProductSocialProof('prod-rev-err');
    const lowStock = result.notifications.find(n => n.type === 'low_stock');
    expect(lowStock).toBeDefined();
    expect(lowStock.urgency).toBe('high');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// anonymizeName edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('anonymizeName edge cases', () => {
  it('returns Someone in message when firstName is empty string', async () => {
    __seed('Orders', [{
      _id: 'ord-e1',
      _createdDate: new Date(),
      billingInfo: { firstName: '', city: 'Charlotte' },
      lineItems: [{ productId: 'prod-e1', name: 'Classic Futon' }],
    }]);

    const result = await getProductSocialProof('prod-e1', 'Classic Futon');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('Someone');
  });

  it('capitalizes a lowercase first name', async () => {
    __seed('Orders', [{
      _id: 'ord-e2',
      _createdDate: new Date(),
      billingInfo: { firstName: 'mary', city: 'Durham' },
      lineItems: [{ productId: 'prod-e2', name: 'Futon' }],
    }]);

    const result = await getProductSocialProof('prod-e2');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('Mary');
    expect(purchase.message).not.toContain('mary');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// anonymizeCity edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('anonymizeCity edge cases', () => {
  it('omits "from <city>" when city is empty string', async () => {
    __seed('Orders', [{
      _id: 'ord-c1',
      _createdDate: new Date(),
      billingInfo: { firstName: 'Jane', city: '' },
      lineItems: [{ productId: 'prod-c1', name: 'Frame' }],
    }]);

    const result = await getProductSocialProof('prod-c1');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).not.toContain('from');
    expect(purchase.message).toContain('Jane');
  });

  it('title-cases a multi-word city name', async () => {
    __seed('Orders', [{
      _id: 'ord-c2',
      _createdDate: new Date(),
      billingInfo: { firstName: 'Tom', city: 'winston-salem' },
      lineItems: [{ productId: 'prod-c2', name: 'Futon' }],
    }]);

    const result = await getProductSocialProof('prod-c2');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('Winston');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// formatPurchaseMessage edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('formatPurchaseMessage edge cases', () => {
  it('uses "this item" when both productName arg and lineItem name are absent', async () => {
    __seed('Orders', [{
      _id: 'ord-f1',
      _createdDate: new Date(),
      billingInfo: { firstName: 'Kim', city: 'Raleigh' },
      lineItems: [{ productId: 'prod-f1' }],
    }]);

    const result = await getProductSocialProof('prod-f1');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('this item');
  });

  it('prefers the productName argument over the lineItem name', async () => {
    __seed('Orders', [{
      _id: 'ord-f2',
      _createdDate: new Date(),
      billingInfo: { firstName: 'Alex', city: 'Greensboro' },
      lineItems: [{ productId: 'prod-f2', name: 'LineItem Name' }],
    }]);

    const result = await getProductSocialProof('prod-f2', 'Arg Product Name');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('Arg Product Name');
  });

  it('omits city clause when city is missing from billing and shipping info', async () => {
    __seed('Orders', [{
      _id: 'ord-f3',
      _createdDate: new Date(),
      billingInfo: { firstName: 'Robin' },
      lineItems: [{ productId: 'prod-f3', name: 'Sofa Frame' }],
    }]);

    const result = await getProductSocialProof('prod-f3', 'Sofa Frame');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toBe('Robin recently purchased Sofa Frame');
  });

  it('falls back to shippingInfo city when billingInfo city is missing', async () => {
    __seed('Orders', [{
      _id: 'ord-f4',
      _createdDate: new Date(),
      billingInfo: { firstName: 'Sam' },
      shippingInfo: { city: 'Wilmington' },
      lineItems: [{ productId: 'prod-f4', name: 'Mattress' }],
    }]);

    const result = await getProductSocialProof('prod-f4');
    const purchase = result.notifications.find(n => n.type === 'recent_purchase');
    expect(purchase).toBeDefined();
    expect(purchase.message).toContain('Wilmington');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getStockLevel — null when no inventory items found
// ─────────────────────────────────────────────────────────────────────────────

describe('getStockLevel — null when no inventory items', () => {
  it('does not emit low_stock when InventoryLevels has no matching product', async () => {
    __seed('InventoryLevels', [{ _id: 'inv-other', productId: 'prod-other', quantity: 2 }]);

    const result = await getProductSocialProof('prod-no-inv');
    expect(result.notifications.find(n => n.type === 'low_stock')).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Review count — average calculation edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('getReviewCount — average rating edge cases', () => {
  it('calculates correct average when all ratings are identical', async () => {
    const reviews = Array.from({ length: 6 }, (_, i) => ({
      _id: `rev-same-${i}`,
      productId: 'prod-uniform',
      status: 'approved',
      rating: 4,
    }));
    __seed('Reviews', reviews);

    const result = await getProductSocialProof('prod-uniform');
    const reviewNotif = result.notifications.find(n => n.type === 'review_count');
    expect(reviewNotif).toBeDefined();
    expect(reviewNotif.message).toContain('6');
    expect(reviewNotif.message).toContain('4/5');
  });

  it('rounds average to one decimal place', async () => {
    const reviews = [
      ...Array.from({ length: 3 }, (_, i) => ({ _id: `rev-hi-${i}`, productId: 'prod-avg', status: 'approved', rating: 5 })),
      ...Array.from({ length: 3 }, (_, i) => ({ _id: `rev-lo-${i}`, productId: 'prod-avg', status: 'approved', rating: 4 })),
    ];
    __seed('Reviews', reviews);

    const result = await getProductSocialProof('prod-avg');
    const reviewNotif = result.notifications.find(n => n.type === 'review_count');
    expect(reviewNotif).toBeDefined();
    expect(reviewNotif.message).toContain('4.5/5');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Combined — all four notification types at once
// ─────────────────────────────────────────────────────────────────────────────

describe('combined notifications — all four types', () => {
  it('returns all four notification types when data is present', async () => {
    const recentDate = new Date();

    __seed('Orders', [{
      _id: 'ord-combo',
      _createdDate: recentDate,
      billingInfo: { firstName: 'Maria', city: 'Chapel Hill' },
      lineItems: [{ productId: 'prod-combo', name: 'Deluxe Futon' }],
    }]);

    __seed('InventoryLevels', [
      { _id: 'inv-combo', productId: 'prod-combo', quantity: 3 },
    ]);

    const analytics = Array.from({ length: 7 }, (_, i) => ({
      _id: `pa-combo-${i}`,
      productId: 'prod-combo',
      timestamp: recentDate,
    }));
    __seed('ProductAnalytics', analytics);

    const reviews = Array.from({ length: 6 }, (_, i) => ({
      _id: `rev-combo-${i}`,
      productId: 'prod-combo',
      status: 'approved',
      rating: 5,
    }));
    __seed('Reviews', reviews);

    const result = await getProductSocialProof('prod-combo', 'Deluxe Futon');
    const types = result.notifications.map(n => n.type);
    expect(types).toContain('recent_purchase');
    expect(types).toContain('low_stock');
    expect(types).toContain('popularity');
    expect(types).toContain('review_count');

    // Priority ordering
    const priorities = result.notifications.map(n => n.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getCategorySocialProof error path
// ─────────────────────────────────────────────────────────────────────────────

describe('getCategorySocialProof error path', () => {
  it('returns defaults when wixData.query throws', async () => {
    vi.spyOn(wixData, 'query').mockImplementation(() => {
      throw new Error('DB down');
    });

    const result = await getCategorySocialProof('futons');
    expect(result.recentSalesCount).toBe(0);
    expect(result.lowStockProducts).toEqual([]);
    expect(result.config).toBeDefined();
  });

  it('uses default productName "This item" when productName is missing', async () => {
    __seed('InventoryLevels', [
      { _id: 'inv-noname', productId: 'prod-noname', quantity: 3 },
    ]);

    const result = await getCategorySocialProof('futons');
    const item = result.lowStockProducts.find(p => p.productId === 'prod-noname');
    expect(item).toBeDefined();
    expect(item.productName).toBe('This item');
  });
});
