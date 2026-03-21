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

beforeEach(() => {
  vi.clearAllMocks();
  _currentPolicy = { analytics: false, advertising: false };
  _policyChangedCallback = null;
  clearQueue();
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

    // Restore
    wixPrivacy.getCurrentConsentPolicy.mockReturnValue({ policy: _currentPolicy });
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
