/**
 * @file masterPageLivingSky.test.js
 * @description CF-hw7: TDD tests for Phase 7 living sky wiring in masterPage.js.
 *
 * Covers:
 *  - detectWeatherSeed: deterministic output, valid type, 7-day cycle distribution
 *  - initLivingSky called on page load with weather seed
 *  - tickLivingSky called every 30s via setInterval (fake timers)
 *  - Graceful degradation when living-sky-wix.js import throws
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted setup — must run before any module evaluation ────────────────────

const { mockInitLivingSky, mockTickLivingSky } = vi.hoisted(() => ({
  mockInitLivingSky: vi.fn(),
  mockTickLivingSky: vi.fn(),
}));

// $w must be set before masterPage.js is imported
const { getOnReadyHandler, clearElements } = vi.hoisted(() => {
  let _handler = null;
  const elements = new Map();

  function mockEl(sel) {
    if (!elements.has(sel)) {
      elements.set(sel, {
        _id: sel, text: '', src: '', hidden: true,
        style: { color: '', fontWeight: '', boxShadow: '', backgroundColor: '' },
        accessibility: {},
        show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
        collapse: vi.fn(), expand: vi.fn(), focus: vi.fn(), scrollTo: vi.fn(),
        postMessage: vi.fn(), onClick: vi.fn(), onKeyPress: vi.fn(),
        onMouseIn: vi.fn(), onMouseOut: vi.fn(), onChange: vi.fn(),
        onFocus: vi.fn(), onBlur: vi.fn(), onItemReady: vi.fn(),
        disable: vi.fn(), enable: vi.fn(),
      });
    }
    return elements.get(sel);
  }

  globalThis.$w = Object.assign((sel) => mockEl(sel), {
    onReady: (fn) => { _handler = fn; },
  });

  return {
    getOnReadyHandler: () => _handler,
    clearElements: () => elements.clear(),
  };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('public/living-sky-wix.js', () => ({
  initLivingSky: mockInitLivingSky,
  tickLivingSky: mockTickLivingSky,
}));

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn().mockResolvedValue('{}'),
  getWebSiteSchema: vi.fn().mockResolvedValue('{}'),
}));
vi.mock('backend/promotions.web', () => ({
  getActivePromotion: vi.fn().mockResolvedValue(null),
  getFlashSales: vi.fn().mockResolvedValue([]),
}));
vi.mock('backend/announcementBarService.web', () => ({
  getActiveAnnouncementBars: vi.fn().mockResolvedValue([]),
}));
vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn().mockResolvedValue({}),
}));
vi.mock('backend/coreWebVitals.web', () => ({
  reportMetrics: vi.fn().mockResolvedValue({}),
}));
vi.mock('wix-location-frontend', () => ({
  default: { path: [], to: vi.fn() },
}));
vi.mock('public/cartService', () => ({
  getCurrentCart: vi.fn().mockResolvedValue({ lineItems: [] }),
  onCartChanged: vi.fn(),
  getShippingProgress: vi.fn(() => ({ remaining: 999, progressPct: 0, qualifies: false })),
  isFreeShippingEnabled: vi.fn(() => false),
}));
vi.mock('public/miniCartDrawer', () => ({
  initMiniCartDrawer: vi.fn(),
  openMiniCart: vi.fn(),
  closeMiniCart: vi.fn(),
  updateCartCount: vi.fn(),
}));
vi.mock('public/performanceHelpers', () => ({
  sharePromise: (fn) => fn,
  deferInit: (fn) => fn(),
}));
vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  getViewport: vi.fn(() => 'desktop'),
}));
vi.mock('public/engagementTracker', () => ({ trackEvent: vi.fn() }));
vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: vi.fn(),
  initScrollDepthTracking: vi.fn(() => vi.fn()),
}));
vi.mock('public/designTokens.js', () => ({ colors: {}, typography: {}, spacing: {} }));
vi.mock('public/pwaHelpers', () => ({
  captureInstallPrompt: vi.fn(),
  canShowInstallPrompt: vi.fn(() => false),
  showInstallPrompt: vi.fn(),
  isInstalledPWA: vi.fn(() => false),
}));
vi.mock('public/FooterSection', () => ({ initFooter: vi.fn() }));
vi.mock('public/CartUpsell', () => ({ initCartUpsell: vi.fn() }));
vi.mock('public/pixelConsentService', () => ({
  initConsentGate: vi.fn(),
  fireTrackedTikTokEvent: vi.fn(),
}));
vi.mock('public/carolinaFutonsLogo', () => ({ getLogoImageUrl: vi.fn(() => '') }));
vi.mock('public/a11yHelpers', () => ({
  initSkipNav: vi.fn(),
  setupAccessibleDialog: vi.fn(),
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));
vi.mock('public/navigationHelpers', () => ({
  applyActiveNavState: vi.fn(),
  initMegaMenu: vi.fn(),
  initMobileDrawer: vi.fn(),
  initFooterAccordions: vi.fn(),
  initAnnouncementBar: vi.fn(),
  initBackToTop: vi.fn(),
  initStickyNav: vi.fn(),
  breadcrumbsFromPath: vi.fn(() => []),
  renderBreadcrumbs: vi.fn(),
}));
vi.mock('public/tikTokPixel', () => ({ initTikTokPixel: vi.fn() }));
vi.mock('public/LiveChat.js', () => ({ initLiveChat: vi.fn() }));
vi.mock('public/proactiveChatTriggers.js', () => ({ initProactiveTriggers: vi.fn() }));

// ── Import under test ─────────────────────────────────────────────────────────
// $w is already set in vi.hoisted() above, so this static import is safe

import { detectWeatherSeed } from '../src/pages/masterPage.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeDateWithDayOfYear(year, dayOfYear) {
  const d = new Date(year, 0, 1);
  d.setDate(d.getDate() + dayOfYear - 1);
  return d;
}

/** Wait for a condition to become true, polling until timeout */
async function waitFor(fn, timeout = 500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { fn(); return; } catch {}
    await new Promise(r => setTimeout(r, 10));
  }
  fn(); // final attempt — let it throw the assertion error
}

