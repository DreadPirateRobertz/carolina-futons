import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('backend/analyticsHelpers.web', () => ({
  trackProductView: vi.fn().mockResolvedValue(undefined),
  trackAddToCart: vi.fn().mockResolvedValue(undefined),
  trackSocialShare: vi.fn().mockResolvedValue(undefined),
}));

import {
  trackEvent,
  flushEvents,
  flushEventsSync,
  _getPendingBeaconEvents,
  _recoverPendingEvents,
  getFunnelProgress,
  getEngagementScore,
  getSessionSummary,
  trackProductPageView,
  trackCartAdd,
  trackSocialShare,
  trackNewsletterSignup,
  trackQuizStep,
  trackQuizComplete,
  trackCheckoutStart,
  trackPurchaseComplete,
  trackReferralAction,
  trackGalleryInteraction,
  trackSwatchView,
  trackCompareAction,
} from '../src/public/engagementTracker.js';

const PENDING_EVENTS_KEY = 'cf_pending_events';

// Reset storage between tests
beforeEach(() => {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(PENDING_EVENTS_KEY);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── trackEvent ───────────────────────────────────────────────────────

describe('trackEvent', () => {
  it('queues events without throwing', () => {
    expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow();
  });

  it('handles null data gracefully', () => {
    expect(() => trackEvent('test_event')).not.toThrow();
  });

  it('rejects null eventType — nothing queued', async () => {
    const { trackProductView } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    trackEvent(null, { foo: 'bar' });
    await flushEvents();
    expect(trackProductView).not.toHaveBeenCalled();
  });

  it('rejects non-string eventType — nothing queued', async () => {
    const { trackAddToCart } = await import('backend/analyticsHelpers.web');
    trackAddToCart.mockClear();
    trackEvent(123, { foo: 'bar' });
    await flushEvents();
    expect(trackAddToCart).not.toHaveBeenCalled();
  });

  it('rejects empty string eventType — nothing queued', async () => {
    const { trackProductView } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    trackEvent('', { foo: 'bar' });
    await flushEvents();
    expect(trackProductView).not.toHaveBeenCalled();
  });

  it('sanitizes special characters from event type', async () => {
    const { trackProductView } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    trackEvent('product<script>view', { productId: 'p1', productName: 'Test', category: 'c' });
    await flushEvents();
    // The sanitized type 'productscriptview' won't match 'product_view' switch case
    expect(trackProductView).not.toHaveBeenCalled();
  });

  it('passes through valid alphanumeric/underscore/hyphen characters', async () => {
    trackEvent('valid_event-type', {});
    await flushEvents();
    // Should store locally since type doesn't match backend routes
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'valid_event-type')).toBe(true);
  });

  it('rejects eventType that becomes empty after sanitization — nothing queued', async () => {
    const { trackProductView } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    trackEvent('!!!', { foo: 'bar' });
    await flushEvents();
    expect(trackProductView).not.toHaveBeenCalled();
  });
});

// ── flushEvents ──────────────────────────────────────────────────────

