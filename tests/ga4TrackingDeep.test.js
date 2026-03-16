/**
 * Deep coverage tests for ga4Tracking.js — verifies trackEvent calls,
 * custom event sanitization, and scroll depth tracking.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock wix-window-frontend with trackEvent spy
const mockTrackEvent = vi.fn();
vi.mock('wix-window-frontend', () => ({
  default: { trackEvent: mockTrackEvent },
  trackEvent: mockTrackEvent,
}));

// Mock analyticsHelpers to return predictable payloads
vi.mock('backend/analyticsHelpers.web', () => ({
  buildViewContentEvent: vi.fn(async (p) => p ? { content_ids: [p._id], content_name: p.name, value: p.price } : null),
  buildAddToCartEvent: vi.fn(async (p, q) => p ? { content_ids: [p._id], content_name: p.name, value: p.price, num_items: q } : null),
  buildCheckoutEvent: vi.fn(async (items, total) => items?.length ? { content_ids: items.map(i => i._id), value: total, num_items: items.length } : null),
  buildPurchaseEvent: vi.fn(async (order) => order?._id ? { content_ids: [order._id], value: order.totals?.total || 0 } : null),
  buildWishlistEvent: vi.fn(async (p) => p ? { content_ids: [p._id], content_name: p.name } : null),
  buildViewItemListEvent: vi.fn(async (items, name) => items?.length ? { item_list_name: name, items: items.map(i => ({ item_id: i._id })) } : null),
  buildSearchEvent: vi.fn(async (q, count) => q ? { search_term: q, results_count: count } : null),
  buildViewCartEvent: vi.fn(async (items, total) => items?.length ? { items: items.map(i => ({ item_id: i._id })), value: total } : null),
}));

import {
  fireViewContent,
  fireAddToCart,
  fireInitiateCheckout,
  firePurchase,
  fireAddToWishlist,
  fireCustomEvent,
  fireViewItemList,
  fireSearch,
  fireViewCart,
  initScrollDepthTracking,
} from '../src/public/ga4Tracking.js';

describe('ga4Tracking trackEvent verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── fireViewContent ─────────────────────────────────────────────────

  describe('fireViewContent', () => {
    it('calls trackEvent with ViewContent and product payload', async () => {
      await fireViewContent({ _id: 'p1', name: 'Kodiak', price: 899 });
      expect(mockTrackEvent).toHaveBeenCalledWith('ViewContent', expect.objectContaining({
        content_ids: ['p1'],
        content_name: 'Kodiak',
      }));
    });

    it('does not call trackEvent for null product', async () => {
      await fireViewContent(null);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  // ── fireAddToCart ───────────────────────────────────────────────────

  describe('fireAddToCart', () => {
    it('calls trackEvent with AddToCart', async () => {
      await fireAddToCart({ _id: 'p1', name: 'Frame', price: 699 }, 2);
      expect(mockTrackEvent).toHaveBeenCalledWith('AddToCart', expect.objectContaining({
        num_items: 2,
      }));
    });

    it('does not call trackEvent for null product', async () => {
      await fireAddToCart(null);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  // ── fireInitiateCheckout ────────────────────────────────────────────

  describe('fireInitiateCheckout', () => {
    it('calls trackEvent with InitiateCheckout', async () => {
      await fireInitiateCheckout([{ _id: 'p1' }], 1299);
      expect(mockTrackEvent).toHaveBeenCalledWith('InitiateCheckout', expect.objectContaining({
        value: 1299,
      }));
    });

    it('does not call trackEvent for empty cart', async () => {
      await fireInitiateCheckout([], 0);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('does not call trackEvent for null', async () => {
      await fireInitiateCheckout(null, null);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  // ── firePurchase ────────────────────────────────────────────────────

  describe('firePurchase', () => {
    it('calls trackEvent with Purchase', async () => {
      await firePurchase({ _id: 'order-1', totals: { total: 1599 } });
      expect(mockTrackEvent).toHaveBeenCalledWith('Purchase', expect.objectContaining({
        content_ids: ['order-1'],
      }));
    });

    it('does not call trackEvent for null order', async () => {
      await firePurchase(null);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  // ── fireAddToWishlist ───────────────────────────────────────────────

  describe('fireAddToWishlist', () => {
    it('calls trackEvent with AddToWishlist', async () => {
      await fireAddToWishlist({ _id: 'p1', name: 'Kodiak' });
      expect(mockTrackEvent).toHaveBeenCalledWith('AddToWishlist', expect.objectContaining({
        content_ids: ['p1'],
      }));
    });

    it('does not call trackEvent for null', async () => {
      await fireAddToWishlist(null);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  // ── fireCustomEvent ─────────────────────────────────────────────────

  describe('fireCustomEvent', () => {
    it('calls trackEvent with sanitized event name', async () => {
      await fireCustomEvent('newsletter_signup', { source: 'footer' });
      expect(mockTrackEvent).toHaveBeenCalledWith('CustomEvent', expect.objectContaining({
        event: 'newsletter_signup',
        source: 'footer',
      }));
    });

    it('strips non-alphanumeric characters from event name', async () => {
      await fireCustomEvent('my-event.name!', {});
      expect(mockTrackEvent).toHaveBeenCalledWith('CustomEvent', expect.objectContaining({
        event: 'myeventname',
      }));
    });

    it('does not call trackEvent for empty event name', async () => {
      await fireCustomEvent('', {});
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('does not call trackEvent for null event name', async () => {
      await fireCustomEvent(null);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('does not call trackEvent for non-string event name', async () => {
      await fireCustomEvent(123);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('does not call trackEvent when sanitized name is empty', async () => {
      await fireCustomEvent('!!!', {});
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('passes additional params through', async () => {
      await fireCustomEvent('quiz_complete', { score: 95, category: 'style' });
      expect(mockTrackEvent).toHaveBeenCalledWith('CustomEvent', expect.objectContaining({
        event: 'quiz_complete',
        score: 95,
        category: 'style',
      }));
    });
  });

  // ── fireViewItemList ────────────────────────────────────────────────

  describe('fireViewItemList', () => {
    it('calls trackEvent with CustomEvent view_item_list', async () => {
      await fireViewItemList([{ _id: 'p1' }, { _id: 'p2' }], 'futon-frames');
      expect(mockTrackEvent).toHaveBeenCalledWith('CustomEvent', expect.objectContaining({
        event: 'view_item_list',
        item_list_name: 'futon-frames',
      }));
    });

    it('does not call trackEvent for null items', async () => {
      await fireViewItemList(null, 'test');
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('does not call trackEvent for empty items', async () => {
      await fireViewItemList([], 'test');
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  // ── fireSearch ──────────────────────────────────────────────────────

  describe('fireSearch', () => {
    it('calls trackEvent with CustomEvent search', async () => {
      await fireSearch('futon mattress', 12);
      expect(mockTrackEvent).toHaveBeenCalledWith('CustomEvent', expect.objectContaining({
        event: 'search',
        search_term: 'futon mattress',
        results_count: 12,
      }));
    });

    it('does not call trackEvent for null query', async () => {
      await fireSearch(null, 0);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });

  // ── fireViewCart ────────────────────────────────────────────────────

  describe('fireViewCart', () => {
    it('calls trackEvent with CustomEvent view_cart', async () => {
      await fireViewCart([{ _id: 'p1' }], 899);
      expect(mockTrackEvent).toHaveBeenCalledWith('CustomEvent', expect.objectContaining({
        event: 'view_cart',
        value: 899,
      }));
    });

    it('does not call trackEvent for null items', async () => {
      await fireViewCart(null, 0);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it('does not call trackEvent for empty cart', async () => {
      await fireViewCart([], 0);
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });
  });
});

// ── initScrollDepthTracking ─────────────────────────────────────────

describe('initScrollDepthTracking', () => {
  let addEventSpy;
  let removeEventSpy;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up minimal window/document mocks
    globalThis.window = globalThis.window || {};
    globalThis.document = globalThis.document || {};
    globalThis.window.scrollY = 0;
    globalThis.document.documentElement = {
      scrollTop: 0,
      scrollHeight: 2000,
      clientHeight: 500,
    };
    globalThis.window.location = { pathname: '/test-page' };
    addEventSpy = vi.fn();
    removeEventSpy = vi.fn();
    globalThis.window.addEventListener = addEventSpy;
    globalThis.window.removeEventListener = removeEventSpy;
  });

  afterEach(() => {
    // Don't delete globalThis.window — tests need it
  });

  it('returns a cleanup function', () => {
    const cleanup = initScrollDepthTracking();
    expect(typeof cleanup).toBe('function');
  });

  it('adds a scroll event listener', () => {
    initScrollDepthTracking();
    expect(addEventSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });
  });

  it('cleanup removes the scroll listener', () => {
    const cleanup = initScrollDepthTracking();
    cleanup();
    expect(removeEventSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('fires scroll_depth events at thresholds', async () => {
    initScrollDepthTracking();
    const scrollHandler = addEventSpy.mock.calls[0][0] === 'scroll'
      ? addEventSpy.mock.calls[0][1]
      : null;
    expect(scrollHandler).toBeTruthy();

    // Simulate 50% scroll (scrollY=750 out of 1500 scrollable)
    globalThis.window.scrollY = 750;
    scrollHandler();

    // Wait for async trackEvent call
    await new Promise(r => setTimeout(r, 10));

    // Should fire 25% and 50% thresholds
    expect(mockTrackEvent).toHaveBeenCalledWith('CustomEvent', expect.objectContaining({
      event: 'scroll_depth',
      percent_scrolled: 25,
    }));
    expect(mockTrackEvent).toHaveBeenCalledWith('CustomEvent', expect.objectContaining({
      event: 'scroll_depth',
      percent_scrolled: 50,
    }));
  });

  it('does not fire same threshold twice', async () => {
    initScrollDepthTracking();
    const scrollHandler = addEventSpy.mock.calls[0][1];

    // Scroll to 30% twice
    globalThis.window.scrollY = 450;
    scrollHandler();
    await new Promise(r => setTimeout(r, 10));

    const callCount1 = mockTrackEvent.mock.calls.filter(
      c => c[1]?.percent_scrolled === 25
    ).length;

    scrollHandler();
    await new Promise(r => setTimeout(r, 10));

    const callCount2 = mockTrackEvent.mock.calls.filter(
      c => c[1]?.percent_scrolled === 25
    ).length;

    expect(callCount2).toBe(callCount1); // Same — no duplicate
  });

  it('fires 100% threshold at full scroll', async () => {
    initScrollDepthTracking();
    const scrollHandler = addEventSpy.mock.calls[0][1];

    // Scroll to 100%
    globalThis.window.scrollY = 1500;
    scrollHandler();
    await new Promise(r => setTimeout(r, 10));

    expect(mockTrackEvent).toHaveBeenCalledWith('CustomEvent', expect.objectContaining({
      event: 'scroll_depth',
      percent_scrolled: 100,
    }));
  });

  it('handles zero document height gracefully', () => {
    globalThis.document.documentElement.scrollHeight = 500;
    globalThis.document.documentElement.clientHeight = 500;

    initScrollDepthTracking();
    const scrollHandler = addEventSpy.mock.calls[0][1];

    // Should not throw — docHeight is 0
    scrollHandler();
    expect(mockTrackEvent).not.toHaveBeenCalled();
  });
});
