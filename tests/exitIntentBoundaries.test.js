/**
 * Boundary tests for exitIntentCapture.js — CF-jgbd.
 * Focuses on exact thresholds: timing (29999ms vs 30000ms),
 * cursor position (clientY 10 vs 11 vs null), and dismiss-prevents-retrigger integration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initCursorLeaveDetection,
  markExitIntentDismissed,
  shouldShowExitIntent,
  MIN_TIME_ON_PAGE_MS,
} from '../src/public/exitIntentCapture.js';

// ── Mock wix-window-frontend ─────────────────────────────────────

vi.mock('wix-window-frontend', () => ({
  openLightbox: vi.fn().mockResolvedValue(undefined),
}));

async function getOpenLightboxMock() {
  const mod = await import('wix-window-frontend');
  return mod.openLightbox;
}

// ── Minimal document-like emitter ────────────────────────────────

function makeDoc() {
  const listeners = {};
  return {
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    removeEventListener(type, fn) {
      if (listeners[type]) listeners[type] = listeners[type].filter(f => f !== fn);
    },
    fire(type, event) {
      (listeners[type] || []).forEach(fn => fn(event));
    },
    listenerCount(type) {
      return (listeners[type] || []).length;
    },
  };
}

// ── Timing boundary — exactly 1ms before threshold ───────────────

describe('initCursorLeaveDetection — timing boundary at 29999ms', () => {
  let doc;
  let openLightbox;

  beforeEach(async () => {
    vi.useFakeTimers();
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT fire at 29999ms (one ms short of 30s threshold)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });

    now = MIN_TIME_ON_PAGE_MS - 1; // 29999ms
    doc.fire('mouseleave', { clientY: 0 });
    await vi.runAllTimersAsync();

    expect(openLightbox).not.toHaveBeenCalled();
  });

  it('fires at exactly MIN_TIME_ON_PAGE_MS (30000ms)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });

    now = MIN_TIME_ON_PAGE_MS; // exactly 30000ms
    doc.fire('mouseleave', { clientY: 0 });
    await vi.runAllTimersAsync();

    expect(openLightbox).toHaveBeenCalledTimes(1);
  });
});

// ── clientY boundary — CURSOR_LEAVE_Y_THRESHOLD = 10 ─────────────

describe('initCursorLeaveDetection — clientY boundary at 10', () => {
  let doc;
  let openLightbox;

  beforeEach(async () => {
    vi.useFakeTimers();
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires when clientY is exactly 10 (at threshold, not above)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 10 });
    await vi.runAllTimersAsync();

    expect(openLightbox).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when clientY is 11 (one above threshold)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 11 });
    await vi.runAllTimersAsync();

    expect(openLightbox).not.toHaveBeenCalled();
  });

  it('does NOT fire when clientY is null (unknown direction)', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: null });
    await vi.runAllTimersAsync();

    expect(openLightbox).not.toHaveBeenCalled();
  });
});

// ── Dismiss → cursor-leave blocked integration ────────────────────

describe('markExitIntentDismissed — prevents cursor-leave from re-triggering', () => {
  let doc;
  let openLightbox;

  beforeEach(async () => {
    vi.useFakeTimers();
    doc = makeDoc();
    globalThis.sessionStorage.clear();
    openLightbox = await getOpenLightboxMock();
    openLightbox.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('user dismissing lightbox without submitting prevents future cursor-leave trigger', async () => {
    let now = 0;
    initCursorLeaveDetection('/', { doc, now: () => now });

    // Simulate: user had the lightbox open and closed it
    markExitIntentDismissed();

    // Cursor leaves the page again — should NOT re-open lightbox
    now = MIN_TIME_ON_PAGE_MS;
    doc.fire('mouseleave', { clientY: 0 });
    await vi.runAllTimersAsync();

    expect(openLightbox).not.toHaveBeenCalled();
    expect(shouldShowExitIntent('/')).toBe(false);
  });

  it('shouldShowExitIntent returns false after dismiss', () => {
    globalThis.sessionStorage.clear();
    expect(shouldShowExitIntent('/')).toBe(true);
    markExitIntentDismissed();
    expect(shouldShowExitIntent('/')).toBe(false);
  });
});