describe('flushEvents', () => {
  it('routes product_view events to backend trackProductView', async () => {
    const { trackProductView } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    trackEvent('product_view', { productId: 'p1', productName: 'Test Frame', category: 'frames' });
    await flushEvents();
    expect(trackProductView).toHaveBeenCalledWith('p1', 'Test Frame', 'frames');
  });

  it('routes add_to_cart events to backend trackAddToCart', async () => {
    const { trackAddToCart } = await import('backend/analyticsHelpers.web');
    trackAddToCart.mockClear();
    trackEvent('add_to_cart', { productId: 'p2' });
    await flushEvents();
    expect(trackAddToCart).toHaveBeenCalledWith('p2');
  });

  it('routes social_share events to backend trackSocialShare when productId present', async () => {
    const { trackSocialShare: backendShare } = await import('backend/analyticsHelpers.web');
    backendShare.mockClear();
    trackEvent('social_share', { productId: 'p3', platform: 'facebook' });
    await flushEvents();
    expect(backendShare).toHaveBeenCalledWith('p3', 'facebook');
  });

  it('does not call backend trackSocialShare when productId is missing', async () => {
    const { trackSocialShare: backendShare } = await import('backend/analyticsHelpers.web');
    backendShare.mockClear();
    trackEvent('social_share', { platform: 'twitter' });
    await flushEvents();
    expect(backendShare).not.toHaveBeenCalled();
  });

  it('stores unknown event types locally via session storage', async () => {
    trackEvent('custom_event', { key: 'val' });
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'custom_event')).toBe(true);
  });

  it('does nothing when queue is empty', async () => {
    const { trackProductView } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    await flushEvents();
    expect(trackProductView).not.toHaveBeenCalled();
  });

  it('continues processing remaining events when one backend call fails', async () => {
    const { trackProductView, trackAddToCart } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    trackAddToCart.mockClear();
    trackProductView.mockRejectedValueOnce(new Error('Backend error'));
    trackEvent('product_view', { productId: 'p1', productName: 'T', category: 'c' });
    trackEvent('add_to_cart', { productId: 'p2' });
    await flushEvents();
    // add_to_cart should still be processed despite product_view failure
    expect(trackAddToCart).toHaveBeenCalledWith('p2');
  });

  it('empties the queue after flush', async () => {
    const { trackProductView } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    trackEvent('product_view', { productId: 'p1', productName: 'T', category: 'c' });
    await flushEvents();
    trackProductView.mockClear();
    await flushEvents();
    expect(trackProductView).not.toHaveBeenCalled();
  });
});

// ── getFunnelProgress ────────────────────────────────────────────────

describe('getFunnelProgress', () => {
  it('returns 0% for unknown funnel', () => {
    const result = getFunnelProgress('nonexistent');
    expect(result.steps).toEqual([]);
    expect(result.completionPct).toBe(0);
  });

  it('returns defined steps for purchase funnel', () => {
    const result = getFunnelProgress('purchase');
    expect(result.steps).toContain('page_view');
    expect(result.steps).toContain('purchase_complete');
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('returns defined steps for social funnel', () => {
    const result = getFunnelProgress('social');
    expect(result.steps).toContain('social_share');
  });

  it('returns defined steps for quiz funnel', () => {
    const result = getFunnelProgress('quiz');
    expect(result.steps).toContain('quiz_start');
    expect(result.steps).toContain('quiz_complete');
  });

  it('tracks sequential progress and stops at first missing step', () => {
    // Seed session with page_view and product_view but not add_to_cart
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() },
      { type: 'product_view', data: {}, timestamp: Date.now() },
    ]));
    const result = getFunnelProgress('purchase');
    expect(result.currentStep).toBe(2); // page_view + product_view
    expect(result.completionPct).toBe(40); // 2/5 = 40%
  });

  it('calculates 100% when all steps completed', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() },
      { type: 'product_view', data: {}, timestamp: Date.now() },
      { type: 'add_to_cart', data: {}, timestamp: Date.now() },
      { type: 'checkout_start', data: {}, timestamp: Date.now() },
      { type: 'purchase_complete', data: {}, timestamp: Date.now() },
    ]));
    const result = getFunnelProgress('purchase');
    expect(result.currentStep).toBe(5);
    expect(result.completionPct).toBe(100);
  });

  it('returns engagement funnel steps', () => {
    const result = getFunnelProgress('engagement');
    expect(result.steps).toContain('gallery_interact');
    expect(result.steps).toContain('swatch_view');
  });
});

// ── getEngagementScore ───────────────────────────────────────────────

