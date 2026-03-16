import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

let _collections = {};
let _insertCbs = [];
let _updateCbs = [];

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ge: (field, val) => { filters[field] = { type: 'ge', value: val }; return chain; },
    hasSome: (field, vals) => { filters[field] = { type: 'hasSome', value: vals }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
        if (f.type === 'ge') items = items.filter(i => i[field] >= f.value);
        if (f.type === 'hasSome') items = items.filter(i => f.value.includes(i[field]));
      }
      if (filters._limit) items = items.slice(0, filters._limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
    get: async (collection, id) => (_collections[collection] || []).find(i => i._id === id) || null,
    insert: async (collection, item) => {
      const record = { ...item, _id: item._id || `ins-${Date.now()}` };
      _collections[collection] = _collections[collection] || [];
      _collections[collection].push(record);
      for (const cb of _insertCbs) cb(collection, record);
      return record;
    },
    update: async (collection, item) => {
      _collections[collection] = (_collections[collection] || []).map(i =>
        i._id === item._id ? { ...item } : i
      );
      for (const cb of _updateCbs) cb(collection, item);
      return item;
    },
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  colors: { success: '#00C853', mountainBlue: '#1565C0', espressoLight: '#8D6E63', sunsetCoral: '#FF6F61' },
}));

beforeEach(() => {
  _collections = {};
  _insertCbs = [];
  _updateCbs = [];
});

// ── Import under test ───────────────────────────────────────────────
const mod = await import('../src/backend/analyticsHelpers.web.js');
const {
  trackProductView,
  trackAddToCart,
  trackSocialShare,
  getMostViewedProducts,
  getTrendingProducts,
  buildViewContentEvent,
  buildAddToCartEvent,
  buildCheckoutEvent,
  buildPurchaseEvent,
  buildWishlistEvent,
  buildViewItemListEvent,
  buildSearchEvent,
  trackPurchase,
  buildViewCartEvent,
} = mod;

// ═════════════════════════════════════════════════════════════════════
// trackProductView
// ═════════════════════════════════════════════════════════════════════
describe('trackProductView', () => {
  it('creates new analytics record on first view', async () => {
    __seed('ProductAnalytics', []);
    await trackProductView('prod-1', 'Test Product', 'futon-frames');
    expect(_collections.ProductAnalytics).toHaveLength(1);
    expect(_collections.ProductAnalytics[0].viewCount).toBe(1);
    expect(_collections.ProductAnalytics[0].addToCartCount).toBe(0);
  });

  it('increments view count on subsequent views', async () => {
    __seed('ProductAnalytics', [
      { _id: 'a1', productId: 'prod-1', viewCount: 5, lastViewed: new Date('2026-01-01') },
    ]);
    await trackProductView('prod-1', 'Test', 'futons');
    const updated = _collections.ProductAnalytics.find(a => a._id === 'a1');
    expect(updated.viewCount).toBe(6);
    expect(updated.lastViewed.getTime()).toBeGreaterThan(new Date('2026-01-01').getTime());
  });

  it('handles missing viewCount (defaults to 0 + 1)', async () => {
    __seed('ProductAnalytics', [{ _id: 'a1', productId: 'prod-1' }]);
    await trackProductView('prod-1', 'Test', 'futons');
    expect(_collections.ProductAnalytics.find(a => a._id === 'a1').viewCount).toBe(1);
  });

  it('sanitizes HTML from inputs', async () => {
    __seed('ProductAnalytics', []);
    await trackProductView('<script>x</script>', '<b>Name</b>', '<i>cat</i>');
    const record = _collections.ProductAnalytics[0];
    expect(record.productId).not.toContain('<script>');
    expect(record.productName).not.toContain('<b>');
  });
});

// ═════════════════════════════════════════════════════════════════════
// trackAddToCart
// ═════════════════════════════════════════════════════════════════════
describe('trackAddToCart', () => {
  it('increments addToCartCount', async () => {
    __seed('ProductAnalytics', [{ _id: 'a1', productId: 'prod-1', addToCartCount: 3 }]);
    await trackAddToCart('prod-1');
    expect(_collections.ProductAnalytics.find(a => a._id === 'a1').addToCartCount).toBe(4);
  });

  it('handles missing addToCartCount', async () => {
    __seed('ProductAnalytics', [{ _id: 'a1', productId: 'prod-1' }]);
    await trackAddToCart('prod-1');
    expect(_collections.ProductAnalytics.find(a => a._id === 'a1').addToCartCount).toBe(1);
  });

  it('no-ops silently for unknown product', async () => {
    __seed('ProductAnalytics', []);
    await trackAddToCart('nonexistent');
    // No error, no insert
  });
});

