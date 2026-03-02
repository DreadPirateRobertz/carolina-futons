import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Module under test ───────────────────────────────────────────────
// proactiveChatTriggers.js exports functions for triggering chat nudges
// based on page context, time, scroll, idle, and exit-intent signals.
import {
  initProactiveTriggers,
  cleanupProactiveTriggers,
  shouldShowTrigger,
  getPageMessage,
  recordDismissal,
  resetDismissals,
  _getState, // test-only: inspect internal state
} from '../src/public/proactiveChatTriggers.js';

// ── Helpers ─────────────────────────────────────────────────────────

/** Create a mock Wix $w selector */
function make$w(overrides = {}) {
  const elements = {};
  const defaults = {
    chatWidget: { hidden: true, show: vi.fn(), hide: vi.fn() },
    chatToggleBtn: { label: '', focus: vi.fn(), onClick: vi.fn(), accessibility: {} },
    proactiveBubble: {
      text: '',
      show: vi.fn(),
      hide: vi.fn(),
      hidden: true,
      onClick: vi.fn(),
      accessibility: {},
    },
    proactiveDismissBtn: { onClick: vi.fn(), accessibility: {} },
    ...overrides,
  };

  Object.entries(defaults).forEach(([id, el]) => { elements[`#${id}`] = el; });

  return (selector) => {
    if (elements[selector]) return elements[selector];
    throw new Error(`Element ${selector} not found`);
  };
}

// ── Setup / Teardown ────────────────────────────────────────────────

let _savedDocument;
let _savedWindow;

beforeEach(() => {
  vi.useFakeTimers();
  // sessionStorage is provided by setup.js global mock — don't replace it
  _savedDocument = globalThis.document;
  _savedWindow = globalThis.window;
  globalThis.document = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  globalThis.window = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    innerHeight: 800,
    innerWidth: 1024,
    scrollY: 0,
  };
});

afterEach(() => {
  cleanupProactiveTriggers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  globalThis.document = _savedDocument;
  globalThis.window = _savedWindow;
});

// ═══════════════════════════════════════════════════════════════════
// 1. PROACTIVE TRIGGER — TIME-BASED
// ═══════════════════════════════════════════════════════════════════

describe('Time-based triggers', () => {
  it('shows proactive bubble after configured delay on Product Page', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 5000 });

    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect($w('#proactiveBubble').show).toHaveBeenCalled();
  });

  it('shows proactive bubble after configured delay on Checkout', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'checkout', delayMs: 8000 });

    vi.advanceTimersByTime(7999);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect($w('#proactiveBubble').show).toHaveBeenCalled();
  });

  it('does NOT show bubble if chat is already open', () => {
    const $w = make$w({ chatWidget: { hidden: false, show: vi.fn(), hide: vi.fn() } });
    initProactiveTriggers($w, { page: 'product', delayMs: 3000 });

    vi.advanceTimersByTime(3000);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
  });

  it('uses default delay when none specified (30s product, 10s checkout)', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product' });

    // Default delay should be 30s for product per AC
    vi.advanceTimersByTime(29999);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect($w('#proactiveBubble').show).toHaveBeenCalled();
  });

  it('uses 10s default delay for checkout', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'checkout' });

    // Default delay should be 10s for checkout per AC
    vi.advanceTimersByTime(9999);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect($w('#proactiveBubble').show).toHaveBeenCalled();
  });

  it('does not trigger on unrecognized pages', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'about' });

    vi.advanceTimersByTime(60000);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. PAGE-SPECIFIC MESSAGES
// ═══════════════════════════════════════════════════════════════════

