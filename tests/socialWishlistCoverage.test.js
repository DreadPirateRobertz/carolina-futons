import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── $w Mock Infrastructure ───────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    style: {}, accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

const $w = (sel) => getEl(sel);

// ── Mock Dependencies ────────────────────────────────────────────────

vi.mock('public/designTokens.js', () => ({
  colors: { sunsetCoral: '#E8845C', espresso: '#3A2518' },
}));

vi.mock('public/engagementTracker', () => ({
  trackSocialShare: vi.fn(),
}));

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
  default: {
    openLightbox: vi.fn(() => Promise.resolve()),
    scrollTo: vi.fn(() => Promise.resolve()),
    trackEvent: vi.fn(),
    formFactor: 'Desktop',
  },
}));

vi.mock('wix-members-frontend', () => ({
  currentMember: {
    getMember: vi.fn(() => Promise.resolve(null)),
  },
  authentication: {
    promptLogin: vi.fn(),
  },
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      eq: vi.fn(function () { return this; }),
      find: vi.fn(() => Promise.resolve({ items: [] })),
    })),
    insert: vi.fn(() => Promise.resolve()),
    remove: vi.fn(() => Promise.resolve()),
  },
}));

const { initSocialShare, initWishlistButton } =
  await import('../src/public/product/socialWishlist.js');

// ── Line 63: Copy link label reset after timeout ─────────────────────

describe('initSocialShare — copy link label reset (line 63)', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const product = { _id: 'p1', name: 'Test Futon', slug: 'test-futon', mainMedia: 'img.jpg' };

  it('resets label from "Copied!" back to "Copy Link" after 2000ms', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: vi.fn(() => Promise.resolve()) } },
      writable: true,
      configurable: true,
    });

    initSocialShare($w, product);
    const handler = getEl('#shareCopyLink').onClick.mock.calls[0][0];
    handler();

    // Flush the clipboard writeText promise via a real microtask tick
    // (fake timers don't block Promise resolution)
    await Promise.resolve();
    await Promise.resolve();

    expect(getEl('#shareCopyLink').label).toBe('Copied!');

    // Advance past the 2000ms setTimeout that resets the label (line 63)
    vi.advanceTimersByTime(2000);

    expect(getEl('#shareCopyLink').label).toBe('Copy Link');

    delete globalThis.navigator;
  });

  it('does not throw if $w("#shareCopyLink") errors inside the setTimeout callback', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: { clipboard: { writeText: vi.fn(() => Promise.resolve()) } },
      writable: true,
      configurable: true,
    });

    // Force the element to throw on the second label set (the reset), exercising
    // the catch(e) block wrapping line 63.
    let callCount = 0;
    const faultyEl = {
      _label: '',
      accessibility: {},
      onClick: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
    };
    Object.defineProperty(faultyEl, 'label', {
      get() { return this._label; },
      set(v) {
        callCount++;
        if (callCount === 1) {
          // First set ("Copied!") succeeds
          this._label = v;
        } else {
          // Second set (reset to "Copy Link") throws — exercises catch(e) on line 63
          throw new Error('element gone');
        }
      },
      configurable: true,
    });
    elements.set('#shareCopyLink', faultyEl);

    initSocialShare($w, product);
    const handler = faultyEl.onClick.mock.calls[0][0];
    handler();

    await Promise.resolve();
    await Promise.resolve();

    // Advance timer — the catch block must swallow the error silently
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();

    delete globalThis.navigator;
  });
});

// ── Line 155: Outer catch hides wishlist button ──────────────────────

describe('initWishlistButton — outer catch hides button (line 155)', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  const product = { _id: 'p1', name: 'Test Futon', mainMedia: 'img.jpg' };

  it('hides #wishlistBtn when the outer try block throws synchronously', async () => {
    // Replace #wishlistBtn with an element whose onClick throws, which causes
    // the outer try in initWishlistButton to fail before completing setup.
    // We do this by making getMember throw so the await in the outer try rejects,
    // triggering the outer catch at line 154.
    const { currentMember } = await import('wix-members-frontend');
    currentMember.getMember.mockRejectedValueOnce(new Error('network failure'));

    await initWishlistButton($w, product);

    // Line 155 catch should have called hide() on #wishlistBtn
    expect(getEl('#wishlistBtn').hide).toHaveBeenCalled();
  });

  it('does not throw even if $w("#wishlistBtn").hide() itself throws (line 155 inner catch)', async () => {
    const { currentMember } = await import('wix-members-frontend');
    currentMember.getMember.mockRejectedValueOnce(new Error('network failure'));

    // Make the hide() call throw to exercise the inner catch(e2) on line 155
    getEl('#wishlistBtn').hide.mockImplementation(() => {
      throw new Error('hide failed');
    });

    await expect(initWishlistButton($w, product)).resolves.toBeUndefined();
  });
});
