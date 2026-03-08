import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __seed, __reset, __onInsert } from '../__mocks__/wix-data.js';
import {
  buildCapiEvent,
  buildProductSetParams,
  exportCustomerAudienceData,
  getEnhancedCatalogFields,
} from '../../src/backend/facebookCatalog.web.js';
import {
  futonFrame,
  wallHuggerFrame,
  futonMattress,
  murphyBed,
  platformBed,
  casegoodsItem,
  saleProduct,
  metalFrame,
  outdoorFrame,
  allProducts,
  sampleOrder,
} from '../fixtures/products.js';

beforeEach(() => {
  __reset();
});

// ── buildCapiEvent ──────────────────────────────────────────────────

describe('buildCapiEvent', () => {
  it('builds ViewContent event with valid product', () => {
    const result = buildCapiEvent('ViewContent', {
      product: futonFrame,
      url: 'https://carolinafutons.com/product-page/eureka-futon-frame',
    });

    expect(result.event_name).toBe('ViewContent');
    expect(result.custom_data.content_ids).toContain('prod-frame-001');
    expect(result.custom_data.content_type).toBe('product');
    expect(result.custom_data.content_name).toBe('Eureka Futon Frame');
    expect(result.custom_data.value).toBe(499);
    expect(result.custom_data.currency).toBe('USD');
    expect(result.event_source_url).toBe('https://carolinafutons.com/product-page/eureka-futon-frame');
    expect(result.action_source).toBe('website');
  });

  it('builds Purchase event with order data', () => {
    const result = buildCapiEvent('Purchase', {
      order: sampleOrder,
      url: 'https://carolinafutons.com/thank-you',
      userInfo: { email: 'jane@example.com', firstName: 'Jane' },
    });

    expect(result.event_name).toBe('Purchase');
    expect(result.custom_data.value).toBe(877.99);
    expect(result.custom_data.currency).toBe('USD');
    expect(result.custom_data.content_ids).toHaveLength(2);
    expect(result.custom_data.num_items).toBe(2);
    expect(result.user_data.em).toBe('jane@example.com');
    expect(result.user_data.fn).toBe('jane');
  });

  it('builds AddToCart event', () => {
    const result = buildCapiEvent('AddToCart', {
      product: futonMattress,
      quantity: 2,
    });

    expect(result.event_name).toBe('AddToCart');
    expect(result.custom_data.content_ids).toContain('prod-matt-001');
    expect(result.custom_data.value).toBe(299); // discounted price
    expect(result.custom_data.num_items).toBe(2);
  });

  it('builds InitiateCheckout event', () => {
    const cartItems = [
      { productId: 'p1', name: 'Frame', price: 499, quantity: 1 },
      { productId: 'p2', name: 'Mattress', price: 299, quantity: 1 },
    ];

    const result = buildCapiEvent('InitiateCheckout', {
      cartItems,
      cartTotal: 798,
    });

    expect(result.event_name).toBe('InitiateCheckout');
    expect(result.custom_data.value).toBe(798);
    expect(result.custom_data.num_items).toBe(2);
  });

  it('builds Search event', () => {
    const result = buildCapiEvent('Search', {
      query: 'futon frame',
      resultCount: 12,
    });

    expect(result.event_name).toBe('Search');
    expect(result.custom_data.search_string).toBe('futon frame');
  });

  it('returns null for unknown event type', () => {
    const result = buildCapiEvent('UnknownEvent', {});
    expect(result).toBeNull();
  });

  it('returns null for null event name', () => {
    const result = buildCapiEvent(null, {});
    expect(result).toBeNull();
  });

  it('returns null for empty string event name', () => {
    const result = buildCapiEvent('', {});
    expect(result).toBeNull();
  });

  it('handles missing product gracefully', () => {
    const result = buildCapiEvent('ViewContent', { product: null });
    expect(result).toBeNull();
  });

  it('handles missing order gracefully', () => {
    const result = buildCapiEvent('Purchase', { order: null });
    expect(result).toBeNull();
  });

  it('includes event_time as unix timestamp', () => {
    const result = buildCapiEvent('ViewContent', {
      product: futonFrame,
    });

    expect(result.event_time).toBeDefined();
    expect(typeof result.event_time).toBe('number');
    // Should be within last few seconds
    const now = Math.floor(Date.now() / 1000);
    expect(result.event_time).toBeGreaterThan(now - 10);
    expect(result.event_time).toBeLessThanOrEqual(now);
  });

  it('includes user_data when provided', () => {
    const result = buildCapiEvent('ViewContent', {
      product: futonFrame,
      userInfo: {
        email: 'test@example.com',
        phone: '8285551234',
        firstName: 'Test',
        lastName: 'User',
        city: 'Asheville',
        state: 'NC',
        zip: '28801',
      },
    });

    expect(result.user_data.em).toBe('test@example.com');
    expect(result.user_data.ph).toBe('8285551234');
    expect(result.user_data.fn).toBe('test');
    expect(result.user_data.ln).toBe('user');
    expect(result.user_data.ct).toBe('asheville');
    expect(result.user_data.st).toBe('nc');
    expect(result.user_data.zp).toBe('28801');
  });

  it('sanitizes XSS in search query', () => {
    const result = buildCapiEvent('Search', {
      query: '<script>alert(1)</script>futon',
    });

    expect(result.custom_data.search_string).not.toContain('<script>');
  });
});