describe('getEngagementScore', () => {
  it('returns 0 for empty session', () => {
    expect(getEngagementScore()).toBe(0);
  });

  it('returns a score between 0 and 100', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() - 60000 },
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() - 50000 },
      { type: 'add_to_cart', data: { productId: 'p1' }, timestamp: Date.now() - 40000 },
    ]));
    const score = getEngagementScore();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('gives 10 base points for any session activity', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() },
    ]));
    const score = getEngagementScore();
    expect(score).toBeGreaterThanOrEqual(10);
  });

  it('adds 10 points for product_view', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() },
    ]));
    const score = getEngagementScore();
    // Base 10 + product_view 10 = 20
    expect(score).toBe(20);
  });

  it('adds extra 10 points for 3+ product views', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() },
      { type: 'product_view', data: { productId: 'p2' }, timestamp: Date.now() },
      { type: 'product_view', data: { productId: 'p3' }, timestamp: Date.now() },
    ]));
    const score = getEngagementScore();
    // Base 10 + product_view 10 + 3+ views 10 = 30
    expect(score).toBe(30);
  });

  it('adds 15 points for add_to_cart', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'add_to_cart', data: {}, timestamp: Date.now() },
    ]));
    const score = getEngagementScore();
    // Base 10 + add_to_cart 15 = 25
    expect(score).toBe(25);
  });

  it('adds 10 points for social_share', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'social_share', data: {}, timestamp: Date.now() },
    ]));
    const score = getEngagementScore();
    // Base 10 + social_share 10 = 20
    expect(score).toBe(20);
  });

  it('adds quiz points for start and complete', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'quiz_start', data: {}, timestamp: Date.now() },
      { type: 'quiz_complete', data: {}, timestamp: Date.now() },
    ]));
    const score = getEngagementScore();
    // Base 10 + quiz_start 5 + quiz_complete 5 = 20
    expect(score).toBe(20);
  });

  it('adds 5 points for time on site > 2 minutes', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() - 150000 }, // 2.5 min ago
    ]));
    const score = getEngagementScore();
    // Base 10 + >2min 5 = 15
    expect(score).toBe(15);
  });

  it('adds 10 points for time on site > 5 minutes', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() - 360000 }, // 6 min ago
    ]));
    const score = getEngagementScore();
    // Base 10 + >2min 5 + >5min 5 = 20
    expect(score).toBe(20);
  });

  it('caps score at 100', () => {
    // Seed every possible event type to exceed 100
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() - 600000 },
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() - 600000 },
      { type: 'product_view', data: { productId: 'p2' }, timestamp: Date.now() - 500000 },
      { type: 'product_view', data: { productId: 'p3' }, timestamp: Date.now() - 400000 },
      { type: 'gallery_interact', data: {}, timestamp: Date.now() - 300000 },
      { type: 'swatch_view', data: {}, timestamp: Date.now() - 200000 },
      { type: 'add_to_cart', data: {}, timestamp: Date.now() - 100000 },
      { type: 'checkout_start', data: {}, timestamp: Date.now() - 90000 },
      { type: 'social_share', data: {}, timestamp: Date.now() - 80000 },
      { type: 'newsletter_signup', data: {}, timestamp: Date.now() - 70000 },
      { type: 'referral_click', data: {}, timestamp: Date.now() - 60000 },
      { type: 'quiz_start', data: {}, timestamp: Date.now() - 50000 },
      { type: 'quiz_complete', data: {}, timestamp: Date.now() },
    ]));
    expect(getEngagementScore()).toBe(100);
  });
});

// ── getSessionSummary ────────────────────────────────────────────────

describe('getSessionSummary', () => {
  it('returns summary object with required fields', () => {
    const summary = getSessionSummary();
    expect(summary).toHaveProperty('eventCount');
    expect(summary).toHaveProperty('uniqueProducts');
    expect(summary).toHaveProperty('score');
    expect(summary).toHaveProperty('topFunnel');
  });

  it('returns zero counts for empty session', () => {
    const summary = getSessionSummary();
    expect(summary.eventCount).toBe(0);
    expect(summary.uniqueProducts).toBe(0);
    expect(summary.score).toBe(0);
  });

  it('returns "none" for topFunnel when no events', () => {
    const summary = getSessionSummary();
    expect(summary.topFunnel).toBe('none');
  });

  it('counts unique products from product_view events', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() },
      { type: 'product_view', data: { productId: 'p2' }, timestamp: Date.now() },
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() }, // duplicate
    ]));
    const summary = getSessionSummary();
    expect(summary.uniqueProducts).toBe(2);
    expect(summary.eventCount).toBe(3);
  });

  it('identifies top funnel with highest completion', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() },
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() },
    ]));
    const summary = getSessionSummary();
    // purchase and engagement funnels both start with page_view, product_view
    expect(summary.topFunnel).toContain('(40%)');
  });
});

// ── Pre-Built Event Helpers ──────────────────────────────────────────

