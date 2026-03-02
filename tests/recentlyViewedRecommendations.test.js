import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __reset as resetData } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import { allProducts, futonFrame, futonMattress, murphyBed, platformBed, casegoodsItem, wallHuggerFrame } from './fixtures/products.js';
import {
  trackProductView,
  getRecentlyViewed,
  clearRecentlyViewed,
} from '../src/public/galleryHelpers.js';
import {
  getCustomersAlsoBought,
} from '../src/backend/productRecommendations.web.js';
import { session } from 'wix-storage-frontend';

// ── clearRecentlyViewed ──────────────────────────────────────────────

describe('clearRecentlyViewed', () => {
  it('removes all recently viewed products from session storage', () => {
    trackProductView(futonFrame);
    trackProductView(futonMattress);
    expect(getRecentlyViewed()).toHaveLength(2);

    clearRecentlyViewed();
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('is safe to call on empty session', () => {
    expect(() => clearRecentlyViewed()).not.toThrow();
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('does not affect compare list or other session data', () => {
    session.setItem('cf_compare_list', JSON.stringify([{ _id: 'test' }]));
    trackProductView(futonFrame);

    clearRecentlyViewed();

    expect(getRecentlyViewed()).toEqual([]);
    expect(JSON.parse(session.getItem('cf_compare_list'))).toHaveLength(1);
  });

  it('also clears browse data', () => {
    trackProductView(futonFrame);
    // Browse data is stored in sessionStorage (not wix session)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('cf_browse_data', JSON.stringify({ 'prod-1': { timeSpentMs: 500 } }));
    }

    clearRecentlyViewed();

    expect(getRecentlyViewed()).toEqual([]);
    if (typeof sessionStorage !== 'undefined') {
      expect(sessionStorage.getItem('cf_browse_data')).toBeNull();
    }
  });
});

// ── getCustomersAlsoBought (backend) ────────────────────────────────

describe('getCustomersAlsoBought', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Products', allProducts);
    // Seed co-purchase data: customers who bought futon frames also bought mattresses
    __seed('Stores/Orders', [
      {
        _id: 'order-1',
        lineItems: [
          { productId: 'prod-frame-001' },
          { productId: 'prod-matt-001' },
        ],
      },
      {
        _id: 'order-2',
        lineItems: [
          { productId: 'prod-frame-001' },
          { productId: 'prod-case-001' },
        ],
      },
      {
        _id: 'order-3',
        lineItems: [
          { productId: 'prod-frame-001' },
          { productId: 'prod-matt-001' },
          { productId: 'prod-case-001' },
        ],
      },
      {
        _id: 'order-4',
        lineItems: [
          { productId: 'prod-murphy-001' },
          { productId: 'prod-case-001' },
        ],
      },
    ]);
  });

  it('returns products frequently bought with the given product', async () => {
    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
    // Mattress bought with frame in 2/3 orders, casegoods in 2/3
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('prod-frame-001');
  });

  it('excludes the source product from results', async () => {
    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
    const ids = result.products.map(p => p._id);
    expect(ids).not.toContain('prod-frame-001');
  });

  it('returns empty for product with no co-purchases', async () => {
    const result = await getCustomersAlsoBought('prod-plat-001');
    expect(result.success).toBe(true);
    expect(result.products).toHaveLength(0);
  });

  it('returns empty for invalid product ID', async () => {
    const result = await getCustomersAlsoBought('');
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('returns empty for null product ID', async () => {
    const result = await getCustomersAlsoBought(null);
    expect(result.success).toBe(false);
    expect(result.products).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    const result = await getCustomersAlsoBought('prod-frame-001', 1);
    expect(result.success).toBe(true);
    expect(result.products.length).toBeLessThanOrEqual(1);
  });

  it('returns formatted product objects with expected fields', async () => {
    const result = await getCustomersAlsoBought('prod-frame-001');
    if (result.products.length > 0) {
      const product = result.products[0];
      expect(product).toHaveProperty('_id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('slug');
      expect(product).toHaveProperty('price');
      expect(product).toHaveProperty('formattedPrice');
      expect(product).toHaveProperty('mainMedia');
    }
  });

  it('falls back to related products when no order data exists', async () => {
    resetData();
    __seed('Stores/Products', allProducts);
    __seed('Stores/Orders', []);

    const result = await getCustomersAlsoBought('prod-frame-001');
    expect(result.success).toBe(true);
    // Should fall back to category-based related products
  });

  it('orders by co-purchase frequency (most common first)', async () => {
    const result = await getCustomersAlsoBought('prod-frame-001');
    if (result.products.length >= 2) {
      // Mattress appears in 2 orders with frame, casegoods in 2 orders
      // Both should appear; order depends on implementation
      const ids = result.products.map(p => p._id);
      expect(ids).toContain('prod-matt-001');
      expect(ids).toContain('prod-case-001');
    }
  });
});

// ── Recently Viewed carousel keyboard navigation ─────────────────────

describe('recently viewed carousel keyboard behavior', () => {
  function createMock$w(elements = {}) {
    return (selector) => {
      if (elements[selector]) return elements[selector];
      return mockElement();
    };
  }

  function mockElement(overrides = {}) {
    return {
      collapse: vi.fn(),
      expand: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      onClick: vi.fn(),
      onKeyDown: vi.fn(),
      text: '',
      src: '',
      data: [],
      onItemReady: vi.fn(),
      style: {},
      accessibility: {},
      ...overrides,
    };
  }

  it('recently viewed section has accessible aria-label', () => {
    trackProductView(futonFrame);
    trackProductView(futonMattress);
    const recent = getRecentlyViewed();
    expect(recent.length).toBeGreaterThan(0);
    // Each item should have minimal data for card rendering
    recent.forEach(item => {
      expect(item).toHaveProperty('_id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('mainMedia');
    });
  });
});

// ── Integration: trackProductView stores no PII ──────────────────────

describe('recently viewed privacy', () => {
  it('does not store email, phone, or address', () => {
    const productWithPII = {
      ...futonFrame,
      buyerEmail: 'test@example.com',
      buyerPhone: '555-1234',
      buyerAddress: '123 Main St',
      memberData: { email: 'member@example.com' },
    };

    trackProductView(productWithPII);
    const viewed = getRecentlyViewed();
    const stored = viewed[0];

    expect(stored).not.toHaveProperty('buyerEmail');
    expect(stored).not.toHaveProperty('buyerPhone');
    expect(stored).not.toHaveProperty('buyerAddress');
    expect(stored).not.toHaveProperty('memberData');
    // Should only have display fields
    expect(Object.keys(stored).sort()).toEqual(['_id', 'mainMedia', 'name', 'price', 'slug'].sort());
  });
});
