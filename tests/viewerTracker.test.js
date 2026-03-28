/**
 * @file viewerTracker.test.js
 * @description Tests for ViewerTracker service (CF-n4ne).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { withRateLimit } from './helpers/withRateLimit.js';

import {
  trackView,
  getViewerCount,
  getSocialProofSignals,
  _COLLECTION,
  _WINDOW_MS,
  _MIN_DISPLAY,
  _MAX_DISPLAY,
} from '../src/backend/viewerTracker.web.js';

beforeEach(() => {
  __reset();
});

// ── Constants ────────────────────────────────────────────────────────

describe('ViewerTracker constants', () => {
  it('window is 5 minutes', () => {
    expect(_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  it('display min is 1, max is 99', () => {
    expect(_MIN_DISPLAY).toBe(1);
    expect(_MAX_DISPLAY).toBe(99);
  });
});

// ── trackView ────────────────────────────────────────────────────────

describe('trackView', () => {
  it('creates a new viewer record for unseen product', async () => {
    withRateLimit('ViewerTrackerRateLimit', { key: 'prod-1' });
    let inserted = null;
    __onInsert((col, item) => { if (col === _COLLECTION) inserted = item; });

    const result = await trackView('prod-1');
    expect(result.ok).toBe(true);
    expect(inserted).not.toBeNull();
    expect(inserted.productId).toBe('prod-1');
    expect(inserted.count).toBe(1);
  });

  it('increments count within the 5-minute window', async () => {
    withRateLimit('ViewerTrackerRateLimit', { key: 'prod-1' });
    __seed(_COLLECTION, [{
      _id: 'vc-1', productId: 'prod-1', count: 5,
      windowStart: new Date(), updatedAt: new Date(),
    }]);

    let updated = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updated = item; });

    await trackView('prod-1');
    expect(updated.count).toBe(6);
  });

  it('resets count when window has expired', async () => {
    withRateLimit('ViewerTrackerRateLimit', { key: 'prod-1' });
    const expiredWindow = new Date(Date.now() - 6 * 60 * 1000); // 6 minutes ago
    __seed(_COLLECTION, [{
      _id: 'vc-1', productId: 'prod-1', count: 42,
      windowStart: expiredWindow, updatedAt: expiredWindow,
    }]);

    let updated = null;
    __onUpdate((col, item) => { if (col === _COLLECTION) updated = item; });

    await trackView('prod-1');
    expect(updated.count).toBe(1); // Reset, not 43
  });

  it('rejects empty productId', async () => {
    const result = await trackView('');
    expect(result.ok).toBe(false);
  });
});

// ── getViewerCount ───────────────────────────────────────────────────

describe('getViewerCount', () => {
  it('returns count and display text for active window', async () => {
    __seed(_COLLECTION, [{
      _id: 'vc-1', productId: 'prod-1', count: 7,
      windowStart: new Date(), updatedAt: new Date(),
    }]);

    const result = await getViewerCount('prod-1');
    expect(result.count).toBe(7);
    expect(result.display).toBe('7 people viewing now');
  });

  it('returns singular text for count of 1', async () => {
    __seed(_COLLECTION, [{
      _id: 'vc-1', productId: 'prod-1', count: 1,
      windowStart: new Date(), updatedAt: new Date(),
    }]);

    const result = await getViewerCount('prod-1');
    expect(result.display).toBe('1 person viewing now');
  });

  it('caps display at 99', async () => {
    __seed(_COLLECTION, [{
      _id: 'vc-1', productId: 'prod-1', count: 250,
      windowStart: new Date(), updatedAt: new Date(),
    }]);

    const result = await getViewerCount('prod-1');
    expect(result.count).toBe(250); // raw count preserved
    expect(result.display).toBe('99 people viewing now'); // display capped
  });

  it('returns 0 for expired window', async () => {
    const expiredWindow = new Date(Date.now() - 6 * 60 * 1000);
    __seed(_COLLECTION, [{
      _id: 'vc-1', productId: 'prod-1', count: 42,
      windowStart: expiredWindow, updatedAt: expiredWindow,
    }]);

    const result = await getViewerCount('prod-1');
    expect(result.count).toBe(0);
    expect(result.display).toBe('');
  });

  it('returns 0 for unknown product', async () => {
    const result = await getViewerCount('nonexistent');
    expect(result.count).toBe(0);
    expect(result.display).toBe('');
  });

  it('returns empty for null productId', async () => {
    const result = await getViewerCount(null);
    expect(result.count).toBe(0);
  });
});

// ── getSocialProofSignals ────────────────────────────────────────────

describe('getSocialProofSignals', () => {
  it('returns aggregated signals for active product', async () => {
    __seed(_COLLECTION, [{
      _id: 'vc-1', productId: 'prod-1', count: 12,
      windowStart: new Date(), updatedAt: new Date(),
    }]);

    const result = await getSocialProofSignals('prod-1');
    expect(result.success).toBe(true);
    expect(result.signals.viewerCount).toBe(12);
    expect(result.signals.viewerDisplay).toBe('12 people viewing now');
    expect(result.signals.hasActiveViewers).toBe(true);
  });

  it('returns hasActiveViewers=false for expired window', async () => {
    const expired = new Date(Date.now() - 10 * 60 * 1000);
    __seed(_COLLECTION, [{
      _id: 'vc-1', productId: 'prod-1', count: 5,
      windowStart: expired, updatedAt: expired,
    }]);

    const result = await getSocialProofSignals('prod-1');
    expect(result.success).toBe(true);
    expect(result.signals.hasActiveViewers).toBe(false);
  });

  it('handles missing productId', async () => {
    const result = await getSocialProofSignals('');
    expect(result.success).toBe(false);
  });
});
