/**
 * @file funnelTracker.test.js
 * @description TDD tests for funnelTracker.js — Wave 32, CF-wave32 blaidd
 *
 * Covers:
 *  - initFunnelTracker: returns tracker API
 *  - tracker.track: calls backend, session dedup, experiment tagging
 *  - tracker.identify: sets memberId on subsequent calls
 *  - debounce: rapid same-stage calls collapse to one backend call
 *  - error resilience: backend failures don't throw to caller
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockTrackFunnelEvent = vi.fn().mockResolvedValue({ success: true });

vi.mock('backend/conversionFunnel.web', () => ({
  trackFunnelEvent: mockTrackFunnelEvent,
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

import { initFunnelTracker } from '../src/public/funnelTracker.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── initFunnelTracker ──────────────────────────────────────────────

describe('initFunnelTracker', () => {
  it('returns an object with track and identify', () => {
    const tracker = initFunnelTracker('sess-1');
    expect(typeof tracker.track).toBe('function');
    expect(typeof tracker.identify).toBe('function');
  });
});

// ── tracker.track ──────────────────────────────────────────────────

describe('tracker.track', () => {
  it('calls trackFunnelEvent with sessionId and stage after debounce', async () => {
    const tracker = initFunnelTracker('sess-1');
    tracker.track('product_view', { productId: 'p1' });
    await vi.runAllTimersAsync();
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith(
      'product_view',
      expect.objectContaining({ sessionId: 'sess-1', productId: 'p1' }),
    );
  });

  it('does not re-emit the same stage within the same session', async () => {
    const tracker = initFunnelTracker('sess-1');
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();
    expect(mockTrackFunnelEvent).toHaveBeenCalledTimes(1);
  });

  it('allows different stages from the same session', async () => {
    const tracker = initFunnelTracker('sess-1');
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();
    tracker.track('product_view', { productId: 'p1' });
    await vi.runAllTimersAsync();
    expect(mockTrackFunnelEvent).toHaveBeenCalledTimes(2);
  });

  it('collapses rapid duplicate-stage calls into one backend call (debounce)', async () => {
    const tracker = initFunnelTracker('sess-1');
    // Three rapid calls to the same stage before the debounce timer fires
    tracker.track('checkout_start', {});
    tracker.track('checkout_start', {});
    tracker.track('checkout_start', {});
    await vi.runAllTimersAsync();
    // Dedup: stage already seen after first fire — subsequent calls skipped
    expect(mockTrackFunnelEvent).toHaveBeenCalledTimes(1);
  });

  it('includes memberId set via identify()', async () => {
    const tracker = initFunnelTracker('sess-1');
    tracker.identify('mem-42');
    tracker.track('add_to_cart', { productId: 'p1' });
    await vi.runAllTimersAsync();
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith(
      'add_to_cart',
      expect.objectContaining({ memberId: 'mem-42' }),
    );
  });

  it('includes experimentId and variantId when provided', async () => {
    const tracker = initFunnelTracker('sess-1');
    tracker.track('add_to_cart', { experimentId: 'exp-1', variantId: 'control', productId: 'p1' });
    await vi.runAllTimersAsync();
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith(
      'add_to_cart',
      expect.objectContaining({ experimentId: 'exp-1', variantId: 'control' }),
    );
  });

  it('includes revenue when provided (purchase stage)', async () => {
    const tracker = initFunnelTracker('sess-1');
    tracker.track('purchase', { productId: 'p1', revenue: 899 });
    await vi.runAllTimersAsync();
    expect(mockTrackFunnelEvent).toHaveBeenCalledWith(
      'purchase',
      expect.objectContaining({ revenue: 899 }),
    );
  });

  it('does not throw when the backend rejects', async () => {
    mockTrackFunnelEvent.mockRejectedValueOnce(new Error('network error'));
    const tracker = initFunnelTracker('sess-1');
    tracker.track('page_view', {});
    await expect(vi.runAllTimersAsync()).resolves.not.toThrow();
  });

  it('two separate trackers with different sessionIds track independently', async () => {
    const t1 = initFunnelTracker('sess-A');
    const t2 = initFunnelTracker('sess-B');

    t1.track('page_view', {});
    t2.track('page_view', {});
    await vi.runAllTimersAsync();

    expect(mockTrackFunnelEvent).toHaveBeenCalledTimes(2);
    const calls = mockTrackFunnelEvent.mock.calls;
    expect(calls[0][1].sessionId).toBe('sess-A');
    expect(calls[1][1].sessionId).toBe('sess-B');
  });
});

// ── tracker.identify ───────────────────────────────────────────────

describe('tracker.identify', () => {
  it('updates memberId for calls made after identify', async () => {
    const tracker = initFunnelTracker('sess-1');
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();

    tracker.identify('mem-99');
    tracker.track('product_view', { productId: 'p2' });
    await vi.runAllTimersAsync();

    const secondCall = mockTrackFunnelEvent.mock.calls[1];
    expect(secondCall[1].memberId).toBe('mem-99');
  });

  it('does not retroactively change memberId on already-emitted stages', async () => {
    const tracker = initFunnelTracker('sess-1');
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();

    tracker.identify('mem-1');

    const firstCall = mockTrackFunnelEvent.mock.calls[0];
    expect(firstCall[1].memberId).toBeUndefined();
  });
});

// ── branch coverage — result outcome paths ─────────────────────────

describe('tracker.track — result branch paths', () => {
  it('marks stage as emitted when result.duplicate is true (even if success=false)', async () => {
    // Covers the `else if (result?.duplicate)` branch (line 109-111)
    mockTrackFunnelEvent.mockResolvedValueOnce({ success: false, duplicate: true });
    const tracker = initFunnelTracker('sess-dup');
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();

    // Stage should be marked emitted — second call must be skipped
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();
    expect(mockTrackFunnelEvent).toHaveBeenCalledTimes(1);
  });

  it('does NOT mark stage as emitted when success=false and duplicate=false', async () => {
    // Covers the "neither" branch — stage stays un-emitted, allowing retry
    mockTrackFunnelEvent.mockResolvedValueOnce({ success: false, duplicate: false });
    const tracker = initFunnelTracker('sess-retry');
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();

    // Stage was NOT emitted, so second call should proceed to backend
    mockTrackFunnelEvent.mockResolvedValueOnce({ success: true });
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();
    expect(mockTrackFunnelEvent).toHaveBeenCalledTimes(2);
  });

  it('omits optional fields from payload when opts is empty', async () => {
    // Covers the FALSE branches of all `opts.X != null && { X }` conditionals
    const tracker = initFunnelTracker('sess-empty');
    tracker.track('page_view', {});
    await vi.runAllTimersAsync();
    const payload = mockTrackFunnelEvent.mock.calls[0][1];
    expect('productId'    in payload).toBe(false);
    expect('revenue'      in payload).toBe(false);
    expect('experimentId' in payload).toBe(false);
    expect('variantId'    in payload).toBe(false);
    expect('memberId'     in payload).toBe(false);
  });
});

// ── getBackend error path (lines 40-42) ───────────────────────────
// Covers: catch(e) when import('backend/conversionFunnel.web') throws,
// logError called, _backend set to LOAD_FAILED, null returned.

describe('getBackend load failure', () => {
  it('returns null and marks backend as LOAD_FAILED when import throws', async () => {
    // Reset module registry so _backend is re-initialized to null
    vi.resetModules();

    const mockLogError = vi.fn();
    vi.doMock('backend/errorMonitoring.web', () => ({ logError: mockLogError })); // vi-domock-legacy
    vi.doMock('backend/conversionFunnel.web', () => { throw new Error('backend unavailable'); }); // vi-domock-legacy

    const { initFunnelTracker: freshInit } = await import('../src/public/funnelTracker.js');

    const tracker = freshInit('sess-load-fail');
    // track() calls getBackend() internally; the import failure should be swallowed
    tracker.track('page_view');
    await vi.advanceTimersByTimeAsync(400);

    // Should not throw, and logError should have been called for the getBackend failure
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'funnelTracker.getBackend' }),
    );
  });

  it('LOAD_FAILED sentinel prevents re-import on subsequent track calls', async () => {
    // Verifies that once _backend is LOAD_FAILED, further track() calls skip the
    // dynamic import entirely — logError fires exactly once, not once per call.
    vi.resetModules();

    const mockLogError = vi.fn();
    vi.doMock('backend/errorMonitoring.web', () => ({ logError: mockLogError })); // vi-domock-legacy
    vi.doMock('backend/conversionFunnel.web', () => { throw new Error('backend unavailable'); }); // vi-domock-legacy

    const { initFunnelTracker: freshInit } = await import('../src/public/funnelTracker.js');

    const tracker = freshInit('sess-sentinel');
    tracker.track('page_view');
    await vi.advanceTimersByTimeAsync(400);

    // First call triggered the import failure
    expect(mockLogError).toHaveBeenCalledTimes(1);

    // Second track() should hit the LOAD_FAILED sentinel — no additional import, no additional logError
    tracker.track('add_to_cart');
    await vi.advanceTimersByTimeAsync(400);
    expect(mockLogError).toHaveBeenCalledTimes(1);
  });
});