// ═════════════════════════════════════════════════════════════════════
// trackSocialShare
// ═════════════════════════════════════════════════════════════════════
describe('trackSocialShare', () => {
  it('increments shareCount and sets platform', async () => {
    __seed('ProductAnalytics', [{ _id: 'a1', productId: 'prod-1', shareCount: 2 }]);
    await trackSocialShare('prod-1', 'facebook');
    const updated = _collections.ProductAnalytics.find(a => a._id === 'a1');
    expect(updated.shareCount).toBe(3);
    expect(updated.lastSharePlatform).toBe('facebook');
  });

  it('handles missing shareCount', async () => {
    __seed('ProductAnalytics', [{ _id: 'a1', productId: 'prod-1' }]);
    await trackSocialShare('prod-1', 'pinterest');
    expect(_collections.ProductAnalytics.find(a => a._id === 'a1').shareCount).toBe(1);
  });

  it('handles null platform', async () => {
    __seed('ProductAnalytics', [{ _id: 'a1', productId: 'prod-1', shareCount: 0 }]);
    await trackSocialShare('prod-1', null);
    expect(_collections.ProductAnalytics.find(a => a._id === 'a1').lastSharePlatform).toBe('');
  });

  it('no-ops for unknown product', async () => {
    __seed('ProductAnalytics', []);
    await trackSocialShare('nonexistent', 'twitter');
  });
});

// ═════════════════════════════════════════════════════════════════════
// trackPurchase
// ═════════════════════════════════════════════════════════════════════
describe('trackPurchase', () => {
  it('increments purchaseCount', async () => {
    __seed('ProductAnalytics', [{ _id: 'a1', productId: 'prod-1', purchaseCount: 10 }]);
    await trackPurchase('prod-1');
    expect(_collections.ProductAnalytics.find(a => a._id === 'a1').purchaseCount).toBe(11);
  });

  it('handles missing purchaseCount', async () => {
    __seed('ProductAnalytics', [{ _id: 'a1', productId: 'prod-1' }]);
    await trackPurchase('prod-1');
    expect(_collections.ProductAnalytics.find(a => a._id === 'a1').purchaseCount).toBe(1);
  });

  it('no-ops for unknown product', async () => {
    __seed('ProductAnalytics', []);
    await trackPurchase('nonexistent');
  });
});

// ═════════════════════════════════════════════════════════════════════
// getMostViewedProducts
// ═════════════════════════════════════════════════════════════════════
describe('getMostViewedProducts', () => {
  it('returns products sorted by view count', async () => {
    __seed('ProductAnalytics', [
      { productId: 'p1', viewCount: 100 },
      { productId: 'p2', viewCount: 50 },
    ]);
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Prod 1', slug: 's1', price: 99, formattedPrice: '$99', mainMedia: 'img1' },
      { _id: 'p2', name: 'Prod 2', slug: 's2', price: 49, formattedPrice: '$49', mainMedia: 'img2' },
    ]);
    const result = await getMostViewedProducts(10);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Prod 1');
    expect(result[0].viewCount).toBe(100);
  });

  it('returns empty array when no analytics', async () => {
    __seed('ProductAnalytics', []);
    const result = await getMostViewedProducts();
    expect(result).toEqual([]);
  });

  it('skips analytics entries with no matching product', async () => {
    __seed('ProductAnalytics', [{ productId: 'deleted-product', viewCount: 100 }]);
    __seed('Stores/Products', []);
    const result = await getMostViewedProducts();
    expect(result).toEqual([]);
  });

  it('defaults limit to 8', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ productId: `p${i}`, viewCount: 10 - i }));
    __seed('ProductAnalytics', items);
    __seed('Stores/Products', items.map(a => ({ _id: a.productId, name: `P${a.productId}`, slug: '', price: 0, formattedPrice: '', mainMedia: '' })));
    const result = await getMostViewedProducts();
    expect(result).toHaveLength(8);
  });
});

