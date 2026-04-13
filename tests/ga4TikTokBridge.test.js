/**
 * @file ga4TikTokBridge.test.js
 * @description Verifies ga4Tracking fire* functions also dispatch TikTok pixel
 * events through pixelConsentService (cf-2tm Phase 7 pixel wiring).
 *
 * Each existing GA4 entry point (ViewContent, AddToCart, Purchase, AddToWishlist)
 * must fan out to fireTrackedTikTokEvent with the matching event name and a
 * TikTok-shaped payload (content_id / order_id + value + currency).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { fireTrackedTikTokEvent } = vi.hoisted(() => ({ fireTrackedTikTokEvent: vi.fn() }));

vi.mock('public/pixelConsentService', () => ({
  fireTrackedTikTokEvent,
  initConsentGate: vi.fn(),
}));

vi.mock('backend/analyticsHelpers.web', () => ({
  buildViewContentEvent: vi.fn(async () => ({})),
  buildAddToCartEvent:   vi.fn(async () => ({})),
  buildCheckoutEvent:    vi.fn(async () => ({})),
  buildPurchaseEvent:    vi.fn(async () => ({})),
  buildWishlistEvent:    vi.fn(async () => ({})),
  buildViewItemListEvent:vi.fn(async () => ({})),
  buildSearchEvent:      vi.fn(async () => ({})),
  buildViewCartEvent:    vi.fn(async () => ({})),
}));

import {
  fireViewContent,
  fireAddToCart,
  firePurchase,
  fireAddToWishlist,
} from '../src/public/ga4Tracking.js';

beforeEach(() => {
  fireTrackedTikTokEvent.mockClear();
});

describe('ga4 → TikTok bridge', () => {
  it('fireViewContent fans out to TikTok ViewContent with content_id/value/currency', async () => {
    await fireViewContent({ _id: 'p1', name: 'Kodiak', price: 899 });
    expect(fireTrackedTikTokEvent).toHaveBeenCalledWith(
      'ViewContent',
      expect.objectContaining({ content_id: 'p1', content_name: 'Kodiak', value: 899, currency: 'USD' }),
    );
  });

  it('fireAddToCart fans out to TikTok AddToCart with quantity-scaled value', async () => {
    await fireAddToCart({ _id: 'p2', price: 100 }, 3);
    expect(fireTrackedTikTokEvent).toHaveBeenCalledWith(
      'AddToCart',
      expect.objectContaining({ content_id: 'p2', quantity: 3, value: 300, currency: 'USD' }),
    );
  });

  it('firePurchase fans out to TikTok Purchase with order_id + total', async () => {
    await firePurchase({ _id: 'ord-42', totals: { total: 1299 }, lineItems: [] });
    expect(fireTrackedTikTokEvent).toHaveBeenCalledWith(
      'Purchase',
      expect.objectContaining({ order_id: 'ord-42', value: 1299, currency: 'USD' }),
    );
  });

  it('fireAddToWishlist fans out to TikTok AddToWishlist with content_id + value', async () => {
    await fireAddToWishlist({ _id: 'p3', price: 499 });
    expect(fireTrackedTikTokEvent).toHaveBeenCalledWith(
      'AddToWishlist',
      expect.objectContaining({ content_id: 'p3', value: 499, currency: 'USD' }),
    );
  });

  it('TikTok fan-out failures do not propagate to the caller', async () => {
    fireTrackedTikTokEvent.mockImplementationOnce(() => { throw new Error('consent service offline'); });
    await expect(fireViewContent({ _id: 'p4', price: 10 })).resolves.not.toThrow();
  });
});
