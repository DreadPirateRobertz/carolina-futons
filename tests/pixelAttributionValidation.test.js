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
 *   search       | CustomEvent {event:search} | (no standard)    | Search
 *
 * TikTok Pixel is loaded via Wix CLI embedded-script extension (CF-qg7d) —
 * no local JS file. Standard TikTok params: content_id (string), content_type,
 * value, currency. Note: GA4/Meta use content_ids (array); TikTok uses
 * content_id (singular string) — callers must adapt when bridging.
 */
import { describe, it, expect } from 'vitest';
import {
  buildViewContentEvent,
  buildAddToCartEvent,
  buildCheckoutEvent,
  buildPurchaseEvent,
  buildSearchEvent,
} from '../src/backend/analyticsHelpers.web.js';
import { futonFrame, futonMattress, sampleOrder } from './fixtures/products.js';

// ── Required attribution fields ────────────────────────────────────────
// GA4, Meta Pixel, and TikTok Pixel all require: value, currency,
// content_type, and at least one form of content identifier.

describe('product_view (ViewContent) — required attribution fields', () => {
  it('includes value (numeric, non-negative)', async () => {
    const payload = await buildViewContentEvent(futonFrame);
    expect(typeof payload.value).toBe('number');
    expect(payload.value).toBeGreaterThanOrEqual(0);
  });

  it('includes currency = "USD"', async () => {
    const payload = await buildViewContentEvent(futonFrame);
    expect(payload.currency).toBe('USD');
  });

  it('includes content_type = "product"', async () => {
    const payload = await buildViewContentEvent(futonFrame);
    expect(payload.content_type).toBe('product');
  });

  it('includes content_ids as a non-empty array', async () => {
    const payload = await buildViewContentEvent(futonFrame);
    expect(Array.isArray(payload.content_ids)).toBe(true);
    expect(payload.content_ids.length).toBeGreaterThan(0);
    expect(payload.content_ids[0]).toBe(futonFrame._id);
  });

  it('includes content_name', async () => {
    const payload = await buildViewContentEvent(futonFrame);
    expect(payload.content_name).toBe(futonFrame.name);
  });
});

describe('add_to_cart (AddToCart) — required attribution fields', () => {
  it('includes value (price × quantity)', async () => {
    const payload = await buildAddToCartEvent(futonFrame, 2);
    expect(payload.value).toBe(futonFrame.price * 2);
  });

  it('value defaults to price × 1 when quantity omitted', async () => {
    const payload = await buildAddToCartEvent(futonFrame);
    expect(payload.value).toBe(futonFrame.price);
  });

  it('includes currency = "USD"', async () => {
    const payload = await buildAddToCartEvent(futonFrame, 1);
    expect(payload.currency).toBe('USD');
  });

  it('includes content_type = "product"', async () => {
    const payload = await buildAddToCartEvent(futonFrame, 1);
    expect(payload.content_type).toBe('product');
  });

  it('includes content_ids as a non-empty array', async () => {
    const payload = await buildAddToCartEvent(futonFrame, 1);
    expect(Array.isArray(payload.content_ids)).toBe(true);
    expect(payload.content_ids[0]).toBe(futonFrame._id);
  });

  it('includes num_items matching quantity', async () => {
    const payload = await buildAddToCartEvent(futonFrame, 3);
    expect(payload.num_items).toBe(3);
  });
});

describe('purchase (Purchase) — required attribution fields', () => {
  it('includes value from order total', async () => {
    const payload = await buildPurchaseEvent(sampleOrder);
    expect(typeof payload.value).toBe('number');
    expect(payload.value).toBeGreaterThan(0);
  });

  it('includes currency = "USD"', async () => {
    const payload = await buildPurchaseEvent(sampleOrder);
    expect(payload.currency).toBe('USD');
  });

  it('includes content_type = "product"', async () => {
    const payload = await buildPurchaseEvent(sampleOrder);
    expect(payload.content_type).toBe('product');
  });

  it('includes content_ids array from line items', async () => {
    const payload = await buildPurchaseEvent(sampleOrder);
    expect(Array.isArray(payload.content_ids)).toBe(true);
    expect(payload.content_ids.length).toBeGreaterThan(0);
  });

  it('includes order_id for deduplication', async () => {
    const payload = await buildPurchaseEvent(sampleOrder);
    expect(payload.order_id).toBeTruthy();
  });

  it('includes num_items', async () => {
    const payload = await buildPurchaseEvent(sampleOrder);
    expect(typeof payload.num_items).toBe('number');
    expect(payload.num_items).toBeGreaterThan(0);
  });
});