// ═════════════════════════════════════════════════════════════════════
// getTrendingProducts
// ═════════════════════════════════════════════════════════════════════
describe('getTrendingProducts', () => {
  it('returns recently viewed products', async () => {
    const recent = new Date();
    __seed('ProductAnalytics', [
      { productId: 'p1', viewCount: 50, lastViewed: recent },
    ]);
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Trending', slug: 'trending', formattedPrice: '$99', mainMedia: 'img' },
    ]);
    const result = await getTrendingProducts();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Trending');
  });

  it('returns empty when no recent views', async () => {
    __seed('ProductAnalytics', []);
    const result = await getTrendingProducts();
    expect(result).toEqual([]);
  });

  it('defaults limit to 6', async () => {
    const recent = new Date();
    const items = Array.from({ length: 10 }, (_, i) => ({ productId: `p${i}`, viewCount: 10 - i, lastViewed: recent }));
    __seed('ProductAnalytics', items);
    __seed('Stores/Products', items.map(a => ({ _id: a.productId, name: a.productId, slug: '', formattedPrice: '', mainMedia: '' })));
    const result = await getTrendingProducts();
    expect(result).toHaveLength(6);
  });

  it('skips deleted products', async () => {
    const recent = new Date();
    __seed('ProductAnalytics', [{ productId: 'gone', viewCount: 100, lastViewed: recent }]);
    __seed('Stores/Products', []);
    const result = await getTrendingProducts();
    expect(result).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildViewContentEvent
// ═════════════════════════════════════════════════════════════════════
describe('buildViewContentEvent', () => {
  it('builds event from product', async () => {
    const result = await buildViewContentEvent({
      _id: 'p1', name: 'Futon Frame', price: 299, collections: ['futon-frames'],
    });
    expect(result.content_name).toBe('Futon Frame');
    expect(result.content_ids).toEqual(['p1']);
    expect(result.value).toBe(299);
    expect(result.currency).toBe('USD');
    expect(result.content_category).toBe('futon-frames');
  });

  it('returns empty object for null product', async () => {
    expect(await buildViewContentEvent(null)).toEqual({});
  });

  it('handles missing fields with defaults', async () => {
    const result = await buildViewContentEvent({ _id: 'p1' });
    expect(result.content_name).toBe('');
    expect(result.value).toBe(0);
    expect(result.content_category).toBe('');
  });

  it('handles empty collections array', async () => {
    const result = await buildViewContentEvent({ _id: 'p1', collections: [] });
    expect(result.content_category).toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildAddToCartEvent
// ═════════════════════════════════════════════════════════════════════
describe('buildAddToCartEvent', () => {
  it('builds event with quantity', async () => {
    const result = await buildAddToCartEvent({ _id: 'p1', name: 'Futon', price: 299 }, 2);
    expect(result.value).toBe(598);
    expect(result.num_items).toBe(2);
  });

  it('defaults quantity to 1', async () => {
    const result = await buildAddToCartEvent({ _id: 'p1', name: 'Futon', price: 100 });
    expect(result.value).toBe(100);
    expect(result.num_items).toBe(1);
  });

  it('returns empty object for null product', async () => {
    expect(await buildAddToCartEvent(null)).toEqual({});
  });

  it('handles zero price', async () => {
    const result = await buildAddToCartEvent({ _id: 'p1', name: 'Free', price: 0 }, 3);
    expect(result.value).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildCheckoutEvent
// ═════════════════════════════════════════════════════════════════════
describe('buildCheckoutEvent', () => {
  it('builds event from cart items', async () => {
    const result = await buildCheckoutEvent(
      [{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 1 }],
      350,
    );
    expect(result.content_ids).toEqual(['p1', 'p2']);
    expect(result.value).toBe(350);
    expect(result.num_items).toBe(3);
  });

  it('handles null cartItems', async () => {
    const result = await buildCheckoutEvent(null, 0);
    expect(result.content_ids).toEqual([]);
    expect(result.num_items).toBe(0);
  });

  it('defaults quantity to 1 per item', async () => {
    const result = await buildCheckoutEvent([{ productId: 'p1' }], 100);
    expect(result.num_items).toBe(1);
  });

  it('uses _id fallback when productId missing', async () => {
    const result = await buildCheckoutEvent([{ _id: 'alt-id' }], 50);
    expect(result.content_ids).toEqual(['alt-id']);
  });

  it('handles zero cart total', async () => {
    const result = await buildCheckoutEvent([], 0);
    expect(result.value).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildPurchaseEvent
// ═════════════════════════════════════════════════════════════════════
describe('buildPurchaseEvent', () => {
  it('builds event from order', async () => {
    const result = await buildPurchaseEvent({
      _id: 'order-1',
      lineItems: [
        { catalogItemId: 'p1', quantity: 1 },
        { catalogItemId: 'p2', quantity: 2 },
      ],
      totals: { total: 500 },
    });
    expect(result.content_ids).toEqual(['p1', 'p2']);
    expect(result.value).toBe(500);
    expect(result.num_items).toBe(3);
    expect(result.order_id).toBe('order-1');
  });

  it('returns empty object for null order', async () => {
    expect(await buildPurchaseEvent(null)).toEqual({});
  });

  it('uses sku fallback when catalogItemId missing', async () => {
    const result = await buildPurchaseEvent({
      lineItems: [{ sku: 'SKU-1' }], totals: { total: 100 },
    });
    expect(result.content_ids).toEqual(['SKU-1']);
  });

  it('handles missing totals', async () => {
    const result = await buildPurchaseEvent({ lineItems: [] });
    expect(result.value).toBe(0);
  });

  it('handles missing lineItems', async () => {
    const result = await buildPurchaseEvent({ totals: { total: 100 } });
    expect(result.content_ids).toEqual([]);
    expect(result.num_items).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildWishlistEvent
// ═════════════════════════════════════════════════════════════════════
describe('buildWishlistEvent', () => {
  it('builds event from product', async () => {
    const result = await buildWishlistEvent({ _id: 'p1', name: 'Futon', price: 299 });
    expect(result.content_name).toBe('Futon');
    expect(result.value).toBe(299);
  });

  it('returns empty object for null', async () => {
    expect(await buildWishlistEvent(null)).toEqual({});
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildViewItemListEvent
// ═════════════════════════════════════════════════════════════════════
describe('buildViewItemListEvent', () => {
  it('builds list event with indexed items', async () => {
    const result = await buildViewItemListEvent(
      [{ _id: 'p1', name: 'A', price: 99, collections: ['futons'] }, { _id: 'p2', name: 'B', price: 49 }],
      'futon-frames',
    );
    expect(result.item_list_name).toBe('futon-frames');
    expect(result.items).toHaveLength(2);
    expect(result.items[0].index).toBe(0);
    expect(result.items[1].index).toBe(1);
    expect(result.items[0].item_category).toBe('futons');
  });

  it('handles null items', async () => {
    const result = await buildViewItemListEvent(null, 'test');
    expect(result.items).toEqual([]);
  });

  it('handles missing listName', async () => {
    const result = await buildViewItemListEvent([], undefined);
    expect(result.item_list_name).toBe('');
  });

  it('handles items with no collections', async () => {
    const result = await buildViewItemListEvent([{ _id: 'p1', name: 'X', price: 10 }], 'list');
    expect(result.items[0].item_category).toBe('');
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildSearchEvent
// ═════════════════════════════════════════════════════════════════════
describe('buildSearchEvent', () => {
  it('builds search event', async () => {
    const result = await buildSearchEvent('futon frames', 12);
    expect(result.search_term).toBe('futon frames');
    expect(result.results_count).toBe(12);
  });

  it('handles null query', async () => {
    const result = await buildSearchEvent(null, 0);
    expect(result.search_term).toBe('');
  });

  it('handles zero results', async () => {
    const result = await buildSearchEvent('asdf', 0);
    expect(result.results_count).toBe(0);
  });

  it('sanitizes query with HTML', async () => {
    const result = await buildSearchEvent('<script>alert(1)</script>futon', 5);
    expect(result.search_term).not.toContain('<script>');
    expect(result.search_term).toContain('futon');
  });
});

// ═════════════════════════════════════════════════════════════════════
// buildViewCartEvent
// ═════════════════════════════════════════════════════════════════════
describe('buildViewCartEvent', () => {
  it('builds cart view event', async () => {
    const result = await buildViewCartEvent(
      [{ _id: 'p1', name: 'Futon', price: 299, quantity: 2 }],
      598,
    );
    expect(result.currency).toBe('USD');
    expect(result.value).toBe(598);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].item_id).toBe('p1');
    expect(result.items[0].quantity).toBe(2);
  });

  it('handles null cartItems', async () => {
    const result = await buildViewCartEvent(null, 0);
    expect(result.items).toEqual([]);
  });

  it('uses productId fallback for item_id', async () => {
    const result = await buildViewCartEvent([{ productId: 'alt' }], 0);
    expect(result.items[0].item_id).toBe('alt');
  });

  it('uses productName fallback for item_name', async () => {
    const result = await buildViewCartEvent([{ productName: 'Alt Name' }], 0);
    expect(result.items[0].item_name).toBe('Alt Name');
  });

  it('defaults quantity to 1', async () => {
    const result = await buildViewCartEvent([{ _id: 'p1' }], 0);
    expect(result.items[0].quantity).toBe(1);
  });

  it('handles zero cart total', async () => {
    const result = await buildViewCartEvent([], 0);
    expect(result.value).toBe(0);
  });
});