// ── buildProductSetParams ───────────────────────────────────────────

describe('buildProductSetParams', () => {
  it('builds retargeting params for viewed product', () => {
    const result = buildProductSetParams(futonFrame, 'ViewContent');

    expect(result.content_ids).toContain('prod-frame-001');
    expect(result.content_type).toBe('product');
    expect(result.product_catalog_id).toBeUndefined(); // Set by pixel config
  });

  it('returns content_type product_group for items with variants', () => {
    const result = buildProductSetParams({
      ...futonFrame,
      variants: [{ id: 'v1' }, { id: 'v2' }],
    }, 'ViewContent');

    expect(result.content_type).toBe('product_group');
  });

  it('returns null for null product', () => {
    expect(buildProductSetParams(null, 'ViewContent')).toBeNull();
  });

  it('returns null for undefined product', () => {
    expect(buildProductSetParams(undefined, 'ViewContent')).toBeNull();
  });

  it('handles product without _id', () => {
    const result = buildProductSetParams({ name: 'No ID' }, 'ViewContent');
    expect(result).toBeNull();
  });
});

// ── getEnhancedCatalogFields ────────────────────────────────────────

describe('getEnhancedCatalogFields', () => {
  it('returns DPA fields for a futon frame', () => {
    const fields = getEnhancedCatalogFields(futonFrame);

    expect(fields.product_type).toBe('Bedroom > Futon Frames');
    expect(fields.color).toBe('natural');
    expect(fields.material).toBe('hardwood');
    expect(fields.custom_label_0).toBeDefined(); // price bucket
    expect(fields.custom_label_1).toBeDefined(); // brand
    expect(fields.custom_label_2).toBeDefined(); // category
  });

  it('returns price bucket for custom_label_0', () => {
    const cheap = getEnhancedCatalogFields({ ...futonFrame, price: 150 });
    expect(cheap.custom_label_0).toBe('under-200');

    const mid = getEnhancedCatalogFields({ ...futonFrame, price: 500 });
    expect(mid.custom_label_0).toBe('200-500');

    const high = getEnhancedCatalogFields({ ...futonFrame, price: 800 });
    expect(high.custom_label_0).toBe('500-1000');

    const premium = getEnhancedCatalogFields({ ...futonFrame, price: 1500 });
    expect(premium.custom_label_0).toBe('over-1000');
  });

  it('returns brand as custom_label_1', () => {
    const fields = getEnhancedCatalogFields(wallHuggerFrame);
    // wallHuggerFrame fixture has brand: 'Strata' — brand field takes precedence
    expect(fields.custom_label_1).toBe('Strata');
  });

  it('flags on-sale items in custom_label_3', () => {
    const fields = getEnhancedCatalogFields(saleProduct);
    expect(fields.custom_label_3).toBe('on-sale');

    const noSale = getEnhancedCatalogFields(futonFrame);
    expect(noSale.custom_label_3).toBe('full-price');
  });

  it('flags in-stock vs out-of-stock in custom_label_4', () => {
    const inStock = getEnhancedCatalogFields(futonFrame);
    expect(inStock.custom_label_4).toBe('in-stock');

    const outOfStock = getEnhancedCatalogFields(outdoorFrame);
    expect(outOfStock.custom_label_4).toBe('out-of-stock');
  });

  it('handles null product', () => {
    expect(getEnhancedCatalogFields(null)).toEqual({});
  });

  it('handles empty object', () => {
    const fields = getEnhancedCatalogFields({});
    expect(fields.custom_label_0).toBe('under-200');
    expect(fields.custom_label_3).toBe('full-price');
  });

  it('returns additional_image_link for products with mediaItems', () => {
    const product = {
      ...futonFrame,
      mediaItems: [
        { src: 'https://example.com/img1.jpg' },
        { src: 'https://example.com/img2.jpg' },
        { src: 'https://example.com/img3.jpg' },
      ],
    };
    const fields = getEnhancedCatalogFields(product);
    expect(fields.additional_image_link).toBeDefined();
    expect(fields.additional_image_link.split(',')).toHaveLength(3);
  });

  it('limits additional images to 10', () => {
    const product = {
      ...futonFrame,
      mediaItems: Array.from({ length: 15 }, (_, i) => ({ src: `https://example.com/img${i}.jpg` })),
    };
    const fields = getEnhancedCatalogFields(product);
    expect(fields.additional_image_link.split(',')).toHaveLength(10);
  });
});

