import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fireViewContent,
  fireAddToCart,
  fireInitiateCheckout,
  firePurchase,
  fireAddToWishlist,
  fireCustomEvent,
} from '../../src/public/ga4Tracking.js';

// ── fireViewContent ──────────────────────────────────────────────────

describe('fireViewContent', () => {
  it('does not throw with valid product', async () => {
    await expect(fireViewContent({
      _id: 'p1',
      name: 'Kodiak Futon Frame',
      price: 899,
      collections: ['futon-frames'],
    })).resolves.not.toThrow();
  });

  it('does not throw with null product', async () => {
    await expect(fireViewContent(null)).resolves.not.toThrow();
  });

  it('does not throw with undefined', async () => {
    await expect(fireViewContent(undefined)).resolves.not.toThrow();
  });

  it('does not throw with empty object', async () => {
    await expect(fireViewContent({})).resolves.not.toThrow();
  });

  it('handles product without collections', async () => {
    await expect(fireViewContent({
      _id: 'p1',
      name: 'Test',
      price: 100,
    })).resolves.not.toThrow();
  });
});

// ── fireAddToCart ─────────────────────────────────────────────────────

describe('fireAddToCart', () => {
  it('does not throw with valid product and quantity', async () => {
    await expect(fireAddToCart({
      _id: 'p1',
      name: 'Monterey Frame',
      price: 699,
    }, 2)).resolves.not.toThrow();
  });

  it('does not throw with null product', async () => {
    await expect(fireAddToCart(null)).resolves.not.toThrow();
  });

  it('defaults quantity to 1', async () => {
    await expect(fireAddToCart({
      _id: 'p1',
      name: 'Test',
      price: 100,
    })).resolves.not.toThrow();
  });

  it('handles zero price', async () => {
    await expect(fireAddToCart({
      _id: 'p1',
      name: 'Free Item',
      price: 0,
    })).resolves.not.toThrow();
  });
});

// ── fireInitiateCheckout ─────────────────────────────────────────────

describe('fireInitiateCheckout', () => {
  it('does not throw with cart items and total', async () => {
    await expect(fireInitiateCheckout(
      [{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 2 }],
      1299
    )).resolves.not.toThrow();
  });

  it('does not throw with empty cart', async () => {
    await expect(fireInitiateCheckout([], 0)).resolves.not.toThrow();
  });

  it('does not throw with null values', async () => {
    await expect(fireInitiateCheckout(null, null)).resolves.not.toThrow();
  });

  it('handles items without productId', async () => {
    await expect(fireInitiateCheckout(
      [{ _id: 'item1', quantity: 1 }],
      500
    )).resolves.not.toThrow();
  });
});

// ── firePurchase ─────────────────────────────────────────────────────

describe('firePurchase', () => {
  it('does not throw with valid order', async () => {
    await expect(firePurchase({
      _id: 'order-123',
      lineItems: [
        { catalogItemId: 'p1', quantity: 1 },
        { catalogItemId: 'p2', quantity: 2 },
      ],
      totals: { total: 1599 },
    })).resolves.not.toThrow();
  });

  it('does not throw with null order', async () => {
    await expect(firePurchase(null)).resolves.not.toThrow();
  });

  it('does not throw with empty order', async () => {
    await expect(firePurchase({})).resolves.not.toThrow();
  });

  it('handles order without lineItems', async () => {
    await expect(firePurchase({
      _id: 'order-456',
      totals: { total: 500 },
    })).resolves.not.toThrow();
  });

  it('handles order without totals', async () => {
    await expect(firePurchase({
      _id: 'order-789',
      lineItems: [{ catalogItemId: 'p1', quantity: 1 }],
    })).resolves.not.toThrow();
  });
});

// ── fireAddToWishlist ────────────────────────────────────────────────

describe('fireAddToWishlist', () => {
  it('does not throw with valid product', async () => {
    await expect(fireAddToWishlist({
      _id: 'p1',
      name: 'Kodiak Futon',
      price: 899,
    })).resolves.not.toThrow();
  });

  it('does not throw with null', async () => {
    await expect(fireAddToWishlist(null)).resolves.not.toThrow();
  });

  it('does not throw with undefined', async () => {
    await expect(fireAddToWishlist(undefined)).resolves.not.toThrow();
  });
});

// ── fireCustomEvent ─────────────────────────────────────────────────

describe('fireCustomEvent', () => {
  it('does not throw with event name and params', async () => {
    await expect(fireCustomEvent('newsletter_signup', {
      source: 'footer',
      value: 0,
    })).resolves.not.toThrow();
  });

  it('does not throw with event name only', async () => {
    await expect(fireCustomEvent('page_view')).resolves.not.toThrow();
  });

  it('does not throw with empty params', async () => {
    await expect(fireCustomEvent('test', {})).resolves.not.toThrow();
  });

  it('handles various custom event types', async () => {
    const events = [
      'newsletter_signup',
      'social_follow',
      'exit_intent_capture',
      'referral_share',
      'quiz_complete',
    ];
    for (const name of events) {
      await expect(fireCustomEvent(name, { source: 'test' })).resolves.not.toThrow();
    }
  });
});
