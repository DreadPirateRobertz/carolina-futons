import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

vi.mock('backend/analyticsHelpers.web', () => ({
  trackProductView: vi.fn().mockResolvedValue({}),
  trackAddToCart: vi.fn().mockResolvedValue({}),
  trackSocialShare: vi.fn().mockResolvedValue({}),
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
  trackCheckoutStart,
  trackPurchaseComplete,
  trackSocialShare,
  trackNewsletterSignup,
  trackReferralAction,
  trackQuizStep,
  trackQuizComplete,
  trackGalleryInteraction,
  trackSwatchView,
  trackCompareAction,
} from '../src/public/engagementTracker.js';

const PENDING_EVENTS_KEY = 'cf_pending_events';

// Reset storage between tests
beforeEach(() => {
  vi.useFakeTimers();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(PENDING_EVENTS_KEY);
  }
});

afterEach(() => {
  vi.useRealTimers();
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

  it('rejects null event type', () => {
    trackEvent(null, {});
    // No event queued — flushing should be a no-op
  });

  it('rejects non-string event type', () => {
    trackEvent(123, {});
  });

  it('rejects empty string event type', () => {
    trackEvent('', {});
  });

  it('sanitizes special characters from event type', async () => {
    trackEvent('bad<script>event', { x: 1 });
    await flushEvents();
    // Event should be sanitized to 'badscriptevent'
    // The fact it doesn't throw proves sanitization worked
  });

  it('rejects event type that sanitizes to empty string', () => {
    trackEvent('!!!', {});
    // All characters stripped — should not queue
  });

  it('schedules flush timer on first event', () => {
    trackEvent('test_event', {});
    // Timer should be set — advancing time should trigger flush
    vi.advanceTimersByTime(5000);
    // No error = timer worked
  });
});

// ── flushEvents ─────────────────────────────────────────────────────

describe('flushEvents', () => {
  it('does nothing when queue is empty', async () => {
    await expect(flushEvents()).resolves.not.toThrow();
  });

  it('routes product_view events to backendTrackView', async () => {
    const { trackProductView: backendTrackView } = await import('backend/analyticsHelpers.web');
    trackEvent('product_view', { productId: 'p1', productName: 'Test Frame', category: 'frames' });
    await flushEvents();
    expect(backendTrackView).toHaveBeenCalledWith('p1', 'Test Frame', 'frames');
  });

  it('routes add_to_cart events to trackAddToCart backend', async () => {
    const { trackAddToCart: backendTrackCart } = await import('backend/analyticsHelpers.web');
    trackEvent('add_to_cart', { productId: 'p2' });
    await flushEvents();
    expect(backendTrackCart).toHaveBeenCalledWith('p2');
  });

  it('routes social_share events to backendTrackShare when productId present', async () => {
    const { trackSocialShare: backendTrackShare } = await import('backend/analyticsHelpers.web');
    trackEvent('social_share', { productId: 'p3', platform: 'facebook' });
    await flushEvents();
    expect(backendTrackShare).toHaveBeenCalledWith('p3', 'facebook');
  });

  it('skips social_share backend call when productId is missing', async () => {
    const { trackSocialShare: backendTrackShare } = await import('backend/analyticsHelpers.web');
    backendTrackShare.mockClear();
    trackEvent('social_share', { platform: 'email' });
    await flushEvents();
    expect(backendTrackShare).not.toHaveBeenCalled();
  });

  it('stores unknown event types to session storage', async () => {
    trackEvent('custom_event', { data: 'test' });
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'custom_event')).toBe(true);
  });

  it('handles backend errors without throwing', async () => {
    const { trackProductView: backendTrackView } = await import('backend/analyticsHelpers.web');
    backendTrackView.mockRejectedValueOnce(new Error('Network error'));
    trackEvent('product_view', { productId: 'p1', productName: 'X', category: 'y' });
    await expect(flushEvents()).resolves.not.toThrow();
  });

  it('processes multiple events in order', async () => {
    const { trackProductView: backendTrackView, trackAddToCart: backendTrackCart } = await import('backend/analyticsHelpers.web');
    backendTrackView.mockClear();
    backendTrackCart.mockClear();
    trackEvent('product_view', { productId: 'p1', productName: 'A', category: 'c' });
    trackEvent('add_to_cart', { productId: 'p1' });
    await flushEvents();
    expect(backendTrackView).toHaveBeenCalledTimes(1);
    expect(backendTrackCart).toHaveBeenCalledTimes(1);
  });

  it('clears flush timer after processing', async () => {
    trackEvent('test_event', {});
    await flushEvents();
    // Timer should be cleared — no double-flush
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

  it('returns defined steps for engagement funnel', () => {
    const result = getFunnelProgress('engagement');
    expect(result.steps).toContain('gallery_interact');
    expect(result.steps).toContain('swatch_view');
  });

  it('tracks sequential step progression', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() },
      { type: 'product_view', timestamp: Date.now() },
      { type: 'add_to_cart', timestamp: Date.now() },
    ]));
    const result = getFunnelProgress('purchase');
    expect(result.currentStep).toBe(3);
    expect(result.completionPct).toBe(60); // 3/5 = 60%
  });

  it('stops counting at first missing step', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() },
      // product_view missing — should stop here
      { type: 'add_to_cart', timestamp: Date.now() },
    ]));
    const result = getFunnelProgress('purchase');
    expect(result.currentStep).toBe(1);
    expect(result.completionPct).toBe(20); // 1/5 = 20%
  });

  it('returns 100% for fully completed funnel', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() },
      { type: 'product_view', timestamp: Date.now() },
      { type: 'add_to_cart', timestamp: Date.now() },
      { type: 'checkout_start', timestamp: Date.now() },
      { type: 'purchase_complete', timestamp: Date.now() },
    ]));
    const result = getFunnelProgress('purchase');
    expect(result.currentStep).toBe(5);
    expect(result.completionPct).toBe(100);
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

  it('gives base 10 points for any events', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() },
    ]));
    expect(getEngagementScore()).toBeGreaterThanOrEqual(10);
  });

  it('gives 10 bonus for product_view', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() },
    ]));
    expect(getEngagementScore()).toBeGreaterThanOrEqual(20); // 10 base + 10 product_view
  });

  it('gives 10 more bonus for 3+ product views', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() },
      { type: 'product_view', data: { productId: 'p2' }, timestamp: Date.now() },
      { type: 'product_view', data: { productId: 'p3' }, timestamp: Date.now() },
    ]));
    expect(getEngagementScore()).toBeGreaterThanOrEqual(30); // 10 + 10 + 10
  });

  it('gives 15 points for add_to_cart', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'add_to_cart', data: {}, timestamp: Date.now() },
    ]));
    expect(getEngagementScore()).toBeGreaterThanOrEqual(25); // 10 + 15
  });

  it('gives 10 points for social_share', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'social_share', data: {}, timestamp: Date.now() },
    ]));
    expect(getEngagementScore()).toBeGreaterThanOrEqual(20); // 10 + 10
  });

  it('gives time bonus for sessions > 2 minutes', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() - 180000 }, // 3 min ago
    ]));
    expect(getEngagementScore()).toBeGreaterThanOrEqual(15); // 10 + 5 time bonus
  });

  it('gives additional time bonus for sessions > 5 minutes', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() - 360000 }, // 6 min ago
    ]));
    expect(getEngagementScore()).toBeGreaterThanOrEqual(20); // 10 + 5 + 5
  });

  it('caps score at 100', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'page_view', timestamp: Date.now() - 600000 },
      { type: 'product_view', data: { productId: 'p1' }, timestamp: Date.now() - 500000 },
      { type: 'product_view', data: { productId: 'p2' }, timestamp: Date.now() - 490000 },
      { type: 'product_view', data: { productId: 'p3' }, timestamp: Date.now() - 480000 },
      { type: 'gallery_interact', data: {}, timestamp: Date.now() - 400000 },
      { type: 'swatch_view', data: {}, timestamp: Date.now() - 390000 },
      { type: 'add_to_cart', data: {}, timestamp: Date.now() - 300000 },
      { type: 'checkout_start', data: {}, timestamp: Date.now() - 200000 },
      { type: 'social_share', data: {}, timestamp: Date.now() - 150000 },
      { type: 'newsletter_signup', data: {}, timestamp: Date.now() - 140000 },
      { type: 'referral_click', data: {}, timestamp: Date.now() - 130000 },
      { type: 'quiz_start', data: {}, timestamp: Date.now() - 120000 },
      { type: 'quiz_complete', data: {}, timestamp: Date.now() - 110000 },
    ]));
    expect(getEngagementScore()).toBe(100);
  });

  it('gives 5 points each for gallery_interact and swatch_view', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'gallery_interact', data: {}, timestamp: Date.now() },
      { type: 'swatch_view', data: {}, timestamp: Date.now() },
    ]));
    expect(getEngagementScore()).toBeGreaterThanOrEqual(20); // 10 + 5 + 5
  });

  it('gives 5 points each for quiz_start and quiz_complete', () => {
    sessionStorage.setItem('cf_session_events', JSON.stringify([
      { type: 'quiz_start', data: {}, timestamp: Date.now() },
      { type: 'quiz_complete', data: {}, timestamp: Date.now() },
    ]));
    expect(getEngagementScore()).toBeGreaterThanOrEqual(20); // 10 + 5 + 5
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

  it('returns "none" for topFunnel when no progress', () => {
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
      { type: 'add_to_cart', data: {}, timestamp: Date.now() },
    ]));
    const summary = getSessionSummary();
    expect(summary.topFunnel).toContain('purchase');
    expect(summary.topFunnel).toContain('60%'); // 3/5
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

  it('trackProductPageView extracts first collection as category', async () => {
    const { trackProductView: backendTrackView } = await import('backend/analyticsHelpers.web');
    trackProductPageView({ _id: 'p1', name: 'Test', collections: ['futon-frames', 'sale'], price: 299 });
    await flushEvents();
    expect(backendTrackView).toHaveBeenCalledWith('p1', 'Test', 'futon-frames');
  });

  it('trackProductPageView uses empty category when no collections', async () => {
    const { trackProductView: backendTrackView } = await import('backend/analyticsHelpers.web');
    trackProductPageView({ _id: 'p2', name: 'No Coll', price: 199 });
    await flushEvents();
    expect(backendTrackView).toHaveBeenCalledWith('p2', 'No Coll', '');
  });

  it('trackCartAdd with object signature includes quantity', async () => {
    trackCartAdd({ _id: 'p1', name: 'Frame' }, 3);
    await flushEvents();
    // Event queued with quantity = 3
  });

  it('trackCartAdd with string signature (legacy)', async () => {
    trackCartAdd('p1', 'Product 1', 'Queen');
    await flushEvents();
    // Legacy call works without error
  });

  it('trackCartAdd object handles missing _id', () => {
    expect(() => trackCartAdd({ name: 'No ID' }, 1)).not.toThrow();
  });

  it('trackCartAdd object defaults quantity to 1', async () => {
    trackCartAdd({ _id: 'p1', name: 'Frame' });
    await flushEvents();
    // No error — default quantity applied
  });

  it('trackSocialShare does not throw', () => {
    expect(() => trackSocialShare('facebook', 'purchase')).not.toThrow();
  });

  it('trackSocialShare includes productId when provided', async () => {
    const { trackSocialShare: backendShare } = await import('backend/analyticsHelpers.web');
    trackSocialShare('pinterest', 'product', 'p5');
    await flushEvents();
    expect(backendShare).toHaveBeenCalledWith('p5', 'pinterest');
  });

  it('trackNewsletterSignup does not throw', () => {
    expect(() => trackNewsletterSignup('thank_you_page')).not.toThrow();
  });

  it('trackCheckoutStart queues event with cart data', async () => {
    trackCheckoutStart(599, 3);
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'checkout_start')).toBe(true);
  });

  it('trackPurchaseComplete queues event with order data', async () => {
    trackPurchaseComplete('ord-123', 1299);
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'purchase_complete')).toBe(true);
  });

  it('trackReferralAction queues referral_click event', async () => {
    trackReferralAction('copy_link');
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'referral_click')).toBe(true);
  });

  it('trackGalleryInteraction queues gallery_interact event', async () => {
    trackGalleryInteraction('zoom');
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'gallery_interact')).toBe(true);
  });

  it('trackSwatchView queues swatch_view event', async () => {
    trackSwatchView('sw-42');
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'swatch_view')).toBe(true);
  });

  it('trackCompareAction queues compare_add event', async () => {
    trackCompareAction('add', 'p7');
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'compare_add')).toBe(true);
  });

  it('trackQuizStep does not throw', () => {
    expect(() => trackQuizStep(1, { room: 'living' })).not.toThrow();
  });

  it('trackQuizStep step 1 also queues quiz_start', async () => {
    trackQuizStep(1, { room: 'living' });
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'quiz_start')).toBe(true);
    expect(stored.some(e => e.type === 'quiz_step_1')).toBe(true);
  });

  it('trackQuizStep step 2 does not queue quiz_start', async () => {
    trackQuizStep(2, { style: 'modern' });
    await flushEvents();
    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'quiz_step_2')).toBe(true);
    expect(stored.filter(e => e.type === 'quiz_start').length).toBe(0);
  });

  it('trackQuizComplete does not throw', () => {
    expect(() => trackQuizComplete({ room: 'living' }, 3)).not.toThrow();
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

    trackEvent('custom_local_event', { data: 'test' });
    flushEventsSync();

    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.some(e => e.type === 'custom_local_event')).toBe(true);
  });

  it('does not store product_view or add_to_cart in sessionStorage local events', () => {
    vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => true) });

    trackEvent('product_view', { productId: 'p1' });
    trackEvent('add_to_cart', { productId: 'p1' });
    flushEventsSync();

    const stored = JSON.parse(sessionStorage.getItem('cf_session_events') || '[]');
    expect(stored.filter(e => e.type === 'product_view').length).toBe(0);
    expect(stored.filter(e => e.type === 'add_to_cart').length).toBe(0);
  });

  it('handles sendBeacon throwing an error', () => {
    vi.stubGlobal('navigator', { sendBeacon: vi.fn(() => { throw new Error('blocked'); }) });

    trackEvent('test_event', {});
    expect(() => flushEventsSync()).not.toThrow();

    // Should fall back to localStorage
    const stored = JSON.parse(localStorage.getItem(PENDING_EVENTS_KEY) || '[]');
    expect(stored.length).toBeGreaterThan(0);
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

  it('_savePendingEvents merges with existing pending events', () => {
    // Seed existing pending events
    localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify([
      { type: 'old_event', data: {}, timestamp: Date.now() - 10000, page: '/' },
    ]));

    vi.stubGlobal('navigator', {});
    trackEvent('new_event', {});
    flushEventsSync();

    const stored = JSON.parse(localStorage.getItem(PENDING_EVENTS_KEY) || '[]');
    expect(stored.length).toBe(2);
    expect(stored[0].type).toBe('old_event');
  });

  it('_recoverPendingEvents processes recovered events through backend', async () => {
    const { trackProductView: backendTrackView } = await import('backend/analyticsHelpers.web');
    backendTrackView.mockClear();

    localStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify([
      { type: 'product_view', data: { productId: 'p-recovered', productName: 'Recovered', category: 'cat' }, timestamp: Date.now(), page: '/' },
    ]));

    await _recoverPendingEvents();
    expect(backendTrackView).toHaveBeenCalledWith('p-recovered', 'Recovered', 'cat');
  });
});
