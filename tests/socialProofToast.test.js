/**
 * Tests for socialProofToast.js — Social proof toast notification system
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanupToast } from '../src/public/socialProofToast.js';

// Mock the backend imports
vi.mock('backend/socialProof.web', () => ({
  getProductSocialProof: vi.fn(),
  getCategorySocialProof: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

describe('cleanupToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not throw when called with no active timer', () => {
    expect(() => cleanupToast()).not.toThrow();
  });

  it('can be called multiple times safely', () => {
    cleanupToast();
    cleanupToast();
    cleanupToast();
  });
});

// Test initProductSocialProof via dynamic import to get fresh module state
describe('initProductSocialProof', () => {
  let initProductSocialProof;
  let getProductSocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initProductSocialProof = mod.initProductSocialProof;
    const backend = await import('backend/socialProof.web');
    getProductSocialProof = backend.getProductSocialProof;
    getProductSocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('does nothing when productId is null/empty', async () => {
    await initProductSocialProof(() => null, null);
    await initProductSocialProof(() => null, '');
    expect(getProductSocialProof).not.toHaveBeenCalled();
  });

  it('calls backend with productId', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [],
      config: { maxPerSession: 3, minIntervalMs: 5000, autoDismissMs: 8000 },
    });
    await initProductSocialProof(() => null, 'prod-123', 'Test Product');
    expect(getProductSocialProof).toHaveBeenCalledWith('prod-123', 'Test Product');
  });

  it('does nothing when no notifications returned', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [],
      config: { maxPerSession: 3, minIntervalMs: 5000, autoDismissMs: 8000 },
    });
    const $w = vi.fn(() => null);
    await initProductSocialProof($w, 'prod-123');
    vi.advanceTimersByTime(10000);
    // No toast shown — $w not called for toast elements
  });

  it('does not throw when backend errors', async () => {
    getProductSocialProof.mockRejectedValue(new Error('network'));
    await expect(initProductSocialProof(() => null, 'prod-123')).resolves.not.toThrow();
  });
});

describe('initCategorySocialProof', () => {
  let initCategorySocialProof;
  let getCategorySocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initCategorySocialProof = mod.initCategorySocialProof;
    const backend = await import('backend/socialProof.web');
    getCategorySocialProof = backend.getCategorySocialProof;
    getCategorySocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('does nothing when categorySlug is null/empty', async () => {
    await initCategorySocialProof(() => null, null);
    await initCategorySocialProof(() => null, '');
    expect(getCategorySocialProof).not.toHaveBeenCalled();
  });

  it('does not throw on backend error', async () => {
    getCategorySocialProof.mockRejectedValue(new Error('fail'));
    await expect(initCategorySocialProof(() => null, 'futon-frames')).resolves.not.toThrow();
  });

  it('builds low_stock notification from lowStockProducts', async () => {
    getCategorySocialProof.mockResolvedValue({
      recentSalesCount: 0,
      lowStockProducts: [{ productName: 'Kodiak Frame', quantity: 2 }],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 5000 },
    });

    const elements = {};
    const $w = (sel) => {
      if (!elements[sel]) {
        elements[sel] = {
          text: '',
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn(),
          style: {},
          accessibility: {},
        };
      }
      return elements[sel];
    };

    await initCategorySocialProof($w, 'futon-frames');
    vi.advanceTimersByTime(6000);

    expect(elements['#socialProofMessage'].text).toContain('Kodiak Frame');
    expect(elements['#socialProofMessage'].text).toContain('2');
    expect(elements['#socialProofToast'].show).toHaveBeenCalled();
  });

  it('builds recent_purchase notification when salesCount >= 3 and no low stock', async () => {
    getCategorySocialProof.mockResolvedValue({
      recentSalesCount: 7,
      lowStockProducts: [],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 5000 },
    });

    const elements = {};
    const $w = (sel) => {
      if (!elements[sel]) {
        elements[sel] = {
          text: '',
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn(),
          style: {},
          accessibility: {},
        };
      }
      return elements[sel];
    };

    await initCategorySocialProof($w, 'mattresses');
    vi.advanceTimersByTime(6000);

    expect(elements['#socialProofMessage'].text).toContain('7');
    expect(elements['#socialProofMessage'].text).toContain('orders');
  });

  it('returns null notification when no signals', async () => {
    getCategorySocialProof.mockResolvedValue({
      recentSalesCount: 1,
      lowStockProducts: [],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 5000 },
    });

    const showFn = vi.fn();
    const $w = () => ({ text: '', show: showFn, hide: vi.fn(), onClick: vi.fn(), style: {}, accessibility: {} });

    await initCategorySocialProof($w, 'covers');
    vi.advanceTimersByTime(6000);

    // Toast should NOT show — no notification built
    expect(showFn).not.toHaveBeenCalled();
  });
});

describe('showToast — session frequency capping', () => {
  let initProductSocialProof;
  let getProductSocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initProductSocialProof = mod.initProductSocialProof;
    const backend = await import('backend/socialProof.web');
    getProductSocialProof = backend.getProductSocialProof;
    getProductSocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('respects maxPerSession cap', async () => {
    // Set session state to already at max
    sessionStorage.setItem('cf_social_proof', JSON.stringify({ count: 5, lastShown: 0 }));

    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'recent_purchase', message: 'Someone bought', priority: 1 }],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 5000 },
    });

    const showFn = vi.fn();
    const $w = () => ({ text: '', show: showFn, hide: vi.fn(), onClick: vi.fn(), style: {}, accessibility: {} });

    await initProductSocialProof($w, 'prod-1');
    vi.advanceTimersByTime(10000);

    // Should NOT show — session cap reached
    expect(showFn).not.toHaveBeenCalled();
  });

  it('increments session count after showing toast', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'recent_purchase', message: 'Someone bought', priority: 1 }],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 5000 },
    });

    const elements = {};
    const $w = (sel) => {
      if (!elements[sel]) {
        elements[sel] = {
          text: '',
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn(),
          style: {},
          accessibility: {},
        };
      }
      return elements[sel];
    };

    await initProductSocialProof($w, 'prod-2', 'Test Product');
    vi.advanceTimersByTime(5000);

    const state = JSON.parse(sessionStorage.getItem('cf_social_proof'));
    expect(state.count).toBe(1);
    expect(state.lastShown).toBeGreaterThan(0);
  });
});

describe('showToast — icon types', () => {
  let initProductSocialProof;
  let getProductSocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initProductSocialProof = mod.initProductSocialProof;
    const backend = await import('backend/socialProof.web');
    getProductSocialProof = backend.getProductSocialProof;
    getProductSocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('sets star icon for review_count type', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'review_count', message: '12 reviews', priority: 4 }],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 5000 },
    });

    const elements = {};
    const $w = (sel) => {
      if (!elements[sel]) {
        elements[sel] = {
          text: '',
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn(),
          style: {},
          accessibility: {},
        };
      }
      return elements[sel];
    };

    await initProductSocialProof($w, 'prod-star');
    vi.advanceTimersByTime(5000);

    // Star icon for review_count
    expect(elements['#socialProofIcon'].text).toBe('\u2B50');
  });

  it('auto-dismisses toast after configured time', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'recent_purchase', message: 'Someone bought', priority: 1 }],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 3000 },
    });

    const elements = {};
    const $w = (sel) => {
      if (!elements[sel]) {
        elements[sel] = {
          text: '',
          show: vi.fn(),
          hide: vi.fn(() => Promise.resolve()),
          onClick: vi.fn(),
          style: {},
          accessibility: {},
        };
      }
      return elements[sel];
    };

    await initProductSocialProof($w, 'prod-dismiss');
    vi.advanceTimersByTime(4000); // past initial delay
    vi.advanceTimersByTime(4000); // past auto-dismiss

    expect(elements['#socialProofToast'].hide).toHaveBeenCalled();
  });
});
