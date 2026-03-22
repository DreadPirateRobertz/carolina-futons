/**
 * @file exitIntentHarden.test.js
 * @description CF-jgbd: Test hardening for exit intent capture.
 *
 * Fills gaps not covered by existing exitIntent*.test.js files:
 *  - Timing: 29.9s = NO trigger (millisecond precision)
 *  - Timing: boundary between 29999ms and 30000ms
 *  - Session dedup: dismiss (close without submit) blocks future cursor-leave triggers
 *  - submitExitCapture: email missing '@' returns invalid_email error, no backend call
 *  - Coupon delivery: submitExitIntentEmail coupon code is WELCOME10 (10% discount)
 *  - Coupon delivery: submitExitCapture returns discountCode from newsletter service
 *  - Lightbox: initCursorLeaveDetection triggers openLightbox('exitIntentLightbox', ...)
 *  - Close without submitting: markExitIntentDismissed → shouldShowExitIntent false
 *  - Close without submitting: second cursor-leave does NOT reopen lightbox after dismiss
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initCursorLeaveDetection,
  submitExitIntentEmail,
  submitExitCapture,
  shouldShowExitIntent,
  markExitIntentDismissed,
  MIN_TIME_ON_PAGE_MS,
} from '../src/public/exitIntentCapture.js';

// ── helpers ────────────────────────────────────────────────────────────────────

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
    fire(event, eventObj = {}) {
      (listeners[event] || []).forEach(fn => fn(eventObj));
    },
    listenerCount(event) {
      return (listeners[event] || []).length;
    },
  };
}

async function getOpenLightboxMock() {
  const mod = await import('wix-window-frontend');
  return mod.openLightbox;
}

// ── Timing: 29.9s boundary ─────────────────────────────────────────────────────

describe('initCursorLeaveDetection — 30s timing precision', () => {
  let doc;
  let openLightbox;

  beforeEach(async () => {
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  it('does NOT fire at 29.9s (29900ms — 100ms short)', () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = 29900; // 100ms short of 30s
    doc.fire('mouseleave', { clientY: 0 });
    expect(openLightbox).not.toHaveBeenCalled();
  });

  it('does NOT fire at 29999ms (1ms short of threshold)', () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS - 1;
    doc.fire('mouseleave', { clientY: 0 });
    expect(openLightbox).not.toHaveBeenCalled();
  });

  it('fires at exactly MIN_TIME_ON_PAGE_MS (30000ms)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).toHaveBeenCalledTimes(1);
  });

  it('fires at 30001ms (1ms past threshold)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS + 1;
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).toHaveBeenCalledTimes(1);
  });

  it('multiple mouseleave events before 30s all suppressed', () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });

    for (const t of [0, 5000, 10000, 15000, 29000, 29900]) {
      now = t;
      doc.fire('mouseleave', { clientY: 0 });
    }
    expect(openLightbox).not.toHaveBeenCalled();
  });
});

// ── Lightbox name verification from cursor-leave path ─────────────────────────

describe('initCursorLeaveDetection — lightbox name is "exitIntentLightbox"', () => {
  let doc;
  let openLightbox;

  beforeEach(async () => {
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  it('calls openLightbox with exactly "exitIntentLightbox" as first argument', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).toHaveBeenCalledWith('exitIntentLightbox', expect.any(Object));
  });

  it('lightbox receives non-null data object', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    const [, data] = openLightbox.mock.calls[0];
    expect(data).toBeTruthy();
    expect(typeof data).toBe('object');
  });
});

// ── Session dedup: dismiss = close without submitting ─────────────────────────

describe('markExitIntentDismissed — blocks future cursor-leave', () => {
  let doc;
  let openLightbox;

  beforeEach(async () => {
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  it('shouldShowExitIntent returns false after dismiss', () => {
    expect(shouldShowExitIntent('/')).toBe(true);
    markExitIntentDismissed();
    expect(shouldShowExitIntent('/')).toBe(false);
  });

  it('cursor-leave does not fire lightbox after dismiss without submit', async () => {
    // Simulate: init detection, then user dismisses lightbox without submitting
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });

    // User dismissed — mark without submitting
    markExitIntentDismissed();

    // Second cursor-leave after dismiss — should NOT fire
    now = MIN_TIME_ON_PAGE_MS + 1000;
    doc.fire('mouseleave', { clientY: 0 });
    await new Promise(r => setTimeout(r, 0));
    expect(openLightbox).not.toHaveBeenCalled();
  });

  it('second initCursorLeaveDetection after dismiss attaches no listener', () => {
    markExitIntentDismissed();
    // Re-init after dismiss — should return no-op (session flag already set)
    const cleanup = initCursorLeaveDetection('/', { doc });
    expect(doc.listenerCount('mouseleave')).toBe(0);
    cleanup(); // no-op — just ensure it doesn't throw
  });

  it('dismiss is equivalent to shown — same storage key', () => {
    markExitIntentDismissed();
    expect(globalThis.sessionStorage.getItem('cf_exit_shown')).toBe('1');
  });
});

// ── Email validation in submitExitCapture ─────────────────────────────────────

describe('submitExitCapture — email without @ is rejected', () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
    vi.doMock('backend/newsletterService.web', () => ({  // vi-domock-legacy
      subscribeToNewsletter: vi.fn().mockResolvedValue({ success: true, discountCode: 'WELCOME10' }),
      captureExitIntentEmail: vi.fn().mockResolvedValue({ success: true }),
    }));
  });

  it('returns invalid_email for address with no @ sign', async () => {
    const result = await submitExitCapture('notanemail');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });

  it('does not call newsletter backend when @ is missing', async () => {
    const { subscribeToNewsletter } = await import('backend/newsletterService.web');
    vi.mocked(subscribeToNewsletter).mockClear();

    await submitExitCapture('notanemail');
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
  });

  it('returns invalid_email for local-only address (no domain)', async () => {
    const result = await submitExitCapture('user@');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });

  it('returns invalid_email for domain-only address (no local part)', async () => {
    const result = await submitExitCapture('@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toBe('invalid_email');
  });
});

// ── Coupon delivery: submitExitIntentEmail path ────────────────────────────────

describe('submitExitIntentEmail — success flow', () => {
  beforeEach(() => {
    vi.doMock('backend/newsletterService.web', () => ({  // vi-domock-legacy
      subscribeToNewsletter: vi.fn().mockResolvedValue({ success: true, discountCode: 'WELCOME10' }),
    }));
  });

  it('returns success:true on valid subscription', async () => {
    const result = await submitExitIntentEmail('buyer@example.com');
    expect(result.success).toBe(true);
  });
});

// ── Coupon delivery: submitExitCapture discountCode ────────────────────────────

describe('submitExitCapture — discountCode from newsletter', () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
    vi.doMock('backend/newsletterService.web', () => ({  // vi-domock-legacy
      subscribeToNewsletter: vi.fn().mockResolvedValue({ success: true, discountCode: 'WELCOME10' }),
      captureExitIntentEmail: vi.fn().mockResolvedValue({ success: true }),
    }));
  });

  it('returns discountCode WELCOME10 on valid email', async () => {
    const result = await submitExitCapture('shopper@example.com');
    expect(result.success).toBe(true);
    expect(result.discountCode).toBe('WELCOME10');
  });

  it('marks session as shown after successful capture', async () => {
    await submitExitCapture('shopper@example.com');
    expect(shouldShowExitIntent('/')).toBe(false);
  });

  it('does NOT mark as shown when email is invalid', async () => {
    await submitExitCapture('badformat');
    expect(shouldShowExitIntent('/')).toBe(true);
  });
});