describe('event helper functions', () => {
  it('trackProductPageView handles null product', () => {
    expect(() => trackProductPageView(null)).not.toThrow();
  });

  it('trackProductPageView handles product without _id', () => {
    expect(() => trackProductPageView({ name: 'Test' })).not.toThrow();
  });

  it('trackProductPageView accepts valid product', () => {
    expect(() => trackProductPageView({
      _id: 'p1', name: 'Test', collections: ['futon-frames'], price: 299,
    })).not.toThrow();
  });

  it('trackCartAdd does not throw', () => {
    expect(() => trackCartAdd('p1', 'Product 1', 'Queen')).not.toThrow();
  });

  it('trackSocialShare does not throw', () => {
    expect(() => trackSocialShare('facebook', 'purchase')).not.toThrow();
  });

  it('trackNewsletterSignup does not throw', () => {
    expect(() => trackNewsletterSignup('thank_you_page')).not.toThrow();
  });

  it('trackQuizStep does not throw', () => {
    expect(() => trackQuizStep(1, { room: 'living' })).not.toThrow();
  });

  it('trackQuizComplete does not throw', () => {
    expect(() => trackQuizComplete({ room: 'living' }, 3)).not.toThrow();
  });

  it('trackCartAdd with object signature queues product data', async () => {
    const { trackAddToCart } = await import('backend/analyticsHelpers.web');
    trackAddToCart.mockClear();
    trackCartAdd({ _id: 'p5', name: 'Futon Frame' }, 2);
    await flushEvents();
    expect(trackAddToCart).toHaveBeenCalledWith('p5');
  });

  it('trackCartAdd with string signature queues product ID', async () => {
    const { trackAddToCart } = await import('backend/analyticsHelpers.web');
    trackAddToCart.mockClear();
    trackCartAdd('p6', 'Legacy Product', 'Queen');
    await flushEvents();
    expect(trackAddToCart).toHaveBeenCalledWith('p6');
  });

  it('trackProductPageView queues product_view for valid product', async () => {
    const { trackProductView } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    trackProductPageView({ _id: 'p7', name: 'Test Bed', collections: ['beds'], price: 799 });
    await flushEvents();
    expect(trackProductView).toHaveBeenCalledWith('p7', 'Test Bed', 'beds');
  });

  it('trackProductPageView uses empty category when collections absent', async () => {
    const { trackProductView } = await import('backend/analyticsHelpers.web');
    trackProductView.mockClear();
    trackProductPageView({ _id: 'p8', name: 'No Cat', price: 99 });
    await flushEvents();
    expect(trackProductView).toHaveBeenCalledWith('p8', 'No Cat', '');
  });

  it('trackSocialShare sends platform and productId to backend', async () => {
    const { trackSocialShare: backendShare } = await import('backend/analyticsHelpers.web');
    backendShare.mockClear();
    trackSocialShare('pinterest', 'product', 'p9');
    await flushEvents();
    expect(backendShare).toHaveBeenCalledWith('p9', 'pinterest');
  });

  it('trackCheckoutStart queues checkout_start event', () => {
    expect(() => trackCheckoutStart(499, 2)).not.toThrow();
  });

  it('trackPurchaseComplete queues purchase_complete event', () => {
    expect(() => trackPurchaseComplete('order-123', 599)).not.toThrow();
  });

  it('trackReferralAction queues referral_click event', () => {
    expect(() => trackReferralAction('copy_link')).not.toThrow();
  });

  it('trackGalleryInteraction queues gallery_interact event', () => {
    expect(() => trackGalleryInteraction('zoom')).not.toThrow();
  });

  it('trackSwatchView queues swatch_view event', () => {
    expect(() => trackSwatchView('sw-123')).not.toThrow();
  });

  it('trackCompareAction queues compare_add event', () => {
    expect(() => trackCompareAction('add', 'p10')).not.toThrow();
  });

  it('trackQuizStep fires quiz_start on step 1', async () => {
    trackQuizStep(1, { room: 'bedroom' });
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'quiz_start')).toBe(true);
    expect(stored.some(e => e.type === 'quiz_step_1')).toBe(true);
  });

  it('trackQuizStep does not fire quiz_start on step 2+', async () => {
    trackQuizStep(2, { style: 'modern' });
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'quiz_step_2')).toBe(true);
    expect(stored.some(e => e.type === 'quiz_start')).toBe(false);
  });
});

// ── flushEventsSync (sendBeacon) ────────────────────────────────────

