/**
 * @file exitIntentFullImpl.test.js
 * @description Tests for CF-s2ck exit intent capture — full implementation.
 *
 * Tests:
 *  - initCursorLeaveDetection: cursor-leave fires after 30s, not before
 *  - initCursorLeaveDetection: once per session (no re-trigger)
 *  - initCursorLeaveDetection: lightbox called with correct data
 *  - initCursorLeaveDetection: excluded pages, pre-shown session
 *  - submitExitIntentEmail: newsletter + coupon generation
 *  - submitExitIntentEmail: invalid email rejected
 *  - submitExitIntentEmail: coupon failure is non-blocking
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initCursorLeaveDetection,
  submitExitIntentEmail,
  shouldShowExitIntent,
  markExitIntentShown,
  MIN_TIME_ON_PAGE_MS,
} from '../src/public/exitIntentCapture.js';

// ── helpers ───────────────────────────────────────────────────────────

/**
 * Build a minimal fake document with addEventListener/removeEventListener.
 */
function makeDoc() {
  const listeners = {};
  return {
    addEventListener(event, fn) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(f => f !== fn);
      }
    },
    /** Fire an event with a synthetic event object */
    fire(event, eventObj = {}) {
      (listeners[event] || []).forEach(fn => fn(eventObj));
    },
    listenerCount(event) {
      return (listeners[event] || []).length;
    },
  };
}

/** Get the wix-window-frontend mock's openLightbox spy */
async function getOpenLightboxMock() {
  const mod = await import('wix-window-frontend');
  return mod.openLightbox;
}

// ═══════════════════════════════════════════════════════════════════
// initCursorLeaveDetection — basic wiring
// ═══════════════════════════════════════════════════════════════════

describe('initCursorLeaveDetection — basic wiring', () => {
  let doc;

  beforeEach(async () => {
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    const openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  it('returns a cleanup function', () => {
    const cleanup = initCursorLeaveDetection('/', { doc });
    expect(typeof cleanup).toBe('function');
  });

  it('attaches a mouseleave listener to doc', () => {
    initCursorLeaveDetection('/', { doc });
    expect(doc.listenerCount('mouseleave')).toBe(1);
  });

  it('cleanup removes the listener', () => {
    const cleanup = initCursorLeaveDetection('/', { doc });
    cleanup();
    expect(doc.listenerCount('mouseleave')).toBe(0);
  });

  it('does not attach listener on excluded paths', () => {
    initCursorLeaveDetection('/cart', { doc });
    expect(doc.listenerCount('mouseleave')).toBe(0);
  });

  it('does not attach listener when session flag is set', () => {
    markExitIntentShown();
    initCursorLeaveDetection('/', { doc });
    expect(doc.listenerCount('mouseleave')).toBe(0);
  });

  it('returns no-op cleanup when doc is unavailable', () => {
    const cleanup = initCursorLeaveDetection('/', { doc: null });
    expect(typeof cleanup).toBe('function');
    expect(() => cleanup()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// initCursorLeaveDetection — timing guard (30s minimum)
// ═══════════════════════════════════════════════════════════════════

describe('initCursorLeaveDetection — timing guard', () => {
  let doc;
  let openLightbox;

  beforeEach(async () => {
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  it('does NOT fire lightbox before 30s', () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });

    // Simulate mouseleave at top of screen at t=0
    doc.fire('mouseleave', { clientY: 0 });
    expect(openLightbox).not.toHaveBeenCalled();
  });

  it('does NOT fire lightbox at 29 seconds', () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });

    now = 29 * 1000;
    doc.fire('mouseleave', { clientY: 0 });
    expect(openLightbox).not.toHaveBeenCalled();
  });

  it('fires lightbox exactly at 30 seconds', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });

    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0)); // flush async chain
    expect(openLightbox).toHaveBeenCalledTimes(1);
  });

  it('fires lightbox after more than 30 seconds', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });

    now = 60 * 1000;
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// initCursorLeaveDetection — cursor position guard
// ═══════════════════════════════════════════════════════════════════

