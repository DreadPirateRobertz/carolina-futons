import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isDismissed,
  markDismissed,
  formatCountdown,
  startCountdown,
  initSaleLightbox,
  DISMISS_KEY,
  DISMISS_DURATION_MS,
  SHOW_DELAY_MS,
} from '../src/public/SaleLightbox.js';

vi.mock('backend/promotions.web', () => ({
  getActivePromotion: vi.fn().mockResolvedValue(null),
}));

vi.mock('public/a11yHelpers.js', () => ({
  setupAccessibleDialog: vi.fn(() => ({ open: vi.fn(), close: vi.fn() })),
}));

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: vi.fn((k) => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = v; }),
    removeItem: vi.fn((k) => { delete store[k]; }),
    _store: store,
  };
}

function makeEl() {
  return {
    text: '', src: '', label: '', href: '',
    show: vi.fn(), hide: vi.fn(),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    accessibility: {},
  };
}

function make$w() {
  const els = new Map();
  return (sel) => {
    if (!els.has(sel)) els.set(sel, makeEl());
    return els.get(sel);
  };
}

const PROMO = {
  _id: 'p1',
  title: 'Spring Sale',
  subtitle: '30% off everything',
  heroImage: 'https://example.com/spring.jpg',
  ctaText: 'Shop Now',
  ctaUrl: '/spring-sale',
  endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days out
};

// ── isDismissed ──────────────────────────────────────────────────────────────

describe('isDismissed', () => {
  it('returns false when storage is null', () => {
    expect(isDismissed(null)).toBe(false);
  });

  it('returns false when key is absent', () => {
    expect(isDismissed(makeStorage())).toBe(false);
  });

  it('returns false when dismissed timestamp is older than 24h', () => {
    const ts = String(Date.now() - DISMISS_DURATION_MS - 1000);
    expect(isDismissed(makeStorage({ [DISMISS_KEY]: ts }))).toBe(false);
  });

  it('returns true when dismissed within 24h', () => {
    const ts = String(Date.now() - 1000);
    expect(isDismissed(makeStorage({ [DISMISS_KEY]: ts }))).toBe(true);
  });

  it('returns false for non-numeric stored value', () => {
    expect(isDismissed(makeStorage({ [DISMISS_KEY]: 'garbage' }))).toBe(false);
  });

  it('returns false when storage.getItem throws', () => {
    const bad = { getItem: () => { throw new Error('blocked'); } };
    expect(isDismissed(bad)).toBe(false);
  });
});

// ── markDismissed ────────────────────────────────────────────────────────────

describe('markDismissed', () => {
  it('sets dismiss key with current timestamp', () => {
    const storage = makeStorage();
    const before = Date.now();
    markDismissed(storage);
    const after = Date.now();
    expect(storage.setItem).toHaveBeenCalledWith(DISMISS_KEY, expect.any(String));
    const stored = parseInt(storage.setItem.mock.calls[0][1], 10);
    expect(stored).toBeGreaterThanOrEqual(before);
    expect(stored).toBeLessThanOrEqual(after);
  });

  it('does not throw when storage is null', () => {
    expect(() => markDismissed(null)).not.toThrow();
  });

  it('does not throw when setItem throws', () => {
    const bad = { setItem: () => { throw new Error('quota'); } };
    expect(() => markDismissed(bad)).not.toThrow();
  });
});

// ── formatCountdown ──────────────────────────────────────────────────────────