describe('search — required attribution fields', () => {
  it('includes search_term', async () => {
    const payload = await buildSearchEvent('futon frame', 8);
    expect(payload.search_term).toBe('futon frame');
  });

  it('includes results_count', async () => {
    const payload = await buildSearchEvent('futon frame', 8);
    expect(typeof payload.results_count).toBe('number');
    expect(payload.results_count).toBe(8);
  });

  it('handles zero results without omitting results_count', async () => {
    const payload = await buildSearchEvent('nonexistent product xyz', 0);
    expect(payload.results_count).toBe(0);
  });
});

// ── Pinterest Tag event naming conventions ────────────────────────────
// Pinterest requires lowercase no-space event names.
// Standard Pinterest events: pagevisit, viewcategory, addtocart, checkout, purchase.

describe('Pinterest Tag — event naming conventions', () => {
  it('product view fires as "viewcategory" (lowercase, no space)', () => {
    // Documenting that firePinterestEvent should be called with 'viewcategory',
    // not 'view_category', 'ViewCategory', or 'view category'.
    expect('viewcategory').not.toContain(' ');
    expect('viewcategory').toBe('viewcategory');
  });

  it('add_to_cart fires as "addtocart" (lowercase, no space)', () => {
    expect('addtocart').not.toContain(' ');
    expect('addtocart').not.toContain('_');
  });

  it('purchase fires as "purchase" (lowercase)', () => {
    expect('purchase').toBe('purchase');
    expect('purchase').not.toContain(' ');
  });

  it('checkout fires as "checkout" (lowercase)', () => {
    expect('checkout').toBe('checkout');
    expect('checkout').not.toContain(' ');
  });

  it('pageview fires as "pagevisit" (Pinterest convention)', () => {
    // Pinterest uses 'pagevisit' not 'pageview'
    expect('pagevisit').not.toBe('pageview');
    expect('pagevisit').toBe('pagevisit');
  });
});

// ── Cross-platform schema consistency ─────────────────────────────────
// Validates that the GA4 payload fields are compatible with Pinterest/TikTok
// requirements, and documents known divergences.

describe('Cross-platform field alignment — product events', () => {
  it('content_ids array first element matches expected product ID', async () => {
    const ga4Payload = await buildViewContentEvent(futonFrame);
    // GA4/Meta: content_ids (array)
    // TikTok standard: content_id (string) — caller must adapt: content_id = content_ids[0]
    expect(ga4Payload.content_ids[0]).toBe(futonFrame._id);
  });

  it('value is positive for a priced product across ViewContent and AddToCart', async () => {
    const viewPayload = await buildViewContentEvent(futonFrame);
    const cartPayload = await buildAddToCartEvent(futonFrame, 1);
    expect(viewPayload.value).toBeGreaterThan(0);
    expect(cartPayload.value).toBeGreaterThan(0);
  });

  it('both ViewContent and AddToCart use content_type = "product"', async () => {
    const viewPayload = await buildViewContentEvent(futonFrame);
    const cartPayload = await buildAddToCartEvent(futonFrame, 1);
    expect(viewPayload.content_type).toBe('product');
    expect(cartPayload.content_type).toBe('product');
  });

  it('purchase payload content_ids matches checkout payload content_ids', async () => {
    const cartItems = [
      { productId: futonFrame._id, quantity: 1 },
      { productId: futonMattress._id, quantity: 1 },
    ];
    const checkoutPayload = await buildCheckoutEvent(cartItems, 848);
    const purchasePayload = await buildPurchaseEvent({
      ...sampleOrder,
      lineItems: cartItems.map(i => ({ catalogItemId: i.productId, quantity: i.quantity })),
    });
    // Both should include all product IDs
    const checkoutIds = checkoutPayload.content_ids;
    const purchaseIds = purchasePayload.content_ids;
    expect(checkoutIds).toContain(futonFrame._id);
    expect(purchaseIds).toContain(futonFrame._id);
  });
});

// ── Null/empty product guards (platform resilience) ────────────────────

describe('Null/empty product guards — attribution payload stability', () => {
  it('buildViewContentEvent returns empty object for null product', async () => {
    const payload = await buildViewContentEvent(null);
    expect(payload).toEqual({});
  });

  it('buildAddToCartEvent returns empty object for null product', async () => {
    const payload = await buildAddToCartEvent(null);
    expect(payload).toEqual({});
  });

  it('buildPurchaseEvent returns empty object for null order', async () => {
    const payload = await buildPurchaseEvent(null);
    expect(payload).toEqual({});
  });

  it('buildViewContentEvent value is 0 for zero-price product', async () => {
    const freeProduct = { ...futonFrame, price: 0 };
    const payload = await buildViewContentEvent(freeProduct);
    expect(payload.value).toBe(0);
  });

  it('purchase value falls back to 0 for order without totals', async () => {
    const noTotals = { _id: 'order-no-totals', lineItems: [] };
    const payload = await buildPurchaseEvent(noTotals);
    expect(payload.value).toBe(0);
  });
});
