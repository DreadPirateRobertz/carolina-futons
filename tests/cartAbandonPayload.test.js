/**
 * @file cartAbandonPayload.test.js
 * @description Tests for cart abandon payload endpoint (cf-b0lk).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';
import { exposeCartAbandonPayload } from '../src/backend/cartRecovery.web.js';

beforeEach(() => {
  __reset();
});

const SAMPLE_CART = {
  _id: 'cart-001',
  checkoutId: 'chk-001',
  memberId: 'mem-1',
  buyerEmail: 'buyer@example.com',
  buyerName: 'Sarah',
  cartTotal: 798,
  status: 'abandoned',
  lineItems: JSON.stringify([
    { name: 'Eureka Futon Frame', imageUrl: 'https://example.com/eureka.jpg', price: 499 },
    { name: 'Mesa 1000 Mattress', imageUrl: 'https://example.com/mesa.jpg', price: 299 },
  ]),
  abandonedAt: new Date().toISOString(),
};

// ── Lookup by cartId ────────────────────────────────────────────────

describe('exposeCartAbandonPayload — by cartId', () => {
  it('returns cart items with images and prices', async () => {
    __seed('AbandonedCarts', [SAMPLE_CART]);
    __seed('MobilePushSubscriptions', []);

    const result = await exposeCartAbandonPayload({ cartId: 'cart-001' });
    expect(result.success).toBe(true);
    expect(result.cart_items).toHaveLength(2);
    expect(result.cart_items[0].name).toBe('Eureka Futon Frame');
    expect(result.cart_items[0].image_url).toContain('eureka.jpg');
    expect(result.cart_items[0].price).toBe(499);
    expect(result.total_price).toBe(798);
    expect(result.cart_id).toBe('cart-001');
  });

  it('limits cart_items to max 3', async () => {
    const bigCart = {
      ...SAMPLE_CART,
      lineItems: JSON.stringify([
        { name: 'Item 1', price: 100 },
        { name: 'Item 2', price: 200 },
        { name: 'Item 3', price: 300 },
        { name: 'Item 4', price: 400 },
        { name: 'Item 5', price: 500 },
      ]),
    };
    __seed('AbandonedCarts', [bigCart]);
    __seed('MobilePushSubscriptions', []);

    const result = await exposeCartAbandonPayload({ cartId: 'cart-001' });
    expect(result.cart_items).toHaveLength(3);
  });

  it('returns failure for unknown cart', async () => {
    __seed('AbandonedCarts', []);
    const result = await exposeCartAbandonPayload({ cartId: 'nonexistent' });
    expect(result.success).toBe(false);
    expect(result.cart_items).toEqual([]);
  });
});

// ── Lookup by memberId ──────────────────────────────────────────────

describe('exposeCartAbandonPayload — by memberId', () => {
  it('finds most recent abandoned cart for member', async () => {
    __seed('AbandonedCarts', [SAMPLE_CART]);
    __seed('MobilePushSubscriptions', []);

    const result = await exposeCartAbandonPayload({ memberId: 'mem-1' });
    expect(result.success).toBe(true);
    expect(result.cart_items).toHaveLength(2);
    expect(result.total_price).toBe(798);
  });

  it('returns failure when member has no abandoned cart', async () => {
    __seed('AbandonedCarts', []);
    const result = await exposeCartAbandonPayload({ memberId: 'mem-999' });
    expect(result.success).toBe(false);
  });
});

// ── Push subscription check ─────────────────────────────────────────

describe('exposeCartAbandonPayload — push dedup', () => {
  it('returns member_push_enabled=true when push subscription exists', async () => {
    __seed('AbandonedCarts', [SAMPLE_CART]);
    __seed('MobilePushSubscriptions', [
      { memberId: 'mem-1', enabled: true, deviceToken: 'abc123' },
    ]);

    const result = await exposeCartAbandonPayload({ cartId: 'cart-001' });
    expect(result.member_push_enabled).toBe(true);
  });

  it('returns member_push_enabled=false when no push subscription', async () => {
    __seed('AbandonedCarts', [SAMPLE_CART]);
    __seed('MobilePushSubscriptions', []);

    const result = await exposeCartAbandonPayload({ cartId: 'cart-001' });
    expect(result.member_push_enabled).toBe(false);
  });

  it('returns member_push_enabled=false when subscription disabled', async () => {
    __seed('AbandonedCarts', [SAMPLE_CART]);
    __seed('MobilePushSubscriptions', [
      { memberId: 'mem-1', enabled: false },
    ]);

    const result = await exposeCartAbandonPayload({ cartId: 'cart-001' });
    expect(result.member_push_enabled).toBe(false);
  });
});

// ── Validation ──────────────────────────────────────────────────────

describe('exposeCartAbandonPayload — validation', () => {
  it('returns failure when neither cartId nor memberId provided', async () => {
    const result = await exposeCartAbandonPayload({});
    expect(result.success).toBe(false);
  });

  it('returns failure for empty params', async () => {
    const result = await exposeCartAbandonPayload();
    expect(result.success).toBe(false);
  });
});