describe('Page-specific messages', () => {
  it('returns product-focused message for Product Page', () => {
    const msg = getPageMessage('product');
    expect(msg).toBeTruthy();
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeLessThanOrEqual(120);
  });

  it('product online message asks "Need help choosing?"', () => {
    const msg = getPageMessage('product', true);
    expect(msg).toContain('Need help choosing');
  });

  it('returns checkout-focused message for Checkout', () => {
    const msg = getPageMessage('checkout');
    expect(msg).toBeTruthy();
    expect(msg).not.toBe(getPageMessage('product'));
  });

  it('returns null for pages without proactive triggers', () => {
    expect(getPageMessage('about')).toBeNull();
    expect(getPageMessage('faq')).toBeNull();
    expect(getPageMessage('')).toBeNull();
  });

  it('sets bubble text to page message on trigger', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    vi.advanceTimersByTime(1000);
    expect($w('#proactiveBubble').text).toBe(getPageMessage('product'));
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. FREQUENCY CAPPING / DISMISSAL
// ═══════════════════════════════════════════════════════════════════

describe('Frequency capping', () => {
  it('does not show bubble if user dismissed within this session', () => {
    recordDismissal();
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    vi.advanceTimersByTime(1000);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
  });

  it('respects max impressions per session (default 2)', () => {
    const $w = make$w();

    // First trigger
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    expect($w('#proactiveBubble').show).toHaveBeenCalledTimes(1);
    cleanupProactiveTriggers();

    // Second trigger (different page navigation)
    resetDismissals(); // simulate new page but same session
    const $w2 = make$w();
    initProactiveTriggers($w2, { page: 'checkout', delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    expect($w2('#proactiveBubble').show).toHaveBeenCalledTimes(1);
    cleanupProactiveTriggers();

    // Third trigger should be blocked (over cap)
    const $w3 = make$w();
    initProactiveTriggers($w3, { page: 'product', delayMs: 1000 });
    vi.advanceTimersByTime(1000);
    expect($w3('#proactiveBubble').show).not.toHaveBeenCalled();
  });

  it('shouldShowTrigger returns false after dismissal', () => {
    recordDismissal();
    expect(shouldShowTrigger('product')).toBe(false);
  });

  it('shouldShowTrigger returns true for eligible pages with no dismissal', () => {
    expect(shouldShowTrigger('product')).toBe(true);
    expect(shouldShowTrigger('checkout')).toBe(true);
  });

  it('shouldShowTrigger returns false for ineligible pages', () => {
    expect(shouldShowTrigger('about')).toBe(false);
    expect(shouldShowTrigger('')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. DISMISS INTERACTION
// ═══════════════════════════════════════════════════════════════════

describe('Dismiss interaction', () => {
  it('hides bubble when dismiss button clicked', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
    vi.advanceTimersByTime(1000);

    // Simulate dismiss click
    const dismissHandler = $w('#proactiveDismissBtn').onClick.mock.calls[0]?.[0];
    expect(dismissHandler).toBeDefined();
    dismissHandler();

    expect($w('#proactiveBubble').hide).toHaveBeenCalled();
  });

  it('records dismissal so trigger does not fire again', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
    vi.advanceTimersByTime(1000);

    const dismissHandler = $w('#proactiveDismissBtn').onClick.mock.calls[0]?.[0];
    dismissHandler();

    expect(shouldShowTrigger('product')).toBe(false);
  });

  it('clicking bubble opens chat widget and hides bubble', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
    vi.advanceTimersByTime(1000);

    const bubbleHandler = $w('#proactiveBubble').onClick.mock.calls[0]?.[0];
    expect(bubbleHandler).toBeDefined();
    bubbleHandler();

    expect($w('#chatWidget').show).toHaveBeenCalled();
    expect($w('#proactiveBubble').hide).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. OFFLINE FALLBACK
// ═══════════════════════════════════════════════════════════════════

describe('Offline fallback', () => {
  it('shows offline-specific message when chat is offline', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000, isOnline: false });

    vi.advanceTimersByTime(1000);
    const text = $w('#proactiveBubble').text;
    expect(text).toBeTruthy();
    // Offline message should mention leaving a message or getting back
    expect(text.toLowerCase()).toMatch(/leave|message|get back|offline/);
  });

  it('shows online message when chat is online', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000, isOnline: true });

    vi.advanceTimersByTime(1000);
    const text = $w('#proactiveBubble').text;
    expect(text).toBeTruthy();
    expect(text.toLowerCase()).not.toMatch(/offline/);
  });

  it('defaults to online=true when isOnline not specified', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    vi.advanceTimersByTime(1000);
    const text = $w('#proactiveBubble').text;
    expect(text.toLowerCase()).not.toMatch(/offline/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. KEYBOARD ACCESSIBILITY
// ═══════════════════════════════════════════════════════════════════

describe('Keyboard accessibility', () => {
  it('sets ARIA labels on proactive bubble', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    expect($w('#proactiveBubble').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets ARIA label on dismiss button', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    expect($w('#proactiveDismissBtn').accessibility.ariaLabel).toBeTruthy();
    expect($w('#proactiveDismissBtn').accessibility.ariaLabel.toLowerCase()).toMatch(/dismiss|close/);
  });

  it('sets role=alert on proactive bubble for screen reader announcement', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
    vi.advanceTimersByTime(1000);

    expect($w('#proactiveBubble').accessibility.role).toBe('alert');
  });

  it('Escape key dismisses proactive bubble', () => {
    const bubble = {
      text: '', show: vi.fn(), hide: vi.fn(), hidden: true,
      onClick: vi.fn(), accessibility: {},
    };
    // After show() is called, mark hidden=false so Escape handler sees it as visible
    bubble.show.mockImplementation(() => { bubble.hidden = false; });
    const $w = make$w({ proactiveBubble: bubble });
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
    vi.advanceTimersByTime(1000);

    // Find the keydown handler registered on document
    const keydownCall = globalThis.document.addEventListener.mock.calls.find(
      ([event]) => event === 'keydown'
    );
    expect(keydownCall).toBeDefined();

    const keyHandler = keydownCall[1];
    keyHandler({ key: 'Escape' });

    expect($w('#proactiveBubble').hide).toHaveBeenCalled();
  });

  it('non-Escape keys do NOT dismiss bubble', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
    vi.advanceTimersByTime(1000);

    const keydownCall = globalThis.document.addEventListener.mock.calls.find(
      ([event]) => event === 'keydown'
    );
    const keyHandler = keydownCall[1];
    keyHandler({ key: 'Enter' });

    expect($w('#proactiveBubble').hide).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. MOBILE POSITIONING
// ═══════════════════════════════════════════════════════════════════

describe('Mobile positioning', () => {
  it('detects mobile viewport and sets mobile class/flag', () => {
    globalThis.window.innerWidth = 375;
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    const state = _getState();
    expect(state.isMobile).toBe(true);
  });

  it('detects desktop viewport', () => {
    globalThis.window.innerWidth = 1024;
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    const state = _getState();
    expect(state.isMobile).toBe(false);
  });

  it('uses mobile breakpoint of 768px', () => {
    globalThis.window.innerWidth = 768;
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
    expect(_getState().isMobile).toBe(true);

    cleanupProactiveTriggers();

    globalThis.window.innerWidth = 769;
    const $w2 = make$w();
    initProactiveTriggers($w2, { page: 'product', delayMs: 1000 });
    expect(_getState().isMobile).toBe(false);
  });

  it('still triggers bubble on mobile', () => {
    globalThis.window.innerWidth = 375;
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    vi.advanceTimersByTime(1000);
    expect($w('#proactiveBubble').show).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. CLEANUP
// ═══════════════════════════════════════════════════════════════════

describe('Cleanup', () => {
  it('removes all event listeners on cleanup', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 5000 });

    cleanupProactiveTriggers();

    // Timers should be cleared — advancing should not trigger bubble
    vi.advanceTimersByTime(10000);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
  });

  it('removes document keydown listener on cleanup', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    cleanupProactiveTriggers();
    expect(globalThis.document.removeEventListener).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );
  });

  it('is safe to call cleanup multiple times', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 1000 });

    expect(() => {
      cleanupProactiveTriggers();
      cleanupProactiveTriggers();
    }).not.toThrow();
  });

  it('is safe to call cleanup without init', () => {
    expect(() => cleanupProactiveTriggers()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 9. EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('Edge cases', () => {
  it('handles missing proactiveBubble element gracefully', () => {
    const $w = (selector) => {
      if (selector === '#proactiveBubble') throw new Error('not found');
      if (selector === '#proactiveDismissBtn') throw new Error('not found');
      return {
        hidden: true, show: vi.fn(), hide: vi.fn(), onClick: vi.fn(),
        label: '', focus: vi.fn(), accessibility: {}, text: '',
      };
    };

    expect(() => {
      initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
      vi.advanceTimersByTime(1000);
    }).not.toThrow();
  });

  it('handles missing sessionStorage gracefully', () => {
    const saved = globalThis.sessionStorage;
    globalThis.sessionStorage = undefined;
    const $w = make$w();

    try {
      expect(() => {
        initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
        vi.advanceTimersByTime(1000);
      }).not.toThrow();
      expect($w('#proactiveBubble').show).toHaveBeenCalled();
    } finally {
      globalThis.sessionStorage = saved;
    }
  });

  it('handles missing document gracefully (SSR)', () => {
    const saved = globalThis.document;
    globalThis.document = undefined;
    const $w = make$w();

    try {
      expect(() => {
        initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
        vi.advanceTimersByTime(1000);
      }).not.toThrow();
    } finally {
      globalThis.document = saved;
    }
  });

  it('handles missing window gracefully', () => {
    const saved = globalThis.window;
    globalThis.window = undefined;
    const $w = make$w();

    try {
      expect(() => {
        initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
      }).not.toThrow();
      // Should default to non-mobile
      expect(_getState().isMobile).toBe(false);
    } finally {
      globalThis.window = saved;
    }
  });

  it('re-init on SPA navigation cleans up previous and starts fresh', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 5000 });

    // Navigate to checkout before product trigger fires
    const $w2 = make$w();
    initProactiveTriggers($w2, { page: 'checkout', delayMs: 2000 });

    // Product's 5s timer should have been cleaned up — only checkout fires
    vi.advanceTimersByTime(2000);
    expect($w2('#proactiveBubble').show).toHaveBeenCalledTimes(1);

    // Product timer should NOT fire later
    vi.advanceTimersByTime(5000);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
  });

  it('handles delayMs: 0 — triggers immediately', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 0 });

    vi.advanceTimersByTime(0);
    expect($w('#proactiveBubble').show).toHaveBeenCalled();
  });

  it('handles negative delayMs — falls back to default delay', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: -500 });

    // Should use default product delay (30s), not fire immediately
    vi.advanceTimersByTime(0);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30000);
    expect($w('#proactiveBubble').show).toHaveBeenCalled();
  });

  it('handles non-numeric delayMs — falls back to default delay', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'checkout', delayMs: 'fast' });

    // Should use default checkout delay (10s), not throw
    vi.advanceTimersByTime(0);
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10000);
    expect($w('#proactiveBubble').show).toHaveBeenCalled();
  });

  it('trackEvent throwing does not prevent bubble from showing', () => {
    // Mock trackEvent to throw
    vi.mock('public/engagementTracker', () => ({
      trackEvent: vi.fn(() => { throw new Error('analytics down'); }),
    }));

    const $w = make$w();
    expect(() => {
      initProactiveTriggers($w, { page: 'product', delayMs: 1000 });
      vi.advanceTimersByTime(1000);
    }).not.toThrow();

    expect($w('#proactiveBubble').show).toHaveBeenCalled();
  });

  it('sets role=alert at init time, not show time', () => {
    const $w = make$w();
    initProactiveTriggers($w, { page: 'product', delayMs: 5000 });

    // role=alert should be set immediately at init, before bubble shows
    expect($w('#proactiveBubble').accessibility.role).toBe('alert');

    // Bubble hasn't shown yet
    expect($w('#proactiveBubble').show).not.toHaveBeenCalled();
  });
});
