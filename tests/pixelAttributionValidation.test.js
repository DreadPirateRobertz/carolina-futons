/**
 * CF-9254: GA4 + pixel attribution validation
 *
 * Validates that event payloads produced by the analytics helpers include
 * the required attribution fields for each platform and that event naming
 * is consistent with each platform's conventions.
 *
 * Platform event name mapping:
 *   Event        | GA4 (wixWindow.trackEvent) | Pinterest Tag    | TikTok Pixel
 *   -------------|----------------------------|------------------|-------------------
 *   pageview     | (Wix built-in)             | pagevisit        | PageView (ext.)
 *   product_view | ViewContent                | viewcategory     | ViewContent
 *   add_to_cart  | AddToCart                  | addtocart        | AddToCart
 *   purchase     | Purchase                   | purchase         | CompletePayment
 *   search       | CustomEvent + event:'search'| (no standard)   | Search
 *
 * TikTok Pixel is loaded via Wix CLI embedded-script extension (CF-qg7d) —
 * no local JS file. Standard TikTok params: content_id (string), content_type,
 * value, currency. Note: GA4/Meta use content_ids (array); TikTok uses
 * content_id (singular string) — callers must adapt when bridging.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildViewContentEvent,
  buildAddToCartEvent,
  buildCheckoutEvent,
  buildPurchaseEvent,
  buildSearchEvent,
} from '../src/backend/analyticsHelpers.web.js';
import { futonFrame, futonMattress, sampleOrder } from './fixtures/products.js';

// Pinterest Tag event name constants — lowercase, no spaces (platform requirement)
const PINTEREST_EVENTS = {
  pageview:     'pagevisit',   // Pinterest uses 'pagevisit', not 'pageview'
  productView:  'viewcategory',
  addToCart:    'addtocart',
  checkout:     'checkout',
  purchase:     'purchase',
};

// ── Required attribution fields ────────────────────────────────────────
// GA4, Meta Pixel, and TikTok Pixel all require: value, currency,
// content_type, and at least one form of content identifier.

describe('product_view (ViewContent) — required attribution fields', () => {
  let payload;
  beforeAll(async () => { payload = await buildViewContentEvent(futonFrame); });

  it('includes value (numeric, non-negative)', () => {
    expect(typeof payload.value).toBe('number');
    expect(payload.value).toBeGreaterThanOrEqual(0);
  });

  it('includes currency = "USD"', () => {
    expect(payload.currency).toBe('USD');
  });

  it('includes content_type = "product"', () => {
    expect(payload.content_type).toBe('product');
  });

  it('includes content_ids as a non-empty array with the product ID', () => {
    expect(payload.content_ids).toEqual(expect.arrayContaining([futonFrame._id]));
  });

  it('includes content_name', () => {
    expect(payload.content_name).toBe(futonFrame.name);
  });
});

describe('add_to_cart (AddToCart) — required attribution fields', () => {
  let payload;
  beforeAll(async () => { payload = await buildAddToCartEvent(futonFrame, 2); });

  it('includes value (price × quantity)', () => {
    expect(payload.value).toBe(futonFrame.price * 2);
  });

  it('includes currency = "USD"', () => {
    expect(payload.currency).toBe('USD');
  });

  it('includes content_type = "product"', () => {
    expect(payload.content_type).toBe('product');
  });

  it('includes content_ids with the product ID', () => {
    expect(payload.content_ids).toEqual(expect.arrayContaining([futonFrame._id]));
  });

  it('includes num_items matching quantity', () => {
    expect(payload.num_items).toBe(2);
  });

  it('value defaults to price × 1 when quantity omitted', async () => {
    const single = await buildAddToCartEvent(futonFrame);
    expect(single.value).toBe(futonFrame.price);
  });
});

describe('purchase (Purchase) — required attribution fields', () => {
  let payload;
  beforeAll(async () => { payload = await buildPurchaseEvent(sampleOrder); });

  it('includes value from order total', () => {
    expect(typeof payload.value).toBe('number');
    expect(payload.value).toBeGreaterThan(0);
  });

  it('includes currency = "USD"', () => {
    expect(payload.currency).toBe('USD');
  });

  it('includes content_type = "product"', () => {
    expect(payload.content_type).toBe('product');
  });

  it('includes content_ids array from line items', () => {
    expect(Array.isArray(payload.content_ids)).toBe(true);
    expect(payload.content_ids.length).toBeGreaterThan(0);
  });

  it('includes order_id matching the order _id', () => {
    expect(payload.order_id).toBe(sampleOrder._id);
  });

  it('includes num_items', () => {
    expect(typeof payload.num_items).toBe('number');
    expect(payload.num_items).toBeGreaterThan(0);
  });
});

describe('search — required attribution fields', () => {
  let payload;
  beforeAll(async () => { payload = await buildSearchEvent('futon frame', 8); });

  it('includes search_term', () => {
    expect(payload.search_term).toBe('futon frame');
  });

  it('includes results_count', () => {
    expect(payload.results_count).toBe(8);
  });

  it('handles zero results without omitting results_count', async () => {
    const empty = await buildSearchEvent('nonexistent product xyz', 0);
    expect(empty.results_count).toBe(0);
  });

  it('defaults results_count to 0 when second argument is omitted', async () => {
    const noCount = await buildSearchEvent('futon frame');
    expect(noCount.results_count).toBe(0);
  });
});

// ── Pinterest Tag event naming conventions ────────────────────────────
// Pinterest requires lowercase no-space event names.
// These tests validate the PINTEREST_EVENTS constants exported above,
// which callers must use when invoking firePinterestEvent().

describe('Pinterest Tag — event naming conventions', () => {
  it('all event names are lowercase strings', () => {
    for (const name of Object.values(PINTEREST_EVENTS)) {
      expect(name).toBe(name.toLowerCase());
    }
  });

  it('no event name contains a space or underscore', () => {
    for (const name of Object.values(PINTEREST_EVENTS)) {
      expect(name).not.toContain(' ');
      expect(name).not.toContain('_');
    }
  });

  it('product view uses "viewcategory" (not "view_content" or "ViewContent")', () => {
    expect(PINTEREST_EVENTS.productView).toBe('viewcategory');
    expect(PINTEREST_EVENTS.productView).not.toBe('ViewContent');
  });

  it('add to cart uses "addtocart" (not "AddToCart")', () => {
    expect(PINTEREST_EVENTS.addToCart).toBe('addtocart');
    expect(PINTEREST_EVENTS.addToCart).not.toBe('AddToCart');
  });

  it('pageview uses "pagevisit" (Pinterest convention, not "pageview")', () => {
    expect(PINTEREST_EVENTS.pageview).toBe('pagevisit');
    expect(PINTEREST_EVENTS.pageview).not.toBe('pageview');
  });
});

// ── Purchase content_ids field mapping ────────────────────────────────
// buildPurchaseEvent maps: item.catalogItemId || item.sku
// GA4/TikTok best practice: send catalogItemId (UUID) not SKU.

describe('purchase content_ids — catalogItemId vs sku precedence', () => {
  it('uses catalogItemId when present (UUID, not SKU)', async () => {
    const order = {
      _id: 'order-002',
      lineItems: [{ catalogItemId: futonFrame._id, sku: futonFrame.sku, quantity: 1 }],
      totals: { total: futonFrame.price },
    };
    const payload = await buildPurchaseEvent(order);
    expect(payload.content_ids).toContain(futonFrame._id);
    expect(payload.content_ids).not.toContain(futonFrame.sku);
  });

  it('falls back to sku when catalogItemId is absent', async () => {
    // sampleOrder lineItems only have sku — this is the actual fixture shape
    const payload = await buildPurchaseEvent(sampleOrder);
    expect(payload.content_ids).toContain('EUR-FRM-001'); // sku fallback
    expect(payload.content_ids).not.toContain(futonFrame._id); // UUID not present
  });
});

// ── Cross-platform schema consistency ─────────────────────────────────

describe('Cross-platform field alignment — checkout/purchase ID consistency', () => {
  it('checkout and purchase payload content_ids both include the same product IDs', async () => {
    const cartItems = [
      { productId: futonFrame._id, quantity: 1 },
      { productId: futonMattress._id, quantity: 1 },
    ];
    const [checkoutPayload, purchasePayload] = await Promise.all([
      buildCheckoutEvent(cartItems, 848),
      buildPurchaseEvent({
        ...sampleOrder,
        lineItems: cartItems.map(i => ({ catalogItemId: i.productId, quantity: i.quantity })),
      }),
    ]);
    expect(checkoutPayload.content_ids).toContain(futonFrame._id);
    expect(purchasePayload.content_ids).toContain(futonFrame._id);
  });
});

// ── Null/empty product guards (platform resilience) ────────────────────

describe('Null/empty product guards — attribution payload stability', () => {
  it('buildViewContentEvent returns empty object for null product', async () => {
    expect(await buildViewContentEvent(null)).toEqual({});
  });

  it('buildAddToCartEvent returns empty object for null product', async () => {
    expect(await buildAddToCartEvent(null)).toEqual({});
  });

  it('buildPurchaseEvent returns empty object for null order', async () => {
    expect(await buildPurchaseEvent(null)).toEqual({});
  });

  it('buildCheckoutEvent handles null cartItems gracefully', async () => {
    const payload = await buildCheckoutEvent(null, 0);
    expect(payload.content_ids).toEqual([]);
    expect(payload.value).toBe(0);
  });

  it('buildViewContentEvent value is 0 for zero-price product', async () => {
    const payload = await buildViewContentEvent({ ...futonFrame, price: 0 });
    expect(payload.value).toBe(0);
  });

  it('purchase value falls back to 0 for order without totals', async () => {
    const payload = await buildPurchaseEvent({ _id: 'order-no-totals', lineItems: [] });
    expect(payload.value).toBe(0);
  });
});