describe('formatCountdown', () => {
  it('formats 0ms as 00:00:00:00', () => {
    expect(formatCountdown(0)).toBe('00:00:00:00');
  });

  it('formats negative ms as 00:00:00:00', () => {
    expect(formatCountdown(-5000)).toBe('00:00:00:00');
  });

  it('formats 1 second', () => {
    expect(formatCountdown(1000)).toBe('00:00:00:01');
  });

  it('formats 1 minute', () => {
    expect(formatCountdown(60 * 1000)).toBe('00:00:01:00');
  });

  it('formats 1 hour', () => {
    expect(formatCountdown(3600 * 1000)).toBe('00:01:00:00');
  });

  it('formats 1 day', () => {
    expect(formatCountdown(86400 * 1000)).toBe('01:00:00:00');
  });

  it('formats 2d 3h 4m 5s', () => {
    const ms = (2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000;
    expect(formatCountdown(ms)).toBe('02:03:04:05');
  });

  it('pads single-digit values', () => {
    expect(formatCountdown(1 * 1000)).toBe('00:00:00:01');
  });
});

// ── startCountdown ───────────────────────────────────────────────────────────

describe('startCountdown', () => {
  it('sets countdown text immediately on first tick', () => {
    const $w = make$w();
    const endDate = new Date(Date.now() + 10000);
    const setIntervalFn = vi.fn(() => 42);
    const clearIntervalFn = vi.fn();
    startCountdown($w, '#saleLightboxCountdown', endDate, setIntervalFn, clearIntervalFn);
    expect($w('#saleLightboxCountdown').text).toMatch(/\d{2}:\d{2}:\d{2}:\d{2}/);
  });

  it('calls setInterval with 1000ms', () => {
    const $w = make$w();
    const setIntervalFn = vi.fn(() => 99);
    const clearIntervalFn = vi.fn();
    startCountdown($w, '#saleLightboxCountdown', new Date(Date.now() + 10000), setIntervalFn, clearIntervalFn);
    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it('returned cleanup calls clearInterval', () => {
    const $w = make$w();
    const setIntervalFn = vi.fn(() => 123);
    const clearIntervalFn = vi.fn();
    const stop = startCountdown($w, '#saleLightboxCountdown', new Date(Date.now() + 10000), setIntervalFn, clearIntervalFn);
    stop();
    expect(clearIntervalFn).toHaveBeenCalledWith(123);
  });

  it('does not throw when element absent', () => {
    const $w = () => { throw new Error('not found'); };
    const setIntervalFn = vi.fn(() => 1);
    expect(() => startCountdown($w, '#missing', new Date(Date.now() + 5000), setIntervalFn, vi.fn())).not.toThrow();
  });
});

// ── initSaleLightbox ─────────────────────────────────────────────────────────

describe('initSaleLightbox', () => {
  let $w, storage, getActivePromotion, navigate, setTimeoutFn, setIntervalFn, clearIntervalFn;

  beforeEach(() => {
    $w = make$w();
    storage = makeStorage();
    getActivePromotion = vi.fn().mockResolvedValue({ ...PROMO });
    navigate = vi.fn();
    setTimeoutFn = vi.fn();
    setIntervalFn = vi.fn(() => 1);
    clearIntervalFn = vi.fn();
  });

  const opts = () => ({
    $w,
    storage,
    getActivePromotion,
    navigate,
    setTimeout: setTimeoutFn,
    setInterval: setIntervalFn,
    clearInterval: clearIntervalFn,
    prefersReducedMotion: false,
  });

  it('does not show if already dismissed', async () => {
    markDismissed(storage);
    await initSaleLightbox(opts());
    expect(setTimeoutFn).not.toHaveBeenCalled();
  });

  it('does not show if no active promo', async () => {
    getActivePromotion.mockResolvedValue(null);
    await initSaleLightbox(opts());
    expect(setTimeoutFn).not.toHaveBeenCalled();
  });

  it('does not show if getActivePromotion throws', async () => {
    getActivePromotion.mockRejectedValue(new Error('network'));
    await initSaleLightbox(opts());
    expect(setTimeoutFn).not.toHaveBeenCalled();
  });

  it('populates headline from promo.title', async () => {
    await initSaleLightbox(opts());
    expect($w('#saleLightboxHeadline').text).toBe('Spring Sale');
  });

  it('populates subtitle from promo.subtitle', async () => {
    await initSaleLightbox(opts());
    expect($w('#saleLightboxSubtitle').text).toBe('30% off everything');
  });

  it('populates image from promo.heroImage', async () => {
    await initSaleLightbox(opts());
    expect($w('#saleLightboxImage').src).toBe('https://example.com/spring.jpg');
  });

  it('populates CTA label from promo.ctaText', async () => {
    await initSaleLightbox(opts());
    expect($w('#saleLightboxCTA').label).toBe('Shop Now');
  });

  it('defaults headline to "Spring Sale" when promo.title absent', async () => {
    getActivePromotion.mockResolvedValue({ ...PROMO, title: undefined });
    await initSaleLightbox(opts());
    expect($w('#saleLightboxHeadline').text).toBe('Spring Sale');
  });

  it('defaults CTA label to "Shop Now" when promo.ctaText absent', async () => {
    getActivePromotion.mockResolvedValue({ ...PROMO, ctaText: undefined });
    await initSaleLightbox(opts());
    expect($w('#saleLightboxCTA').label).toBe('Shop Now');
  });

  it('schedules show via setTimeout after SHOW_DELAY_MS', async () => {
    await initSaleLightbox(opts());
    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), SHOW_DELAY_MS);
  });

  it('shows overlay when setTimeout fires (not dismissed)', async () => {
    await initSaleLightbox(opts());
    const timerCb = setTimeoutFn.mock.calls[0][0];
    timerCb();
    expect($w('#saleLightboxOverlay').show).toHaveBeenCalled();
  });

  it('does not show overlay if dismissed before timer fires', async () => {
    await initSaleLightbox(opts());
    markDismissed(storage);
    const timerCb = setTimeoutFn.mock.calls[0][0];
    timerCb();
    expect($w('#saleLightboxOverlay').show).not.toHaveBeenCalled();
  });

  it('starts countdown when promo has endDate', async () => {
    await initSaleLightbox(opts());
    expect(setIntervalFn).toHaveBeenCalled();
  });

  it('hides countdown element when promo has no endDate', async () => {
    getActivePromotion.mockResolvedValue({ ...PROMO, endDate: undefined });
    await initSaleLightbox(opts());
    expect($w('#saleLightboxCountdown').hide).toHaveBeenCalled();
  });

  it('wires CTA onClick', async () => {
    await initSaleLightbox(opts());
    expect($w('#saleLightboxCTA').onClick).toHaveBeenCalled();
  });

  it('CTA click marks dismissed and navigates to ctaUrl', async () => {
    await initSaleLightbox(opts());
    const ctaCb = $w('#saleLightboxCTA').onClick.mock.calls[0][0];
    ctaCb();
    expect(navigate).toHaveBeenCalledWith('/spring-sale');
    expect(isDismissed(storage)).toBe(true);
  });

  it('CTA click defaults to /spring-sale when ctaUrl absent', async () => {
    getActivePromotion.mockResolvedValue({ ...PROMO, ctaUrl: undefined });
    await initSaleLightbox(opts());
    const ctaCb = $w('#saleLightboxCTA').onClick.mock.calls[0][0];
    ctaCb();
    expect(navigate).toHaveBeenCalledWith('/spring-sale');
  });

  it('uses fade animation by default', async () => {
    await initSaleLightbox(opts());
    const timerCb = setTimeoutFn.mock.calls[0][0];
    timerCb();
    expect($w('#saleLightboxOverlay').show).toHaveBeenCalledWith('fade', { duration: 400 });
  });

  it('uses 0-duration fade when prefersReducedMotion is true', async () => {
    await initSaleLightbox({ ...opts(), prefersReducedMotion: true });
    const timerCb = setTimeoutFn.mock.calls[0][0];
    timerCb();
    expect($w('#saleLightboxOverlay').show).toHaveBeenCalledWith('fade', { duration: 0 });
  });
});
