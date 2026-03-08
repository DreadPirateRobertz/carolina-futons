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

describe('showToast — minIntervalMs frequency capping', () => {
  let initProductSocialProof;
  let getProductSocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initProductSocialProof = mod.initProductSocialProof;
    mod.cleanupToast();
    const backend = await import('backend/socialProof.web');
    getProductSocialProof = backend.getProductSocialProof;
    getProductSocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('does not show toast if minIntervalMs has not elapsed since last shown', async () => {
    // Pre-set lastShown to very recent
    sessionStorage.setItem('cf_social_proof', JSON.stringify({ count: 0, lastShown: Date.now() }));

    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'recent_purchase', message: 'Someone bought', priority: 1 }],
      config: { maxPerSession: 5, minIntervalMs: 60000, autoDismissMs: 5000 },
    });

    const showFn = vi.fn();
    const $w = () => ({ text: '', show: showFn, hide: vi.fn(), onClick: vi.fn(), style: {}, accessibility: {} });

    await initProductSocialProof($w, 'prod-freq');
    vi.advanceTimersByTime(10000); // past delay but within minInterval

    expect(showFn).not.toHaveBeenCalled();
  });
});

describe('showToast — close handler', () => {
  let initProductSocialProof;
  let getProductSocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initProductSocialProof = mod.initProductSocialProof;
    mod.cleanupToast();
    const backend = await import('backend/socialProof.web');
    getProductSocialProof = backend.getProductSocialProof;
    getProductSocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('binds close handler that hides toast and clears dismiss timer', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'recent_purchase', message: 'Someone bought', priority: 1 }],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 10000 },
    });

    let closeHandler;
    const elements = {};
    const $w = (sel) => {
      if (!elements[sel]) {
        elements[sel] = {
          text: '',
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn((fn) => { closeHandler = fn; }),
          style: {},
          accessibility: {},
        };
      }
      return elements[sel];
    };

    await initProductSocialProof($w, 'prod-close');
    vi.advanceTimersByTime(5000);

    // Close handler should have been bound
    expect(closeHandler).toBeDefined();

    // Simulate user clicking close
    closeHandler();
    expect(elements['#socialProofToast'].hide).toHaveBeenCalled();
  });
});

describe('showToast — missing elements', () => {
  let initProductSocialProof;
  let getProductSocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initProductSocialProof = mod.initProductSocialProof;
    mod.cleanupToast();
    const backend = await import('backend/socialProof.web');
    getProductSocialProof = backend.getProductSocialProof;
    getProductSocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('does not throw when $w returns null elements', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'recent_purchase', message: 'Someone bought', priority: 1 }],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 5000 },
    });

    const $w = () => null;

    await initProductSocialProof($w, 'prod-null-el');
    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
  });
});