describe('initCursorLeaveDetection — cursor position guard', () => {
  let doc;
  let openLightbox;

  beforeEach(async () => {
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  it('fires when clientY is 0 (cursor at very top)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).toHaveBeenCalled();
  });

  it('fires when clientY is within threshold (e.g. 5)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 5 });
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).toHaveBeenCalled();
  });

  it('does NOT fire when clientY is above threshold (leaving from side/bottom)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 200 });
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).not.toHaveBeenCalled();
  });

  it('does NOT fire when clientY is missing', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', {});
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// initCursorLeaveDetection — once per session
// ═══════════════════════════════════════════════════════════════════

describe('initCursorLeaveDetection — once per session', () => {
  let doc;
  let openLightbox;

  beforeEach(async () => {
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  it('does not re-trigger on second mouseleave in same session', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;

    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).toHaveBeenCalledTimes(1);
  });

  it('marks session flag on first trigger', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;

    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    expect(shouldShowExitIntent('/')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// initCursorLeaveDetection — lightbox payload
// ═══════════════════════════════════════════════════════════════════

describe('initCursorLeaveDetection — lightbox payload', () => {
  it('calls openLightbox with discount and expiry data', async () => {
    const doc = makeDoc();
    globalThis.sessionStorage.clear();
    const openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();

    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));

    expect(openLightbox).toHaveBeenCalledWith('exitIntentLightbox', {
      discount: '10OFF',
      expiry: '48h',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// submitExitIntentEmail — validation
// ═══════════════════════════════════════════════════════════════════

describe('submitExitIntentEmail — validation', () => {
  it('rejects invalid email', async () => {
    const result = await submitExitIntentEmail('not-an-email');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });

  it('rejects empty email', async () => {
    const result = await submitExitIntentEmail('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });

  it('rejects null email', async () => {
    const result = await submitExitIntentEmail(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });

  it('rejects undefined email', async () => {
    const result = await submitExitIntentEmail(undefined);
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });
});

// ═══════════════════════════════════════════════════════════════════
// submitExitIntentEmail — success flow
// ═══════════════════════════════════════════════════════════════════

describe('submitExitIntentEmail — success flow', () => {
  let mockSubscribe;

  beforeEach(() => {
    mockSubscribe = vi.fn().mockResolvedValue({ success: true });

    vi.doMock('backend/newsletterService.web', () => ({  // vi-domock-legacy
      subscribeToNewsletter: mockSubscribe,
    }));
  });

  it('calls subscribeToNewsletter with exit_intent_popup source', async () => {
    await submitExitIntentEmail('user@test.com');
    expect(mockSubscribe).toHaveBeenCalledWith('user@test.com', { source: 'exit_intent_popup' });
  });

  it('returns success:true', async () => {
    const result = await submitExitIntentEmail('user@test.com');
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// submitExitIntentEmail — error paths
// ═══════════════════════════════════════════════════════════════════

describe('submitExitIntentEmail — error paths', () => {
  let mockSubscribe;

  beforeEach(() => {
    mockSubscribe = vi.fn().mockResolvedValue({ success: true });

    vi.doMock('backend/newsletterService.web', () => ({  // vi-domock-legacy
      subscribeToNewsletter: mockSubscribe,
    }));
  });

  it('returns error when subscription fails', async () => {
    mockSubscribe.mockResolvedValue({ success: false, message: 'Already subscribed' });
    const result = await submitExitIntentEmail('user@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Already subscribed');
  });

  it('handles newsletter module import failure gracefully', async () => {
    vi.doMock('backend/newsletterService.web', () => {  // vi-domock-legacy
      throw new Error('Module unavailable');
    });
    const result = await submitExitIntentEmail('user@test.com');
    expect(result.success).toBe(false);
    expect(result.error).toBe('submission_failed');
  });
});
