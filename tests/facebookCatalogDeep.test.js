import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('backend/utils/mediaHelpers', () => ({
  getImageUrl: (src) => src ? `https://cdn.example.com/${src}` : null,
}));

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map(i => ({ ...i }));
}

function buildQueryChain(collection) {
  let filters = {};
  const chain = {
    eq: (field, val) => { filters[field] = { type: 'eq', value: val }; return chain; },
    ascending: () => chain,
    descending: () => chain,
    limit: (n) => { filters._limit = n; return chain; },
    skip: (n) => { filters._skip = n; return chain; },
    find: async () => {
      let items = [...(_collections[collection] || [])];
      for (const [field, f] of Object.entries(filters)) {
        if (field === '_limit' || field === '_skip') continue;
        if (f.type === 'eq') items = items.filter(i => i[field] === f.value);
      }
      const skip = filters._skip || 0;
      const limit = filters._limit || items.length;
      items = items.slice(skip, skip + limit);
      return { items, totalCount: items.length };
    },
  };
  return chain;
}

vi.mock('wix-data', () => ({
  default: {
    query: (collection) => buildQueryChain(collection),
  },
}));

let mod;
beforeEach(async () => {
  _collections = {};
  vi.resetModules();
  mod = await import('../src/backend/facebookCatalog.web.js');
});

// ── buildCapiEvent ────────────────────────────────────────────────

describe('buildCapiEvent', () => {
  it('returns null for invalid event name', () => {
    expect(mod.buildCapiEvent('InvalidEvent', {})).toBeNull();
    expect(mod.buildCapiEvent('', {})).toBeNull();
    expect(mod.buildCapiEvent(null, {})).toBeNull();
  });

  it('builds ViewContent event', () => {
    const r = mod.buildCapiEvent('ViewContent', {
      product: { _id: 'p1', name: 'Sofa', price: 500, collections: ['futons'] },
    });
    expect(r.event_name).toBe('ViewContent');
    expect(r.custom_data.content_ids).toEqual(['p1']);
    expect(r.custom_data.value).toBe(500);
    expect(r.custom_data.currency).toBe('USD');
    expect(r.custom_data.content_type).toBe('product');
  });

  it('ViewContent returns null without product', () => {
    expect(mod.buildCapiEvent('ViewContent', {})).toBeNull();
  });

  it('ViewContent uses product_group for multi-variant', () => {
    const r = mod.buildCapiEvent('ViewContent', {
      product: { _id: 'p1', name: 'Sofa', price: 500, variants: [{}, {}] },
    });
    expect(r.custom_data.content_type).toBe('product_group');
  });

  it('ViewContent prefers discountedPrice', () => {
    const r = mod.buildCapiEvent('ViewContent', {
      product: { _id: 'p1', name: 'Sofa', price: 500, discountedPrice: 400 },
    });
    expect(r.custom_data.value).toBe(400);
  });

  it('builds AddToCart event', () => {
    const r = mod.buildCapiEvent('AddToCart', {
      product: { _id: 'p1', name: 'Chair', price: 200 },
      quantity: 3,
    });
    expect(r.custom_data.num_items).toBe(3);
    expect(r.custom_data.value).toBe(200);
  });

  it('AddToCart returns null without product', () => {
    expect(mod.buildCapiEvent('AddToCart', {})).toBeNull();
  });

  it('builds InitiateCheckout event', () => {
    const r = mod.buildCapiEvent('InitiateCheckout', {
      cartItems: [{ productId: 'p1' }, { productId: 'p2' }],
      cartTotal: 700,
    });
    expect(r.custom_data.content_ids).toEqual(['p1', 'p2']);
    expect(r.custom_data.value).toBe(700);
    expect(r.custom_data.num_items).toBe(2);
  });

  it('InitiateCheckout handles no cartItems', () => {
    const r = mod.buildCapiEvent('InitiateCheckout', { cartTotal: 0 });
    expect(r.custom_data.content_ids).toEqual([]);
    expect(r.custom_data.num_items).toBe(0);
  });

  it('builds Purchase event', () => {
    const r = mod.buildCapiEvent('Purchase', {
      order: {
        _id: 'ord1', totals: { total: 1200 },
        lineItems: [{ productId: 'p1' }, { productId: 'p2' }],
        buyerInfo: { email: 'Jane@test.com' },
        billingInfo: { firstName: 'Jane', lastName: 'Doe', phone: '555-1234' },
      },
    });
    expect(r.custom_data.value).toBe(1200);
    expect(r.custom_data.order_id).toBe('ord1');
    expect(r.custom_data.num_items).toBe(2);
    expect(r.user_data.em).toBe('jane@test.com');
    expect(r.user_data.ph).toBe('5551234');
  });

  it('Purchase returns null without order', () => {
    expect(mod.buildCapiEvent('Purchase', {})).toBeNull();
  });

  it('builds Search event', () => {
    const r = mod.buildCapiEvent('Search', { query: 'futon frame' });
    expect(r.custom_data.search_string).toBe('futon frame');
  });

  it('builds CompleteRegistration event', () => {
    const r = mod.buildCapiEvent('CompleteRegistration', { contentName: 'Newsletter' });
    expect(r.custom_data.content_name).toBe('Newsletter');
    expect(r.custom_data.status).toBe(true);
  });

  it('builds AddToWishlist event', () => {
    const r = mod.buildCapiEvent('AddToWishlist', {
      product: { _id: 'p1', name: 'Ottoman', price: 150 },
    });
    expect(r.custom_data.content_ids).toEqual(['p1']);
    expect(r.custom_data.value).toBe(150);
  });

  it('AddToWishlist returns null without product', () => {
    expect(mod.buildCapiEvent('AddToWishlist', {})).toBeNull();
  });

  it('builds Lead event', () => {
    const r = mod.buildCapiEvent('Lead', {
      contentName: 'Contact Form', contentCategory: 'Sales', value: 0,
    });
    expect(r.custom_data.content_name).toBe('Contact Form');
    expect(r.custom_data.content_category).toBe('Sales');
  });

  it('normalizes user data', () => {
    const r = mod.buildCapiEvent('Search', {
      query: 'test',
      userInfo: {
        email: ' Jane@TEST.com ', phone: '(555) 123-4567',
        firstName: 'JANE', lastName: 'DOE',
        city: 'Raleigh', state: 'NC', zip: '27601',
      },
    });
    expect(r.user_data.em).toBe('jane@test.com');
    expect(r.user_data.ph).toBe('5551234567');
    expect(r.user_data.fn).toBe('jane');
    expect(r.user_data.ln).toBe('doe');
    expect(r.user_data.ct).toBe('raleigh');
    expect(r.user_data.st).toBe('nc');
    expect(r.user_data.zp).toBe('27601');
  });

  it('strips HTML from content_name', () => {
    const r = mod.buildCapiEvent('ViewContent', {
      product: { _id: 'p1', name: '<b>Bold Sofa</b>', price: 100 },
    });
    expect(r.custom_data.content_name).toBe('Bold Sofa');
  });

  it('sets action_source to website', () => {
    const r = mod.buildCapiEvent('Search', { query: 'test' });
    expect(r.action_source).toBe('website');
  });
});