describe('buildCategoryNotification — urgency levels', () => {
  let initCategorySocialProof;
  let getCategorySocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initCategorySocialProof = mod.initCategorySocialProof;
    mod.cleanupToast();
    const backend = await import('backend/socialProof.web');
    getCategorySocialProof = backend.getCategorySocialProof;
    getCategorySocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('shows warning icon for low_stock type', async () => {
    getCategorySocialProof.mockResolvedValue({
      recentSalesCount: 0,
      lowStockProducts: [{ productName: 'Low Item', quantity: 1 }],
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

    await initCategorySocialProof($w, 'beds');
    vi.advanceTimersByTime(6000);

    expect(elements['#socialProofIcon'].text).toBe('\u26A0');
  });

  it('shows checkmark icon for recent_purchase type', async () => {
    getCategorySocialProof.mockResolvedValue({
      recentSalesCount: 5,
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

    await initCategorySocialProof($w, 'frames');
    vi.advanceTimersByTime(6000);

    expect(elements['#socialProofIcon'].text).toBe('\u2705');
  });

  it('prioritizes low_stock over recent_purchase when salesCount >= 3', async () => {
    getCategorySocialProof.mockResolvedValue({
      recentSalesCount: 10,
      lowStockProducts: [{ productName: 'Last One', quantity: 1 }],
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

    await initCategorySocialProof($w, 'beds');
    vi.advanceTimersByTime(6000);

    // low_stock takes priority
    expect(elements['#socialProofMessage'].text).toContain('Last One');
    expect(elements['#socialProofIcon'].text).toBe('\u26A0');
  });

  it('does not build notification when salesCount < 3 and no low stock', async () => {
    getCategorySocialProof.mockResolvedValue({
      recentSalesCount: 2,
      lowStockProducts: [],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 5000 },
    });

    const showFn = vi.fn();
    const $w = () => ({ text: '', show: showFn, hide: vi.fn(), onClick: vi.fn(), style: {}, accessibility: {} });

    await initCategorySocialProof($w, 'covers');
    vi.advanceTimersByTime(6000);

    expect(showFn).not.toHaveBeenCalled();
  });

  it('builds notification when salesCount is exactly 3', async () => {
    getCategorySocialProof.mockResolvedValue({
      recentSalesCount: 3,
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

    await initCategorySocialProof($w, 'frames');
    vi.advanceTimersByTime(6000);

    expect(elements['#socialProofMessage'].text).toContain('3');
    expect(elements['#socialProofMessage'].text).toContain('orders');
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

  it('sets default eye icon for unknown notification type', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'unknown_type', message: 'Something happened', priority: 1 }],
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

    await initProductSocialProof($w, 'prod-eye');
    vi.advanceTimersByTime(5000);

    expect(elements['#socialProofIcon'].text).toBe('\uD83D\uDC41'); // Eye icon
  });

  it('calls announce for screen reader accessibility', async () => {
    const { announce } = await import('public/a11yHelpers');
    announce.mockReset();

    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'recent_purchase', message: 'Accessible toast', priority: 1 }],
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

    await initProductSocialProof($w, 'prod-a11y');
    vi.advanceTimersByTime(5000);

    expect(announce).toHaveBeenCalledWith(expect.any(Function), 'Accessible toast', 'polite');
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

describe('showToast — manual close handler', () => {
  let initProductSocialProof;
  let getProductSocialProof;

  beforeEach(async () => {
    vi.useFakeTimers();
    sessionStorage.clear();
    const mod = await import('../src/public/socialProofToast.js');
    initProductSocialProof = mod.initProductSocialProof;
    mod.cleanupToast(); // Reset _closeHandlerBound
    const backend = await import('backend/socialProof.web');
    getProductSocialProof = backend.getProductSocialProof;
    getProductSocialProof.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanupToast();
  });

  it('binds close handler on first show and hides toast on click', async () => {
    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'recent_purchase', message: 'Test', priority: 1 }],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 10000 },
    });

    let closeClickHandler;
    const elements = {};
    const $w = (sel) => {
      if (!elements[sel]) {
        elements[sel] = {
          text: '',
          show: vi.fn(),
          hide: vi.fn(),
          onClick: vi.fn((handler) => { closeClickHandler = handler; }),
          style: {},
          accessibility: {},
        };
      }
      return elements[sel];
    };

    await initProductSocialProof($w, 'prod-close');
    vi.advanceTimersByTime(5000);

    // Close handler should have been bound
    expect(elements['#socialProofClose'].onClick).toHaveBeenCalled();

    // Trigger close — assert handler was captured, then invoke it
    expect(closeClickHandler).toBeDefined();
    closeClickHandler();
    expect(elements['#socialProofToast'].hide).toHaveBeenCalled();
  });
});

describe('session state — corrupt storage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
    cleanupToast();
  });

  it('handles corrupt sessionStorage JSON gracefully', async () => {
    sessionStorage.setItem('cf_social_proof', 'NOT_JSON!!!');

    const { getProductSocialProof } = await import('backend/socialProof.web');
    getProductSocialProof.mockReset();
    getProductSocialProof.mockResolvedValue({
      notifications: [{ type: 'recent_purchase', message: 'Test', priority: 1 }],
      config: { maxPerSession: 5, minIntervalMs: 1000, autoDismissMs: 5000 },
    });

    const mod = await import('../src/public/socialProofToast.js');

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

    // Should not throw despite corrupt storage
    await expect(mod.initProductSocialProof($w, 'prod-corrupt')).resolves.not.toThrow();
  });
});