/** Flush enough microtask ticks for dynamic imports + .then() chains to resolve */
async function flushImportMicrotasks() {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

// ── detectWeatherSeed — determinism ──────────────────────────────────────────

describe('detectWeatherSeed — determinism', () => {
  it('returns the same result for the same date called twice', () => {
    const date = new Date(2026, 2, 23);
    expect(detectWeatherSeed(date)).toBe(detectWeatherSeed(date));
  });

  it('returns the same result for two Date objects with identical values', () => {
    const a = new Date(2026, 5, 15);
    const b = new Date(2026, 5, 15);
    expect(detectWeatherSeed(a)).toBe(detectWeatherSeed(b));
  });

  it('produces at least 2 distinct weather types across 7 consecutive days', () => {
    const results = new Set();
    for (let day = 1; day <= 7; day++) {
      results.add(detectWeatherSeed(makeDateWithDayOfYear(2026, day)));
    }
    expect(results.size).toBeGreaterThanOrEqual(2);
  });
});

// ── detectWeatherSeed — valid output ─────────────────────────────────────────

describe('detectWeatherSeed — valid output', () => {
  const VALID_TYPES = ['clear', 'cloudy', 'fog', 'rain', 'storm'];

  it('always returns a valid weather type across all months', () => {
    for (let month = 0; month < 12; month++) {
      expect(VALID_TYPES).toContain(detectWeatherSeed(new Date(2026, month, 15)));
    }
  });

  it('returns valid types across a range of years', () => {
    for (let year = 2020; year <= 2030; year++) {
      expect(VALID_TYPES).toContain(detectWeatherSeed(new Date(year, 6, 1)));
    }
  });
});

// ── detectWeatherSeed — 7-day cycle ──────────────────────────────────────────

describe('detectWeatherSeed — 7-day cycle', () => {
  it('two dates with the same (year + dayOfYear) % 7 produce the same type', () => {
    // dayOfYear 10 and 17 differ by 7 → same slot
    const date1 = makeDateWithDayOfYear(2026, 10);
    const date2 = makeDateWithDayOfYear(2026, 17);
    expect(detectWeatherSeed(date1)).toBe(detectWeatherSeed(date2));
  });

  it('clear is the most common type in any 7-day cycle', () => {
    const counts = {};
    for (let day = 1; day <= 7; day++) {
      const type = detectWeatherSeed(makeDateWithDayOfYear(2026, day));
      counts[type] = (counts[type] || 0) + 1;
    }
    const clearCount = counts['clear'] || 0;
    const otherMax = Math.max(0, ...Object.entries(counts)
      .filter(([k]) => k !== 'clear')
      .map(([, v]) => v));
    expect(clearCount).toBeGreaterThan(otherMax);
  });
});

// ── Living sky wiring — page load ────────────────────────────────────────────

describe('masterPage — living sky wiring on page load', () => {
  beforeEach(() => {
    mockInitLivingSky.mockClear();
    mockTickLivingSky.mockClear();
    clearElements();
  });

  it('calls initLivingSky once on page load', async () => {
    await getOnReadyHandler()();
    await waitFor(() => expect(mockInitLivingSky).toHaveBeenCalledTimes(1));
  });

  it('passes a weather option to initLivingSky', async () => {
    await getOnReadyHandler()();
    await waitFor(() => expect(mockInitLivingSky).toHaveBeenCalledWith(
      expect.objectContaining({ weather: expect.any(String) })
    ));
  });

  it('weather passed to initLivingSky is a valid weather type', async () => {
    await getOnReadyHandler()();
    await waitFor(() => expect(mockInitLivingSky.mock.calls.length).toBeGreaterThan(0));
    const [opts] = mockInitLivingSky.mock.calls[0];
    expect(['clear', 'cloudy', 'fog', 'rain', 'storm']).toContain(opts.weather);
  });
});

// ── Living sky wiring — tick interval ────────────────────────────────────────

describe('masterPage — tickLivingSky interval', () => {
  let intervalSpy;

  beforeEach(() => {
    mockInitLivingSky.mockClear();
    mockTickLivingSky.mockClear();
    clearElements();
    intervalSpy = vi.spyOn(globalThis, 'setInterval');
  });

  afterEach(() => {
    intervalSpy.mockRestore();
  });

  it('registers a 30s setInterval for tickLivingSky', async () => {
    await getOnReadyHandler()();
    await waitFor(() => {
      const thirtySecCalls = intervalSpy.mock.calls.filter(([, ms]) => ms === 30_000);
      expect(thirtySecCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('the 30s interval callback calls tickLivingSky', async () => {
    await getOnReadyHandler()();
    await waitFor(() => {
      const call = intervalSpy.mock.calls.find(([, ms]) => ms === 30_000);
      expect(call).toBeDefined();
    });
    const [fn] = intervalSpy.mock.calls.find(([, ms]) => ms === 30_000);
    fn();
    expect(mockTickLivingSky).toHaveBeenCalledTimes(1);
  });

  it('calling the interval callback twice fires tickLivingSky twice', async () => {
    await getOnReadyHandler()();
    await waitFor(() => {
      expect(intervalSpy.mock.calls.some(([, ms]) => ms === 30_000)).toBe(true);
    });
    const [fn] = intervalSpy.mock.calls.find(([, ms]) => ms === 30_000);
    fn(); fn();
    expect(mockTickLivingSky).toHaveBeenCalledTimes(2);
  });
});

// ── Graceful degradation ──────────────────────────────────────────────────────

describe('masterPage — graceful degradation when living-sky-wix unavailable', () => {
  beforeEach(() => {
    clearElements();
  });

  it('does not throw when initLivingSky rejects', async () => {
    mockInitLivingSky.mockRejectedValueOnce(new Error('Module unavailable'));
    await getOnReadyHandler()();
    await flushImportMicrotasks();
    // Reaching here means the page onReady did not throw
    expect(true).toBe(true);
  });

  it('page onReady completes even when initLivingSky throws synchronously', async () => {
    mockInitLivingSky.mockImplementationOnce(() => {
      throw new Error('import failed');
    });
    await getOnReadyHandler()();
    await flushImportMicrotasks();
    expect(true).toBe(true);
  });
});