// ── exportCustomerAudienceData ──────────────────────────────────────

describe('exportCustomerAudienceData', () => {
  beforeEach(() => {
    __seed('Stores/Orders', [
      {
        _id: 'order-001',
        buyerInfo: { email: 'jane@example.com' },
        billingInfo: { firstName: 'Jane', lastName: 'Smith', phone: '8285551234' },
        shippingInfo: {
          shipmentDetails: {
            address: { city: 'Asheville', subdivision: 'NC', postalCode: '28801', country: 'US' },
          },
        },
        totals: { total: 877.99 },
        _createdDate: new Date('2025-06-15'),
      },
      {
        _id: 'order-002',
        buyerInfo: { email: 'bob@example.com' },
        billingInfo: { firstName: 'Bob', lastName: 'Jones', phone: '8285559999' },
        shippingInfo: {
          shipmentDetails: {
            address: { city: 'Charlotte', subdivision: 'NC', postalCode: '28202', country: 'US' },
          },
        },
        totals: { total: 499 },
        _createdDate: new Date('2025-07-01'),
      },
    ]);
  });

  it('returns success with customer data', async () => {
    const result = await exportCustomerAudienceData();
    expect(result.success).toBe(true);
    expect(result.customers).toHaveLength(2);
  });

  it('includes required fields per customer', async () => {
    const result = await exportCustomerAudienceData();
    const customer = result.customers[0];

    expect(customer.email).toBeDefined();
    expect(customer.fn).toBeDefined();
    expect(customer.ln).toBeDefined();
    expect(customer.ct).toBeDefined();
    expect(customer.st).toBeDefined();
    expect(customer.zip).toBeDefined();
    expect(customer.country).toBeDefined();
    expect(customer.value).toBeDefined();
  });

  it('lowercases email', async () => {
    __seed('Stores/Orders', [{
      _id: 'ord-upper',
      buyerInfo: { email: 'UPPER@EXAMPLE.COM' },
      billingInfo: { firstName: 'Test', lastName: 'User' },
      shippingInfo: { shipmentDetails: { address: {} } },
      totals: { total: 100 },
      _createdDate: new Date(),
    }]);

    const result = await exportCustomerAudienceData();
    expect(result.customers[0].email).toBe('upper@example.com');
  });

  it('deduplicates by email', async () => {
    __seed('Stores/Orders', [
      {
        _id: 'ord-1',
        buyerInfo: { email: 'same@example.com' },
        billingInfo: { firstName: 'A', lastName: 'B' },
        shippingInfo: { shipmentDetails: { address: {} } },
        totals: { total: 100 },
        _createdDate: new Date(),
      },
      {
        _id: 'ord-2',
        buyerInfo: { email: 'same@example.com' },
        billingInfo: { firstName: 'A', lastName: 'B' },
        shippingInfo: { shipmentDetails: { address: {} } },
        totals: { total: 200 },
        _createdDate: new Date(),
      },
    ]);

    const result = await exportCustomerAudienceData();
    expect(result.customers).toHaveLength(1);
    // Should aggregate total value
    expect(result.customers[0].value).toBe(300);
  });

  it('skips orders without email', async () => {
    __seed('Stores/Orders', [
      {
        _id: 'ord-no-email',
        buyerInfo: {},
        billingInfo: { firstName: 'No', lastName: 'Email' },
        shippingInfo: { shipmentDetails: { address: {} } },
        totals: { total: 100 },
        _createdDate: new Date(),
      },
    ]);

    const result = await exportCustomerAudienceData();
    expect(result.customers).toHaveLength(0);
  });

  it('handles empty orders collection', async () => {
    __seed('Stores/Orders', []);
    const result = await exportCustomerAudienceData();
    expect(result.success).toBe(true);
    expect(result.customers).toHaveLength(0);
  });

  it('handles missing billing info', async () => {
    __seed('Stores/Orders', [{
      _id: 'ord-missing',
      buyerInfo: { email: 'test@example.com' },
      billingInfo: null,
      shippingInfo: null,
      totals: { total: 50 },
      _createdDate: new Date(),
    }]);

    const result = await exportCustomerAudienceData();
    expect(result.success).toBe(true);
    expect(result.customers).toHaveLength(1);
    expect(result.customers[0].email).toBe('test@example.com');
  });

  it('returns phone with digits only', async () => {
    const result = await exportCustomerAudienceData();
    const customer = result.customers.find(c => c.email === 'jane@example.com');
    expect(customer.phone).toMatch(/^\d+$/);
  });
});
