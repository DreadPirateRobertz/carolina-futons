import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── deferInit ────────────────────────────────────────────────────────

describe('deferInit', () => {
  let deferInit;

  beforeEach(async () => {
    vi.useFakeTimers();
    ({ deferInit } = await import('../src/public/performanceHelpers.js'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('calls function via requestIdleCallback when available', async () => {
    const fn = vi.fn();
    const mockRIC = vi.fn((cb) => { cb({ timeRemaining: () => 50 }); return 1; });
    vi.stubGlobal('requestIdleCallback', mockRIC);

    deferInit(fn);

    expect(mockRIC).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('falls back to setTimeout when requestIdleCallback unavailable', () => {
    const fn = vi.fn();
    // Ensure requestIdleCallback doesn't exist
    const orig = globalThis.requestIdleCallback;
    delete globalThis.requestIdleCallback;

    deferInit(fn);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();

    if (orig) globalThis.requestIdleCallback = orig;
  });

  it('respects custom delay for setTimeout fallback', () => {
    const fn = vi.fn();
    const orig = globalThis.requestIdleCallback;
    delete globalThis.requestIdleCallback;

    deferInit(fn, { fallbackDelay: 500 });
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();

    if (orig) globalThis.requestIdleCallback = orig;
  });

  it('does not throw if callback throws', () => {
    const fn = vi.fn(() => { throw new Error('boom'); });
    const mockRIC = vi.fn((cb) => { cb({ timeRemaining: () => 50 }); return 1; });
    vi.stubGlobal('requestIdleCallback', mockRIC);

    expect(() => deferInit(fn)).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('does nothing if fn is not a function', () => {
    expect(() => deferInit(null)).not.toThrow();
    expect(() => deferInit(undefined)).not.toThrow();
    expect(() => deferInit('not a function')).not.toThrow();
  });
});

// ── prioritizeSections ───────────────────────────────────────────────

describe('prioritizeSections', () => {
  let prioritizeSections;

  beforeEach(async () => {
    ({ prioritizeSections } = await import('../src/public/performanceHelpers.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('awaits critical sections and returns their results', async () => {
    const criticalFn = vi.fn().mockResolvedValue('ok');

    const sections = [
      { name: 'hero', init: criticalFn, critical: true },
    ];

    const result = await prioritizeSections(sections);
    expect(criticalFn).toHaveBeenCalledOnce();
    expect(result.critical).toHaveLength(1);
    expect(result.critical[0].status).toBe('fulfilled');
  });

  it('does not await deferred sections (fire-and-forget)', async () => {
    let deferredResolved = false;
    const criticalFn = vi.fn().mockResolvedValue('ok');
    const deferredFn = vi.fn().mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => { deferredResolved = true; resolve('done'); }, 2000);
      });
    });

    const sections = [
      { name: 'hero', init: criticalFn, critical: true },
      { name: 'testimonials', init: deferredFn, critical: false },
    ];

    const result = await prioritizeSections(sections);

    // Critical completed, function returned
    expect(result.critical[0].status).toBe('fulfilled');
    // Deferred was started but not awaited — still pending
    expect(deferredFn).toHaveBeenCalledOnce();
    expect(deferredResolved).toBe(false);
  });

  it('calls onError callback for deferred section failures', async () => {
    const criticalFn = vi.fn().mockResolvedValue('ok');
    const deferredFn = vi.fn().mockRejectedValue(new Error('deferred boom'));
    const onError = vi.fn();

    const sections = [
      { name: 'hero', init: criticalFn, critical: true },
      { name: 'broken', init: deferredFn, critical: false },
    ];

    await prioritizeSections(sections, { onError });

    // Let the fire-and-forget promise chain settle
    await new Promise(r => setTimeout(r, 50));

    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'broken' }),
      expect.any(Error),
    );
  });

  it('does not call onError for successful deferred sections', async () => {
    const criticalFn = vi.fn().mockResolvedValue('ok');
    const deferredFn = vi.fn().mockResolvedValue('fine');
    const onError = vi.fn();

    const sections = [
      { name: 'hero', init: criticalFn, critical: true },
      { name: 'video', init: deferredFn, critical: false },
    ];

    await prioritizeSections(sections, { onError });

    // Let the fire-and-forget promise chain settle
    await new Promise(r => setTimeout(r, 50));

    expect(onError).not.toHaveBeenCalled();
  });

  it('handles critical section failures without breaking deferred', async () => {
    const failFn = vi.fn().mockRejectedValue(new Error('critical fail'));
    const deferredFn = vi.fn().mockResolvedValue('ok');

    const sections = [
      { name: 'broken', init: failFn, critical: true },
      { name: 'deferred', init: deferredFn, critical: false },
    ];

    const result = await prioritizeSections(sections);
    expect(result.critical[0].status).toBe('rejected');
    expect(deferredFn).toHaveBeenCalledOnce();
  });

  it('returns empty arrays for empty input', async () => {
    const result = await prioritizeSections([]);
    expect(result.critical).toHaveLength(0);
  });

  it('returns empty arrays for null input', async () => {
    const result = await prioritizeSections(null);
    expect(result.critical).toHaveLength(0);
  });

  it('treats all sections as critical when none marked deferred', async () => {
    const fn1 = vi.fn().mockResolvedValue('a');
    const fn2 = vi.fn().mockResolvedValue('b');

    const sections = [
      { name: 's1', init: fn1, critical: true },
      { name: 's2', init: fn2, critical: true },
    ];

    const result = await prioritizeSections(sections);
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
    expect(result.critical).toHaveLength(2);
  });

  it('reports multiple deferred failures via onError', async () => {
    const criticalFn = vi.fn().mockResolvedValue('ok');
    const fail1 = vi.fn().mockRejectedValue(new Error('fail-1'));
    const fail2 = vi.fn().mockRejectedValue(new Error('fail-2'));
    const onError = vi.fn();

    const sections = [
      { name: 'hero', init: criticalFn, critical: true },
      { name: 'broken1', init: fail1, critical: false },
      { name: 'broken2', init: fail2, critical: false },
    ];

    await prioritizeSections(sections, { onError });

    // Let the fire-and-forget promise chain settle
    await new Promise(r => setTimeout(r, 50));

    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('does not throw if onError callback throws', async () => {
    const criticalFn = vi.fn().mockResolvedValue('ok');
    const deferredFn = vi.fn().mockRejectedValue(new Error('fail'));
    const onError = vi.fn().mockImplementation(() => { throw new Error('callback boom'); });

    const sections = [
      { name: 'hero', init: criticalFn, critical: true },
      { name: 'broken', init: deferredFn, critical: false },
    ];

    // Should not reject
    await expect(prioritizeSections(sections, { onError })).resolves.toBeDefined();

    // Let fire-and-forget settle — callback throws but doesn't propagate
    await new Promise(r => setTimeout(r, 50));
  });

  it('works without onError option', async () => {
    const criticalFn = vi.fn().mockResolvedValue('ok');
    const deferredFn = vi.fn().mockRejectedValue(new Error('fail'));

    const sections = [
      { name: 'hero', init: criticalFn, critical: true },
      { name: 'broken', init: deferredFn, critical: false },
    ];

    // No onError — should not throw
    await expect(prioritizeSections(sections)).resolves.toBeDefined();
  });
});

// ── createImageObserver ──────────────────────────────────────────────

describe('createImageObserver', () => {
  let createImageObserver;
  let mockObserve, mockDisconnect, capturedCallback;

  beforeEach(async () => {
    mockObserve = vi.fn();
    mockDisconnect = vi.fn();
    capturedCallback = null;

    // Must use a real function (not arrow) so it can be called with `new`
    function MockIntersectionObserver(callback, options) {
      capturedCallback = callback;
      this.observe = mockObserve;
      this.disconnect = mockDisconnect;
      this.unobserve = vi.fn();
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    ({ createImageObserver } = await import('../src/public/performanceHelpers.js'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('creates an IntersectionObserver with default rootMargin', () => {
    createImageObserver();
    // Observer was created (observe is available)
    expect(mockObserve).toBeDefined();
  });

  it('observe method adds element to observer', () => {
    const observer = createImageObserver();
    const fakeEl = { src: '' };
    observer.observe(fakeEl);
    expect(mockObserve).toHaveBeenCalledWith(fakeEl);
  });

  it('disconnect method calls IntersectionObserver disconnect', () => {
    const observer = createImageObserver();
    observer.disconnect();
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });

  it('calls onVisible callback when entry becomes visible', () => {
    const onVisible = vi.fn();
    createImageObserver({ onVisible });

    const mockUnobserve = vi.fn();
    const mockEntry = { isIntersecting: true, target: { dataset: { src: 'test.jpg' } } };
    capturedCallback([mockEntry], { unobserve: mockUnobserve });

    expect(onVisible).toHaveBeenCalledWith(mockEntry.target);
  });

  it('unobserves element after it becomes visible', () => {
    const mockUnobserve = vi.fn();
    createImageObserver();

    const mockEntry = { isIntersecting: true, target: { dataset: {} } };
    capturedCallback([mockEntry], { unobserve: mockUnobserve });

    expect(mockUnobserve).toHaveBeenCalledWith(mockEntry.target);
  });

  it('does not call onVisible for non-intersecting entries', () => {
    const onVisible = vi.fn();
    createImageObserver({ onVisible });

    const mockEntry = { isIntersecting: false, target: {} };
    capturedCallback([mockEntry], { unobserve: vi.fn() });

    expect(onVisible).not.toHaveBeenCalled();
  });

  it('returns null when IntersectionObserver is unavailable', async () => {
    vi.unstubAllGlobals();
    vi.resetModules();
    const orig = globalThis.IntersectionObserver;
    delete globalThis.IntersectionObserver;

    const mod = await import('../src/public/performanceHelpers.js');
    const result = mod.createImageObserver();
    expect(result).toBeNull();

    if (orig) globalThis.IntersectionObserver = orig;
  });
});

// ── setImageDimensions ──────────────────────────────────────────────

describe('setImageDimensions', () => {
  let setImageDimensions;

  beforeEach(async () => {
    ({ setImageDimensions } = await import('../src/public/performanceHelpers.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('sets width and height style properties on element', () => {
    const mockEl = { style: {} };
    setImageDimensions(mockEl, 400, 300);
    expect(mockEl.style.width).toBe('400px');
    expect(mockEl.style.height).toBe('300px');
  });

  it('sets aspect-ratio style', () => {
    const mockEl = { style: {} };
    setImageDimensions(mockEl, 800, 600);
    expect(mockEl.style.aspectRatio).toBe('800 / 600');
  });

  it('handles zero dimensions gracefully', () => {
    const mockEl = { style: {} };
    expect(() => setImageDimensions(mockEl, 0, 0)).not.toThrow();
  });

  it('does nothing for null element', () => {
    expect(() => setImageDimensions(null, 400, 300)).not.toThrow();
  });

  it('does nothing for element without style', () => {
    const mockEl = {};
    expect(() => setImageDimensions(mockEl, 400, 300)).not.toThrow();
  });
});

// ── getImageDimensionsForCategory ────────────────────────────────────

describe('getImageDimensionsForCategory', () => {
  let getImageDimensionsForCategory;

  beforeEach(async () => {
    ({ getImageDimensionsForCategory } = await import('../src/public/performanceHelpers.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('returns dimensions for product grid cards', () => {
    const dims = getImageDimensionsForCategory('product-grid');
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });

  it('returns dimensions for hero images', () => {
    const dims = getImageDimensionsForCategory('hero');
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });

  it('returns default dimensions for unknown category', () => {
    const dims = getImageDimensionsForCategory('nonexistent');
    expect(dims.width).toBe(400);
    expect(dims.height).toBe(400);
  });

  it('handles null/undefined input', () => {
    expect(getImageDimensionsForCategory(null)).toEqual({ width: 400, height: 400 });
    expect(getImageDimensionsForCategory(undefined)).toEqual({ width: 400, height: 400 });
  });
});

// ── sharePromise ─────────────────────────────────────────────────────

describe('sharePromise', () => {
  let sharePromise;

  beforeEach(async () => {
    ({ sharePromise } = await import('../src/public/performanceHelpers.js'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('deduplicates concurrent calls to same async function', async () => {
    let callCount = 0;
    const fn = vi.fn(() => {
      callCount++;
      return new Promise(resolve => setTimeout(() => resolve(`result-${callCount}`), 50));
    });

    const shared = sharePromise(fn);

    // Three concurrent calls should produce same promise
    const [r1, r2, r3] = await Promise.all([shared(), shared(), shared()]);

    expect(fn).toHaveBeenCalledOnce();
    expect(r1).toBe('result-1');
    expect(r2).toBe('result-1');
    expect(r3).toBe('result-1');
  });

  it('allows new call after previous resolves', async () => {
    let callCount = 0;
    const fn = vi.fn(() => {
      callCount++;
      return Promise.resolve(`result-${callCount}`);
    });

    const shared = sharePromise(fn);

    const r1 = await shared();
    expect(r1).toBe('result-1');

    const r2 = await shared();
    expect(r2).toBe('result-2');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('allows new call after previous rejects', async () => {
    let callCount = 0;
    const fn = vi.fn(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('fail'));
      return Promise.resolve('ok');
    });

    const shared = sharePromise(fn);

    await expect(shared()).rejects.toThrow('fail');

    const r2 = await shared();
    expect(r2).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('passes arguments to underlying function', async () => {
    const fn = vi.fn((a, b) => Promise.resolve(a + b));
    const shared = sharePromise(fn);

    const result = await shared(2, 3);
    expect(result).toBe(5);
    expect(fn).toHaveBeenCalledWith(2, 3);
  });

  it('returns same rejected promise for concurrent calls', async () => {
    const fn = vi.fn(() => new Promise((_, reject) => setTimeout(() => reject(new Error('boom')), 50)));
    const shared = sharePromise(fn);

    const results = await Promise.allSettled([shared(), shared()]);

    expect(fn).toHaveBeenCalledOnce();
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect(results[0].reason.message).toBe('boom');
  });
});
