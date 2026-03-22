/**
 * @file browseAbandonmentEdgeCases.test.js
 * @description Edge case tests for browse abandonment tracking — timer boundaries
 * and mobile vs desktop exit detection.
 *
 * Focus areas (CF-mjvo):
 * - Exact 30s timer boundary: 29s=no trigger, 30s=trigger, 31s=trigger
 * - Mobile scroll-away vs desktop cursor-exit — both surfaces handled correctly
 * - Unsubscribed members never receive browse recovery emails (backend path)
 *
 * Public module: src/public/browseAbandonment.js (client-side 30s dwell guard)
 * Backend module: src/backend/browseAbandonment.web.js (session tracking + recovery)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Public (client-side) module
import {
  trackProductView,
  clearBrowseAbandonment,
  MIN_DWELL_MS,
  BROWSE_STORAGE_KEY,
} from '../src/public/browseAbandonment.js';

// Backend module
import {
  captureRemindMeRequest,
  triggerBrowseRecovery,
  trackBrowseSession,
  HIGH_INTENT_THRESHOLD_MS,
} from '../src/backend/browseAbandonment.web.js';

import { __reset, __seed } from 'wix-data';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage() {
  const store = {};
  return {
    getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}

// ── 30s timer — exact boundary (public module) ────────────────────────────────

describe('trackProductView — exact 30s boundary (29s=no trigger, 31s=trigger)', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = makeStorage();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('29 seconds (29000ms) → does NOT trigger storage', () => {
    trackProductView('prod-1', 'Futon Frame', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(29000);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  it('29999ms (1ms before threshold) → does NOT trigger storage', () => {
    trackProductView('prod-1', 'Futon Frame', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(29999);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  it('30 seconds (30000ms) → DOES trigger storage (exact boundary)', () => {
    trackProductView('prod-1', 'Futon Frame', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(30000);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).not.toBeNull();
  });

  it('30001ms (1ms after threshold) → triggers storage', () => {
    trackProductView('prod-1', 'Futon Frame', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(30001);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).not.toBeNull();
  });

  it('31 seconds (31000ms) → triggers storage', () => {
    trackProductView('prod-1', 'Futon Frame', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(31000);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).not.toBeNull();
  });

  it('stored product at exact 30s has correct productId', () => {
    trackProductView('exact-boundary-prod', 'Exact Boundary Futon', 'img.jpg', 599, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productId).toBe('exact-boundary-prod');
  });
});

// ── Mobile scroll vs desktop cursor exit ─────────────────────────────────────

describe('trackProductView — mobile scroll-away vs desktop cursor exit', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = makeStorage();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // Mobile exit: user scrolls away quickly (within first few seconds)
  it('mobile scroll-away at 5s — product NOT tracked (cancel before 30s threshold)', () => {
    const cancel = trackProductView('prod-mobile', 'Wall Hugger Frame', 'mobile.jpg', 299, { storage });
    vi.advanceTimersByTime(5000);  // user scrolls away after 5 seconds
    cancel();                       // simulates mobile scroll-away exit signal
    vi.advanceTimersByTime(30000); // timer has already been cancelled — nothing fires
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  // Desktop exit: cursor exits browser chrome at 28s
  it('desktop cursor exit at 28s — product NOT tracked (cancel before 30s threshold)', () => {
    const cancel = trackProductView('prod-desktop', 'Eureka Futon', 'desktop.jpg', 599, { storage });
    vi.advanceTimersByTime(28000); // user idles 28s then cursor exits chrome
    cancel();                       // simulates desktop cursor-exit detection
    vi.advanceTimersByTime(5000);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  // Mobile: user stays 30s+ without scrolling away — product IS tracked
  it('mobile dwell ≥ 30s (no scroll-away) — product IS tracked', () => {
    trackProductView('prod-mobile-dwell', 'Metal Frame', 'metal.jpg', 399, { storage });
    // No cancel — user stays engaged on the page
    vi.advanceTimersByTime(32000);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).not.toBeNull();
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productId).toBe('prod-mobile-dwell');
  });

  // Desktop: cursor exits AFTER 30s — product already stored, cancel is no-op
  it('desktop cursor exit after 30s dwell — product already stored (cancel is a no-op)', () => {
    const cancel = trackProductView('prod-desktop-late', 'Nordic Futon', 'nordic.jpg', 449, { storage });
    vi.advanceTimersByTime(30000); // timer fires, product stored
    cancel();                       // too late — data already committed to storage
    expect(storage.getItem(BROWSE_STORAGE_KEY)).not.toBeNull();
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productId).toBe('prod-desktop-late');
  });

  // Both exit types before threshold produce identical result: not tracked
  it('mobile (5s) and desktop (28s) early exits both result in product not tracked', () => {
    const mobileStorage = makeStorage();
    const desktopStorage = makeStorage();

    // Simulate mobile scenario
    const mobileCancel = trackProductView('prod-m', 'Futon A', 'a.jpg', 100, { storage: mobileStorage });
    vi.advanceTimersByTime(5000);
    mobileCancel();

    // Simulate desktop scenario (cancel fires at a different time)
    const desktopCancel = trackProductView('prod-d', 'Futon B', 'b.jpg', 200, { storage: desktopStorage });
    vi.advanceTimersByTime(28000);
    desktopCancel();

    vi.advanceTimersByTime(30000);

    expect(mobileStorage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
    expect(desktopStorage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  // clearBrowseAbandonment simulates "added to cart" (common on both mobile + desktop)
  it('clearBrowseAbandonment prevents storage regardless of platform', () => {
    trackProductView('prod-cart', 'Sofa', 'sofa.jpg', 799, { storage });
    vi.advanceTimersByTime(15000);
    clearBrowseAbandonment({ storage }); // customer adds to cart — clears abandonment tracking
    vi.advanceTimersByTime(20000);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });
});

// ── Backend: HIGH_INTENT_THRESHOLD_MS exact boundary ─────────────────────────

describe('trackBrowseSession — HIGH_INTENT_THRESHOLD_MS exact boundary', () => {
  beforeEach(() => __reset());

  it('totalDuration exactly at HIGH_INTENT_THRESHOLD_MS with products → high intent', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-exact-boundary',
      productsViewed: [{ productId: 'prod-1', productName: 'Test', price: 100, viewDuration: 60000 }],
      totalDuration: HIGH_INTENT_THRESHOLD_MS, // exactly 2 minutes
    });
    expect(result.success).toBe(true);
    expect(result.isHighIntent).toBe(true);
  });

  it('totalDuration 1ms below HIGH_INTENT_THRESHOLD_MS → NOT high intent', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-just-below',
      productsViewed: [{ productId: 'prod-1', productName: 'Test', price: 100, viewDuration: 60000 }],
      totalDuration: HIGH_INTENT_THRESHOLD_MS - 1,
    });
    expect(result.success).toBe(true);
    expect(result.isHighIntent).toBe(false);
  });

  it('totalDuration 1ms above HIGH_INTENT_THRESHOLD_MS → high intent', async () => {
    const result = await trackBrowseSession({
      sessionId: 'sess-just-above',
      productsViewed: [{ productId: 'prod-1', productName: 'Test', price: 100, viewDuration: 60000 }],
      totalDuration: HIGH_INTENT_THRESHOLD_MS + 1,
    });
    expect(result.success).toBe(true);
    expect(result.isHighIntent).toBe(true);
  });
});

// ── Unsubscribed members — browse recovery backend ────────────────────────────

describe('unsubscribed members never receive browse recovery emails', () => {
  beforeEach(() => __reset());

  it('captureRemindMeRequest — rejects email with browse_recovery unsubscribe', async () => {
    __seed('Unsubscribes', [{
      _id: 'u-browse',
      email: 'nosend-browse@example.com',
      sequenceType: 'browse_recovery',
    }]);

    const result = await captureRemindMeRequest('sess-unsub-browse', 'nosend-browse@example.com', 'No Send');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unsubscribed');
  });

  it('captureRemindMeRequest — rejects email with all-sequences unsubscribe', async () => {
    __seed('Unsubscribes', [{
      _id: 'u-all',
      email: 'nosend-all@example.com',
      sequenceType: 'all',
    }]);

    const result = await captureRemindMeRequest('sess-unsub-all', 'nosend-all@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('unsubscribed');
  });

  it('triggerBrowseRecovery — skips sessions belonging to browse_recovery unsubscribed visitors', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      _id: 'bs-unsub',
      sessionId: 'sess-unsub-trigger',
      productsViewed: '[]',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'quit-browse@example.com',
      converted: false,
      recoveryStep: 0,
      createdAt: threeHoursAgo,
    }]);
    __seed('Unsubscribes', [{
      _id: 'u-trigger',
      email: 'quit-browse@example.com',
      sequenceType: 'browse_recovery',
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('triggerBrowseRecovery — skips sessions for visitors unsubscribed from all sequences', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      _id: 'bs-unsub-all',
      sessionId: 'sess-unsub-all',
      productsViewed: '[]',
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'quit-all@example.com',
      converted: false,
      recoveryStep: 0,
      createdAt: threeHoursAgo,
    }]);
    __seed('Unsubscribes', [{
      _id: 'u-all-trigger',
      email: 'quit-all@example.com',
      sequenceType: 'all',
    }]);

    const result = await triggerBrowseRecovery();
    expect(result.triggered).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('triggerBrowseRecovery — proceeds for visitors unsubscribed from a different sequence type', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    __seed('BrowseSessions', [{
      _id: 'bs-diff-unsub',
      sessionId: 'sess-diff-unsub',
      productsViewed: JSON.stringify([{ productId: 'prod-1', productName: 'Test', price: 100 }]),
      isHighIntent: true,
      hasEmail: true,
      visitorEmail: 'other-unsub@example.com',
      converted: false,
      recoveryStep: 0,
      createdAt: threeHoursAgo,
    }]);
    __seed('Unsubscribes', [{
      _id: 'u-diff-type',
      email: 'other-unsub@example.com',
      sequenceType: 'cart_recovery', // unsubscribed from cart_recovery, NOT browse_recovery
    }]);

    const result = await triggerBrowseRecovery();
    // Should trigger (browse_recovery is not blocked, only cart_recovery is)
    expect(result.triggered).toBe(1);
    expect(result.skipped).toBe(0);
  });
});