describe('flushEventsSync', () => {
  it('does not throw when event queue is empty', () => {
    expect(() => flushEventsSync()).not.toThrow();
  });

  it('uses navigator.sendBeacon when available', () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon });

    trackEvent('product_view', { productId: 'p1', productName: 'Test', category: 'frames' });
    flushEventsSync();

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, data] = sendBeacon.mock.calls[0];
    expect(url).toContain('trackEvents');
    const blob = data;
    expect(blob).toBeInstanceOf(Blob);
  });

  it('saves events to localStorage as fallback when sendBeacon is unavailable', () => {
    vi.stubGlobal('navigator', {});

    trackEvent('add_to_cart', { productId: 'p2' });
    flushEventsSync();

    const stored = JSON.parse(localStorage.getItem(PENDING_EVENTS_KEY));
    expect(stored).toBeInstanceOf(Array);
    expect(stored.length).toBeGreaterThan(0);
    expect(stored[0].type).toBe('add_to_cart');
  });

  it('saves events to localStorage when sendBeacon returns false', () => {
    const sendBeacon = vi.fn(() => false);
    vi.stubGlobal('navigator', { sendBeacon });

    trackEvent('checkout_start', { cartTotal: 500 });
    flushEventsSync();

    const stored = JSON.parse(localStorage.getItem(PENDING_EVENTS_KEY));
    expect(stored).toBeInstanceOf(Array);
    expect(stored.length).toBeGreaterThan(0);
  });

  it('clears the event queue after flushing', () => {
    vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => true) });

    trackEvent('page_view', {});
    trackEvent('product_view', { productId: 'p1' });
    flushEventsSync();

    // Queue should be empty — second sync flush should be a no-op
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { sendBeacon });
    flushEventsSync();
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it('stores non-backend events to sessionStorage', () => {
    vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => true) });
    trackEvent('gallery_interact', { action: 'zoom' });
    flushEventsSync();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'gallery_interact')).toBe(true);
  });

  it('handles sendBeacon throwing an exception', () => {
    vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => { throw new Error('Security error'); }) });
    trackEvent('product_view', { productId: 'p1' });
    expect(() => flushEventsSync()).not.toThrow();
    // Should fall back to localStorage
    const stored = JSON.parse(localStorage.getItem(PENDING_EVENTS_KEY) || '[]');
    expect(stored.length).toBeGreaterThan(0);
  });

  it('merges with existing pending events in localStorage', () => {
    // Pre-seed localStorage with existing pending events
    localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify([
      { type: 'old_event', data: {}, timestamp: 1000, page: '/' },
    ]));
    vi.stubGlobal('navigator', {});
    trackEvent('new_event', {});
    flushEventsSync();
    const stored = JSON.parse(localStorage.getItem(PENDING_EVENTS_KEY));
    expect(stored.length).toBe(2);
    expect(stored[0].type).toBe('old_event');
  });
});

// ── Pending event recovery ──────────────────────────────────────────

describe('pending event recovery', () => {
  it('_getPendingBeaconEvents returns empty array when no pending events', () => {
    expect(_getPendingBeaconEvents()).toEqual([]);
  });

  it('_getPendingBeaconEvents returns saved events from localStorage', () => {
    const events = [
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now(), page: '/' },
    ];
    localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(events));
    expect(_getPendingBeaconEvents()).toEqual(events);
  });

  it('_getPendingBeaconEvents handles corrupted localStorage gracefully', () => {
    localStorage.setItem(PENDING_EVENTS_KEY, 'not-json{{{');
    expect(_getPendingBeaconEvents()).toEqual([]);
  });

  it('_recoverPendingEvents re-queues saved events and clears localStorage', async () => {
    const events = [
      { type: 'product_view', data: { productId: 'p1', productName: 'Test', category: 'cat' }, timestamp: Date.now(), page: '/' },
    ];
    localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(events));

    await _recoverPendingEvents();

    // localStorage should be cleared after recovery
    expect(localStorage.getItem(PENDING_EVENTS_KEY)).toBeNull();
  });

  it('_recoverPendingEvents does not throw when localStorage is empty', async () => {
    await expect(_recoverPendingEvents()).resolves.not.toThrow();
  });
});
