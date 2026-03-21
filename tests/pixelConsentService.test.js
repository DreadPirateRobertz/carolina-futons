/**
 * CF-pixel-consent-gate: Pixel consent gate tests
 *
 * pixelConsentService wraps TikTok and Pinterest pixel firing with a
 * wix-privacy-frontend consent check. Events fired without consent are
 * queued and flushed when the user grants analytics/advertising consent.
 *
 * Consent model (wix-privacy-frontend):
 *   getCurrentConsentPolicy().policy.analytics  — analytics pixels
 *   getCurrentConsentPolicy().policy.advertising — ad pixels
 *   onCurrentConsentPolicyChanged(cb)           — fires when user updates consent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

let _currentPolicy = { analytics: false, advertising: false };
let _policyChangedCallback = null;

vi.mock('wix-privacy-frontend', () => ({
  default: {
    getCurrentConsentPolicy: vi.fn(() => ({ policy: _currentPolicy })),
    onCurrentConsentPolicyChanged: vi.fn((cb) => { _policyChangedCallback = cb; }),
  },
}));

vi.mock('../src/public/tikTokPixel.js', () => ({
  fireTikTokEvent: vi.fn(),
}));

vi.mock('../src/public/pinterestTag.js', () => ({
  firePinterestEvent: vi.fn(),
}));

import { fireTikTokEvent } from '../src/public/tikTokPixel.js';
import { firePinterestEvent } from '../src/public/pinterestTag.js';
import {
  initConsentGate,
  fireTrackedTikTokEvent,
  fireTrackedPinterestEvent,
  getQueueLength,
  clearQueue,
} from '../src/public/pixelConsentService.js';

// ── Helpers ─────────────────────────────────────────────────────────────

function grantConsent() {
  _currentPolicy = { analytics: true, advertising: true };
  if (_policyChangedCallback) {
    _policyChangedCallback({ policy: _currentPolicy });
  }
}

function grantAnalyticsOnly() {
  _currentPolicy = { analytics: true, advertising: false };
  if (_policyChangedCallback) {
    _policyChangedCallback({ policy: _currentPolicy });
  }
}

function grantAdvertisingOnly() {
  _currentPolicy = { analytics: false, advertising: true };
  if (_policyChangedCallback) {
    _policyChangedCallback({ policy: _currentPolicy });
  }
}


// ── Setup ───────────────────────────────────────────────────────────────

beforeEach(async () => {
  vi.clearAllMocks();
  _currentPolicy = { analytics: false, advertising: false };
  _policyChangedCallback = null;
  clearQueue();

  // Re-apply mock implementations after clearAllMocks — some tests override
  // these with mockImplementation/mockReturnValue; re-applying ensures each
  // test starts with a live-closure implementation that tracks _currentPolicy.
  const { default: wixPrivacy } = await import('wix-privacy-frontend');
  wixPrivacy.getCurrentConsentPolicy.mockImplementation(() => ({ policy: _currentPolicy }));
  wixPrivacy.onCurrentConsentPolicyChanged.mockImplementation((cb) => { _policyChangedCallback = cb; });

  initConsentGate();
});

// ── consent denied → events queued, not fired ──────────────────────────

describe('consent denied — events are queued, not fired', () => {
  it('TikTok event is NOT fired when consent is denied', () => {
    fireTrackedTikTokEvent('ViewContent', { value: 100 });
    expect(fireTikTokEvent).not.toHaveBeenCalled();
  });

  it('Pinterest event is NOT fired when consent is denied', () => {
    fireTrackedPinterestEvent('viewcategory', { value: 100 });
    expect(firePinterestEvent).not.toHaveBeenCalled();
  });

  it('queue grows when events fired without consent', () => {
    fireTrackedTikTokEvent('ViewContent', { value: 100 });
    fireTrackedPinterestEvent('viewcategory', { value: 100 });
    expect(getQueueLength()).toBe(2);
  });

  it('multiple TikTok events queue up', () => {
    fireTrackedTikTokEvent('ViewContent', { value: 100 });
    fireTrackedTikTokEvent('AddToCart', { value: 200 });
    expect(getQueueLength()).toBe(2);
    expect(fireTikTokEvent).not.toHaveBeenCalled();
  });

  it('multiple Pinterest events queue up', () => {
    fireTrackedPinterestEvent('viewcategory', {});
    fireTrackedPinterestEvent('addtocart', { value: 50 });
    expect(getQueueLength()).toBe(2);
    expect(firePinterestEvent).not.toHaveBeenCalled();
  });
});

// ── consent granted → events fire immediately ──────────────────────────

describe('consent granted — events fire immediately', () => {
  beforeEach(() => {
    grantConsent();
  });

  it('TikTok event fires immediately when consent is granted', () => {
    fireTrackedTikTokEvent('ViewContent', { value: 100 });
    expect(fireTikTokEvent).toHaveBeenCalledWith('ViewContent', { value: 100 });
  });

  it('Pinterest event fires immediately when consent is granted', () => {
    fireTrackedPinterestEvent('viewcategory', { value: 50 });
    expect(firePinterestEvent).toHaveBeenCalledWith('viewcategory', { value: 50 });
  });

  it('queue remains empty when consent is granted', () => {
    fireTrackedTikTokEvent('AddToCart', { value: 200 });
    expect(getQueueLength()).toBe(0);
  });

  it('correct event name is passed through', () => {
    fireTrackedTikTokEvent('Purchase', { value: 499, currency: 'USD' });
    expect(fireTikTokEvent).toHaveBeenCalledWith('Purchase', { value: 499, currency: 'USD' });
  });
});

// ── queue flush when consent is granted ───────────────────────────────

describe('queue flush on consent granted', () => {
  it('queued TikTok events fire when consent is granted', () => {
    fireTrackedTikTokEvent('ViewContent', { value: 100 });
    expect(fireTikTokEvent).not.toHaveBeenCalled();
    grantConsent();
    expect(fireTikTokEvent).toHaveBeenCalledWith('ViewContent', { value: 100 });
  });

  it('queued Pinterest events fire when consent is granted', () => {
    fireTrackedPinterestEvent('addtocart', { value: 50 });
    expect(firePinterestEvent).not.toHaveBeenCalled();
    grantConsent();
    expect(firePinterestEvent).toHaveBeenCalledWith('addtocart', { value: 50 });
  });

  it('mixed queue flushes all events in order', () => {
    const order = [];
    fireTikTokEvent.mockImplementation((name) => order.push(`ttq:${name}`));
    firePinterestEvent.mockImplementation((name) => order.push(`pin:${name}`));

    fireTrackedTikTokEvent('ViewContent', {});
    fireTrackedPinterestEvent('viewcategory', {});
    fireTrackedTikTokEvent('AddToCart', {});

    grantConsent();

    expect(order).toEqual(['ttq:ViewContent', 'pin:viewcategory', 'ttq:AddToCart']);
  });

  it('queue is empty after flush', () => {
    fireTrackedTikTokEvent('ViewContent', {});
    fireTrackedPinterestEvent('viewcategory', {});
    grantConsent();
    expect(getQueueLength()).toBe(0);
  });

  it('events queued after consent is granted fire immediately (no re-queue)', () => {
    grantConsent();
    fireTrackedTikTokEvent('Purchase', { value: 499 });
    expect(fireTikTokEvent).toHaveBeenCalledTimes(1);
    expect(getQueueLength()).toBe(0);
  });
});

// ── event parameters are preserved through queue ──────────────────────

describe('event parameters preserved through queue', () => {
  it('TikTok event params are preserved when flushed', () => {
    const params = { value: 249, currency: 'USD', content_id: 'sku-123' };
    fireTrackedTikTokEvent('AddToCart', params);
    grantConsent();
    expect(fireTikTokEvent).toHaveBeenCalledWith('AddToCart', params);
  });

  it('Pinterest event params are preserved when flushed', () => {
    const params = { value: 99, order_quantity: 2, currency: 'USD' };
    fireTrackedPinterestEvent('addtocart', params);
    grantConsent();
    expect(firePinterestEvent).toHaveBeenCalledWith('addtocart', params);
  });

  it('empty params object is passed through', () => {
    grantConsent();
    fireTrackedTikTokEvent('PageView', {});
    expect(fireTikTokEvent).toHaveBeenCalledWith('PageView', {});
  });
});

// ── partial consent does NOT flush queue (GDPR) ───────────────────────

describe('partial consent — queue not flushed (GDPR requirement)', () => {
  it('analytics-only consent does not fire TikTok events', () => {
    fireTrackedTikTokEvent('ViewContent', {});
    grantAnalyticsOnly();
    expect(fireTikTokEvent).not.toHaveBeenCalled();
    expect(getQueueLength()).toBe(1);
  });

  it('advertising-only consent does not fire Pinterest events', () => {
    fireTrackedPinterestEvent('viewcategory', {});
    grantAdvertisingOnly();
    expect(firePinterestEvent).not.toHaveBeenCalled();
    expect(getQueueLength()).toBe(1);
  });

  it('both consents required to flush queue', () => {
    fireTrackedTikTokEvent('AddToCart', {});
    grantAnalyticsOnly();
    expect(fireTikTokEvent).not.toHaveBeenCalled();
    grantConsent(); // now both
    expect(fireTikTokEvent).toHaveBeenCalledTimes(1);
  });
});

// ── queue size cap ─────────────────────────────────────────────────────

describe('queue size cap — prevents unbounded memory growth', () => {
  it('queue does not exceed 50 events', () => {
    for (let i = 0; i < 60; i++) {
      fireTrackedTikTokEvent('ViewContent', { i });
    }
    expect(getQueueLength()).toBe(50);
  });

  it('events beyond cap are silently dropped', () => {
    for (let i = 0; i < 60; i++) {
      fireTrackedTikTokEvent('ViewContent', { i });
    }
    grantConsent();
    expect(fireTikTokEvent).toHaveBeenCalledTimes(50);
  });
});

// ── consent revocation (GDPR flow) ────────────────────────────────────

describe('consent revocation — events re-queue after consent withdrawn', () => {
  it('events fire immediately after grant then re-queue after revocation', () => {
    grantConsent();
    fireTrackedTikTokEvent('Purchase', { value: 499 });
    expect(fireTikTokEvent).toHaveBeenCalledTimes(1);

    // Revoke consent
    _currentPolicy = { analytics: false, advertising: false };
    vi.clearAllMocks();

    fireTrackedTikTokEvent('ViewContent', { value: 100 });
    expect(fireTikTokEvent).not.toHaveBeenCalled();
    expect(getQueueLength()).toBe(1);
  });
});

// ── privacy API error handling ─────────────────────────────────────────

describe('_hasConsent() — privacy API exception handling', () => {
  it('queues events when wixPrivacy.getCurrentConsentPolicy throws', async () => {
    const { default: wixPrivacy } = await import('wix-privacy-frontend');
    wixPrivacy.getCurrentConsentPolicy.mockImplementation(() => {
      throw new Error('Privacy API unavailable');
    });

    fireTrackedTikTokEvent('ViewContent', {});
    expect(fireTikTokEvent).not.toHaveBeenCalled();
    expect(getQueueLength()).toBe(1);

    // Restore — use live closure so subsequent tests pick up _currentPolicy changes
    wixPrivacy.getCurrentConsentPolicy.mockImplementation(() => ({ policy: _currentPolicy }));
  });
});

// ── initConsentGate idempotency ────────────────────────────────────────

describe('initConsentGate — setup', () => {
  it('calling initConsentGate registers onCurrentConsentPolicyChanged listener', async () => {
    const { default: wixPrivacy } = await import('wix-privacy-frontend');
    expect(wixPrivacy.onCurrentConsentPolicyChanged).toHaveBeenCalled();
  });

  it('calling initConsentGate twice does not double-flush the queue', () => {
    fireTrackedTikTokEvent('ViewContent', {});
    initConsentGate(); // second call — should not re-register duplicate listener
    grantConsent();
    expect(fireTikTokEvent).toHaveBeenCalledTimes(1);
  });
});

// ── listener deregistration on failure ────────────────────────────────

describe('initConsentGate — listener deregistration on failure', () => {
  it('resets _listenerRegistered to false when onCurrentConsentPolicyChanged throws', async () => {
    const { default: wixPrivacy } = await import('wix-privacy-frontend');

    // Simulate registration failure
    wixPrivacy.onCurrentConsentPolicyChanged.mockImplementationOnce(() => {
      throw new Error('Privacy API error');
    });

    clearQueue(); // Reset state (also resets _listenerRegistered)
    initConsentGate(); // Should fail, reset flag

    // Since the listener failed to register, calling initConsentGate() again
    // should successfully re-register (now that the mock is restored to normal)
    initConsentGate();

    // After recovery, the listener should work: queue should flush on consent
    fireTrackedTikTokEvent('ViewContent', {});
    grantConsent();
    expect(fireTikTokEvent).toHaveBeenCalledWith('ViewContent', {});
  });

  it('does not flush queue if listener registration fails (no callback registered)', async () => {
    const { default: wixPrivacy } = await import('wix-privacy-frontend');

    wixPrivacy.onCurrentConsentPolicyChanged.mockImplementationOnce(() => {
      throw new Error('Privacy API error');
    });

    clearQueue();
    initConsentGate(); // Listener registration fails — _listenerRegistered reset to false

    fireTrackedTikTokEvent('ViewContent', {});
    // Manually triggering the old callback should not work (it was never set)
    // Consent granted via mock but no callback was registered this round
    _currentPolicy = { analytics: true, advertising: true };
    // No flush because callback was never registered
    expect(fireTikTokEvent).not.toHaveBeenCalled();
    expect(getQueueLength()).toBe(1);
  });
});

// ── all event types fire through consent gate ──────────────────────────

describe('TikTok — all standard event types fire with correct payload', () => {
  beforeEach(() => {
    grantConsent();
  });

  it('PageView fires with correct payload', () => {
    fireTrackedTikTokEvent('PageView', { page: '/products' });
    expect(fireTikTokEvent).toHaveBeenCalledWith('PageView', { page: '/products' });
  });

  it('ViewContent fires with correct payload', () => {
    const params = { content_id: 'sku-001', content_type: 'product', value: 299, currency: 'USD' };
    fireTrackedTikTokEvent('ViewContent', params);
    expect(fireTikTokEvent).toHaveBeenCalledWith('ViewContent', params);
  });

  it('AddToCart fires with correct payload', () => {
    const params = { content_id: 'sku-002', quantity: 2, value: 598, currency: 'USD' };
    fireTrackedTikTokEvent('AddToCart', params);
    expect(fireTikTokEvent).toHaveBeenCalledWith('AddToCart', params);
  });

  it('Purchase fires with correct payload', () => {
    const params = { order_id: 'order-9001', value: 499, currency: 'USD', num_items: 1 };
    fireTrackedTikTokEvent('Purchase', params);
    expect(fireTikTokEvent).toHaveBeenCalledWith('Purchase', params);
  });

  it('Search fires with correct payload', () => {
    const params = { query: 'futon couch', num_results: 12 };
    fireTrackedTikTokEvent('Search', params);
    expect(fireTikTokEvent).toHaveBeenCalledWith('Search', params);
  });
});

describe('TikTok — all event types queue correctly without consent', () => {
  it('PageView is queued when no consent', () => {
    fireTrackedTikTokEvent('PageView', { page: '/' });
    expect(fireTikTokEvent).not.toHaveBeenCalled();
    expect(getQueueLength()).toBe(1);
  });

  it('ViewContent is queued when no consent', () => {
    fireTrackedTikTokEvent('ViewContent', { content_id: 'sku-x' });
    expect(fireTikTokEvent).not.toHaveBeenCalled();
  });

  it('AddToCart is queued when no consent', () => {
    fireTrackedTikTokEvent('AddToCart', { content_id: 'sku-y', value: 100 });
    expect(fireTikTokEvent).not.toHaveBeenCalled();
  });

  it('Purchase is queued when no consent', () => {
    fireTrackedTikTokEvent('Purchase', { order_id: 'ord-42', value: 299 });
    expect(fireTikTokEvent).not.toHaveBeenCalled();
  });

  it('Search is queued when no consent', () => {
    fireTrackedTikTokEvent('Search', { query: 'sofa' });
    expect(fireTikTokEvent).not.toHaveBeenCalled();
  });
});

describe('Pinterest — all standard event types fire with correct payload', () => {
  beforeEach(() => {
    grantConsent();
  });

  it('pagevisit fires with correct payload', () => {
    fireTrackedPinterestEvent('pagevisit', { page_name: 'home' });
    expect(firePinterestEvent).toHaveBeenCalledWith('pagevisit', { page_name: 'home' });
  });

  it('viewcategory fires with correct payload', () => {
    const params = { product_id: 'sku-003', product_name: 'Futon Frame', value: 349, currency: 'USD' };
    fireTrackedPinterestEvent('viewcategory', params);
    expect(firePinterestEvent).toHaveBeenCalledWith('viewcategory', params);
  });

  it('addtocart fires with correct payload', () => {
    const params = { product_id: 'sku-004', order_quantity: 1, value: 249, currency: 'USD' };
    fireTrackedPinterestEvent('addtocart', params);
    expect(firePinterestEvent).toHaveBeenCalledWith('addtocart', params);
  });

  it('purchase fires with correct payload', () => {
    const params = { order_id: 'order-8001', value: 599, currency: 'USD', line_items: [{ product_id: 'sku-001', quantity: 1 }] };
    fireTrackedPinterestEvent('purchase', params);
    expect(firePinterestEvent).toHaveBeenCalledWith('purchase', params);
  });

  it('search fires with correct payload', () => {
    const params = { search_query: 'convertible sofa' };
    fireTrackedPinterestEvent('search', params);
    expect(firePinterestEvent).toHaveBeenCalledWith('search', params);
  });
});

describe('Pinterest — all event types queue correctly without consent', () => {
  it('pagevisit is queued when no consent', () => {
    fireTrackedPinterestEvent('pagevisit', {});
    expect(firePinterestEvent).not.toHaveBeenCalled();
    expect(getQueueLength()).toBe(1);
  });

  it('viewcategory is queued when no consent', () => {
    fireTrackedPinterestEvent('viewcategory', { product_id: 'sku-a' });
    expect(firePinterestEvent).not.toHaveBeenCalled();
  });

  it('addtocart is queued when no consent', () => {
    fireTrackedPinterestEvent('addtocart', { product_id: 'sku-b', value: 99 });
    expect(firePinterestEvent).not.toHaveBeenCalled();
  });

  it('purchase is queued when no consent', () => {
    fireTrackedPinterestEvent('purchase', { order_id: 'ord-77', value: 199 });
    expect(firePinterestEvent).not.toHaveBeenCalled();
  });

  it('search is queued when no consent', () => {
    fireTrackedPinterestEvent('search', { search_query: 'loveseat' });
    expect(firePinterestEvent).not.toHaveBeenCalled();
  });
});

// ── purchase deduplication ─────────────────────────────────────────────

describe('purchase deduplication — same order_id fires only once', () => {
  beforeEach(() => {
    grantConsent();
  });

  it('TikTok Purchase with same order_id fires only once', () => {
    fireTrackedTikTokEvent('Purchase', { order_id: 'order-dup-1', value: 299 });
    fireTrackedTikTokEvent('Purchase', { order_id: 'order-dup-1', value: 299 });
    expect(fireTikTokEvent).toHaveBeenCalledTimes(1);
  });

  it('Pinterest purchase with same order_id fires only once', () => {
    fireTrackedPinterestEvent('purchase', { order_id: 'order-dup-2', value: 399 });
    fireTrackedPinterestEvent('purchase', { order_id: 'order-dup-2', value: 399 });
    expect(firePinterestEvent).toHaveBeenCalledTimes(1);
  });

  it('TikTok Purchase with different order_ids both fire', () => {
    fireTrackedTikTokEvent('Purchase', { order_id: 'order-a', value: 100 });
    fireTrackedTikTokEvent('Purchase', { order_id: 'order-b', value: 200 });
    expect(fireTikTokEvent).toHaveBeenCalledTimes(2);
  });

  it('Pinterest purchase with different order_ids both fire', () => {
    fireTrackedPinterestEvent('purchase', { order_id: 'order-c', value: 150 });
    fireTrackedPinterestEvent('purchase', { order_id: 'order-d', value: 250 });
    expect(firePinterestEvent).toHaveBeenCalledTimes(2);
  });

  it('TikTok Purchase without order_id always fires (no dedup key)', () => {
    fireTrackedTikTokEvent('Purchase', { value: 99 });
    fireTrackedTikTokEvent('Purchase', { value: 99 });
    expect(fireTikTokEvent).toHaveBeenCalledTimes(2);
  });

  it('deduplication survives queue flush — queued purchase with same order_id fires only once', () => {
    // Fire without consent → queued
    _currentPolicy = { analytics: false, advertising: false };
    vi.clearAllMocks();
    clearQueue();
    initConsentGate();

    fireTrackedTikTokEvent('Purchase', { order_id: 'order-flush-1', value: 499 });
    fireTrackedTikTokEvent('Purchase', { order_id: 'order-flush-1', value: 499 }); // dup — dropped at queue time

    grantConsent(); // flush

    // The dedup check happens at fire time, so the duplicate is dropped before queuing
    expect(fireTikTokEvent).toHaveBeenCalledTimes(1);
  });

  it('non-purchase events are never deduplicated', () => {
    fireTrackedTikTokEvent('ViewContent', { content_id: 'sku-x' });
    fireTrackedTikTokEvent('ViewContent', { content_id: 'sku-x' });
    expect(fireTikTokEvent).toHaveBeenCalledTimes(2);
  });
});