// ── buildProductSetParams ─────────────────────────────────────────

describe('buildProductSetParams', () => {
  it('returns null for null product', () => {
    expect(mod.buildProductSetParams(null)).toBeNull();
  });

  it('returns null for product without _id', () => {
    expect(mod.buildProductSetParams({ name: 'Sofa' })).toBeNull();
  });

  it('returns product type for single variant', () => {
    const r = mod.buildProductSetParams({ _id: 'p1', variants: [{}] }, 'ViewContent');
    expect(r.content_type).toBe('product');
    expect(r.content_ids).toEqual(['p1']);
  });

  it('returns product_group for multi-variant', () => {
    const r = mod.buildProductSetParams({ _id: 'p1', variants: [{}, {}] }, 'ViewContent');
    expect(r.content_type).toBe('product_group');
  });
});

// ── getEnhancedCatalogFields ──────────────────────────────────────

describe('getEnhancedCatalogFields', () => {
  it('returns empty object for null product', () => {
    expect(mod.getEnhancedCatalogFields(null)).toEqual({});
  });

  it('returns price bucket labels', () => {
    expect(mod.getEnhancedCatalogFields({ price: 100 }).custom_label_0).toBe('under-200');
    expect(mod.getEnhancedCatalogFields({ price: 300 }).custom_label_0).toBe('200-500');
    expect(mod.getEnhancedCatalogFields({ price: 750 }).custom_label_0).toBe('500-1000');
    expect(mod.getEnhancedCatalogFields({ price: 1500 }).custom_label_0).toBe('over-1000');
  });

  it('detects brand from collections', () => {
    expect(mod.getEnhancedCatalogFields({ collections: ['wall-hugger-futons'] }).custom_label_1).toBe('Strata Furniture');
    expect(mod.getEnhancedCatalogFields({ collections: ['unfinished-frames'] }).custom_label_1).toBe('KD Frames');
    expect(mod.getEnhancedCatalogFields({ collections: ['mattress-sets'] }).custom_label_1).toBe('Otis Bed');
  });

  it('detects brand from product name', () => {
    expect(mod.getEnhancedCatalogFields({ name: 'Murphy Cabinet Bed' }).custom_label_1).toBe('Arason Enterprises');
  });

  it('defaults brand to Night & Day Furniture', () => {
    expect(mod.getEnhancedCatalogFields({ name: 'Standard Futon' }).custom_label_1).toBe('Night & Day Furniture');
  });

  it('detects product type from collections', () => {
    expect(mod.getEnhancedCatalogFields({ collections: ['murphy-beds'] }).product_type).toBe('Bedroom > Murphy Cabinet Beds');
    expect(mod.getEnhancedCatalogFields({ collections: ['mattresses'] }).product_type).toBe('Bedroom > Futon Mattresses');
    expect(mod.getEnhancedCatalogFields({ collections: ['platform-beds'] }).product_type).toBe('Bedroom > Platform Beds');
    expect(mod.getEnhancedCatalogFields({ collections: ['casegoods'] }).product_type).toBe('Bedroom > Casegoods & Accessories');
  });

  it('defaults product type to Futon Frames', () => {
    expect(mod.getEnhancedCatalogFields({ collections: [] }).product_type).toBe('Bedroom > Futon Frames');
  });

  it('sets sale status label', () => {
    expect(mod.getEnhancedCatalogFields({ discountedPrice: 400, price: 500 }).custom_label_3).toBe('on-sale');
    expect(mod.getEnhancedCatalogFields({ price: 500 }).custom_label_3).toBe('full-price');
  });

  it('sets stock status label', () => {
    expect(mod.getEnhancedCatalogFields({ inStock: true }).custom_label_4).toBe('in-stock');
    expect(mod.getEnhancedCatalogFields({ inStock: false }).custom_label_4).toBe('out-of-stock');
  });

  it('includes additional image links', () => {
    const r = mod.getEnhancedCatalogFields({
      mediaItems: [{ src: 'img1.jpg' }, { src: 'img2.jpg' }],
    });
    expect(r.additional_image_link).toContain('img1.jpg');
    expect(r.additional_image_link).toContain('img2.jpg');
  });

  it('caps additional images at 10', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ src: `img${i}.jpg` }));
    const r = mod.getEnhancedCatalogFields({ mediaItems: items });
    const urls = r.additional_image_link.split(',');
    expect(urls.length).toBe(10);
  });
});

// ── exportCustomerAudienceData ────────────────────────────────────

describe('exportCustomerAudienceData', () => {
  it('returns empty when no orders', async () => {
    __seed('Stores/Orders', []);
    const r = await mod.exportCustomerAudienceData();
    expect(r.success).toBe(true);
    expect(r.customers).toEqual([]);
  });

  it('deduplicates customers by email', async () => {
    __seed('Stores/Orders', [
      { buyerInfo: { email: 'jane@test.com' }, totals: { total: 500 }, billingInfo: { firstName: 'Jane', lastName: 'Doe' }, shippingInfo: {} },
      { buyerInfo: { email: 'JANE@test.com' }, totals: { total: 300 }, billingInfo: {}, shippingInfo: {} },
    ]);
    const r = await mod.exportCustomerAudienceData();
    expect(r.customers).toHaveLength(1);
    expect(r.customers[0].email).toBe('jane@test.com');
    expect(r.customers[0].value).toBe(800); // aggregated
  });

  it('normalizes customer data', async () => {
    __seed('Stores/Orders', [
      {
        buyerInfo: { email: ' Bob@Test.COM ' },
        totals: { total: 200 },
        billingInfo: { firstName: 'BOB', lastName: 'SMITH', phone: '(555) 999-8888' },
        shippingInfo: { shipmentDetails: { address: { city: 'Raleigh', subdivision: 'NC', postalCode: '27601', country: 'US' } } },
      },
    ]);
    const r = await mod.exportCustomerAudienceData();
    const c = r.customers[0];
    expect(c.fn).toBe('bob');
    expect(c.ln).toBe('smith');
    expect(c.phone).toBe('5559998888');
    expect(c.ct).toBe('raleigh');
    expect(c.st).toBe('nc');
    expect(c.zip).toBe('27601');
    expect(c.country).toBe('US');
  });

  it('skips orders without email', async () => {
    __seed('Stores/Orders', [
      { buyerInfo: {}, totals: { total: 100 }, billingInfo: {}, shippingInfo: {} },
    ]);
    const r = await mod.exportCustomerAudienceData();
    expect(r.customers).toHaveLength(0);
  });
});
