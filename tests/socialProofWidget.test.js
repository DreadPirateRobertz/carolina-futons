/**
 * Tests for public/SocialProof.js + backend ViewerCount webMethods
 * CF-ej3t: Social Proof Widget
 *
 * Coverage:
 *   Backend:
 *     getViewerCount — returns zeros when not found, returns stored values, error fallback
 *     incrementViewerCount — inserts on first call, updates on subsequent, error fallback
 *   Frontend:
 *     renderViewerBadge — shows/hides at threshold
 *     renderSoldBadge   — shows/hides at threshold, singular vs plural
 *     hideSocialProofSection / showSocialProofSection — graceful no-ops
 *     hasIncrementedThisSession / markIncrementedThisSession — sessionStorage rate limiting
 *     initSocialProof — full integration: increment, fetch, render, section visibility, fail-open
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  __reset as resetData,
  __seed,
  __onInsert,
  __onUpdate,
  __setInsertError,
  __setQueryError,
  __setUpdateError,
} from './__mocks__/wix-data.js';

import {
  getViewerCount,
  incrementViewerCount,
} from '../src/backend/socialProof.web.js';

import {
  initSocialProof,
  renderViewerBadge,
  renderSoldBadge,
  hideSocialProofSection,
  showSocialProofSection,
  hasIncrementedThisSession,
  markIncrementedThisSession,
} from '../src/public/SocialProof.js';

// ── Helpers ───────────────────────────────────────────────────────────

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem:    (k)    => (k in store ? store[k] : null),
    setItem:    (k, v) => { store[k] = String(v); },
    removeItem: (k)    => { delete store[k]; },
    _store:     store,
  };
}

function makeElement(overrides = {}) {
  return {
    text: null,
    show: vi.fn(),
    hide: vi.fn(),
    ...overrides,
  };
}

function make$w(map = {}) {
  return (sel) => map[sel] ?? null;
}

function makeViewerRecord(overrides = {}) {
  return {
    _id:        'vc-001',
    productId:  'prod-001',
    viewCount:  10,
    lastSold24h: 3,
    updatedAt:  new Date(),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. Backend — getViewerCount
// ═══════════════════════════════════════════════════════════════════════

describe('getViewerCount', () => {
  beforeEach(() => {
    resetData();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns zeros when no record exists', async () => {
    const result = await getViewerCount('prod-001');
    expect(result).toEqual({ viewCount: 0, lastSold24h: 0 });
  });

  it('returns zeros for null productId', async () => {
    const result = await getViewerCount(null);
    expect(result).toEqual({ viewCount: 0, lastSold24h: 0 });
  });

  it('returns stored viewCount and lastSold24h', async () => {
    __seed('ViewerCount', [makeViewerRecord({ viewCount: 15, lastSold24h: 4 })]);
    const result = await getViewerCount('prod-001');
    expect(result.viewCount).toBe(15);
    expect(result.lastSold24h).toBe(4);
  });

  it('returns zeros (not negative) when stored values are negative', async () => {
    __seed('ViewerCount', [makeViewerRecord({ viewCount: -5, lastSold24h: -1 })]);
    const result = await getViewerCount('prod-001');
    expect(result.viewCount).toBe(0);
    expect(result.lastSold24h).toBe(0);
  });

  it('returns zeros on CMS error', async () => {
    __setQueryError('ViewerCount', new Error('CMS unavailable'));
    const result = await getViewerCount('prod-001');
    expect(result).toEqual({ viewCount: 0, lastSold24h: 0 });
    expect(console.error).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. Backend — incrementViewerCount
// ═══════════════════════════════════════════════════════════════════════

describe('incrementViewerCount', () => {
  beforeEach(() => {
    resetData();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('inserts a new record on first call', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'ViewerCount') inserts.push(item); });

    const result = await incrementViewerCount('prod-001');
    expect(result.ok).toBe(true);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].productId).toBe('prod-001');
    expect(inserts[0].viewCount).toBe(1);
  });

  it('updates viewCount by 1 on subsequent call', async () => {
    __seed('ViewerCount', [makeViewerRecord({ viewCount: 7 })]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'ViewerCount') updates.push(item); });

    const result = await incrementViewerCount('prod-001');
    expect(result.ok).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0].viewCount).toBe(8);
  });

  it('returns { ok: false } for null productId', async () => {
    const result = await incrementViewerCount(null);
    expect(result.ok).toBe(false);
  });

  it('returns { ok: false } on CMS error', async () => {
    __setQueryError('ViewerCount', new Error('DB error'));
    const result = await incrementViewerCount('prod-001');
    expect(result.ok).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it('sets updatedAt on insert', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'ViewerCount') inserts.push(item); });
    await incrementViewerCount('prod-001');
    expect(inserts[0].updatedAt).toBeInstanceOf(Date);
  });

  it('returns { ok: false } when wixData.update throws', async () => {
    __seed('ViewerCount', [makeViewerRecord({ viewCount: 5 })]);
    __setUpdateError('ViewerCount', new Error('Update failed'));
    const result = await incrementViewerCount('prod-001');
    expect(result.ok).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. renderViewerBadge
// ═══════════════════════════════════════════════════════════════════════

describe('renderViewerBadge', () => {
  it('shows badge and returns true when viewCount >= 2', () => {
    const badge = makeElement();
    const result = renderViewerBadge(make$w({ '#viewerCountBadge': badge }), 5);
    expect(badge.show).toHaveBeenCalled();
    expect(badge.text).toBe('5 people viewing this');
    expect(result).toBe(true);
  });

  it('hides badge and returns false when viewCount < 2', () => {
    const badge = makeElement();
    const result = renderViewerBadge(make$w({ '#viewerCountBadge': badge }), 1);
    expect(badge.hide).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('hides badge when viewCount is 0', () => {
    const badge = makeElement();
    renderViewerBadge(make$w({ '#viewerCountBadge': badge }), 0);
    expect(badge.hide).toHaveBeenCalled();
  });

  it('shows badge at exactly the threshold (2)', () => {
    const badge = makeElement();
    expect(renderViewerBadge(make$w({ '#viewerCountBadge': badge }), 2)).toBe(true);
    expect(badge.show).toHaveBeenCalled();
  });

  it('does not throw when badge element is absent', () => {
    expect(() => renderViewerBadge(make$w(), 5)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. renderSoldBadge
// ═══════════════════════════════════════════════════════════════════════

describe('renderSoldBadge', () => {
  it('shows badge and returns true when lastSold24h >= 1', () => {
    const badge = makeElement();
    const result = renderSoldBadge(make$w({ '#soldRecentlyBadge': badge }), 3);
    expect(badge.show).toHaveBeenCalled();
    expect(badge.text).toBe('3 sold in last 24h');
    expect(result).toBe(true);
  });

  it('uses singular text when lastSold24h === 1', () => {
    const badge = makeElement();
    renderSoldBadge(make$w({ '#soldRecentlyBadge': badge }), 1);
    expect(badge.text).toBe('1 sold in last 24h');
  });

  it('hides badge and returns false when lastSold24h is 0', () => {
    const badge = makeElement();
    const result = renderSoldBadge(make$w({ '#soldRecentlyBadge': badge }), 0);
    expect(badge.hide).toHaveBeenCalled();
    expect(result).toBe(false);
  });

  it('does not throw when badge element is absent', () => {
    expect(() => renderSoldBadge(make$w(), 5)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. hideSocialProofSection / showSocialProofSection
// ═══════════════════════════════════════════════════════════════════════

describe('hideSocialProofSection / showSocialProofSection', () => {
  it('calls .hide() on #socialProofSection', () => {
    const section = makeElement();
    hideSocialProofSection(make$w({ '#socialProofSection': section }));
    expect(section.hide).toHaveBeenCalled();
  });

  it('calls .show() on #socialProofSection', () => {
    const section = makeElement();
    showSocialProofSection(make$w({ '#socialProofSection': section }));
    expect(section.show).toHaveBeenCalled();
  });

  it('hide does not throw when section is absent', () => {
    expect(() => hideSocialProofSection(make$w())).not.toThrow();
  });

  it('show does not throw when section is absent', () => {
    expect(() => showSocialProofSection(make$w())).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Session rate limiting
// ═══════════════════════════════════════════════════════════════════════

describe('session rate limiting', () => {
  it('hasIncrementedThisSession returns false when key is absent', () => {
    expect(hasIncrementedThisSession(makeStorage(), 'prod-001')).toBe(false);
  });

  it('hasIncrementedThisSession returns true after markIncrementedThisSession', () => {
    const storage = makeStorage();
    markIncrementedThisSession(storage, 'prod-001');
    expect(hasIncrementedThisSession(storage, 'prod-001')).toBe(true);
  });

  it('rate limit is per-product — different products have independent flags', () => {
    const storage = makeStorage();
    markIncrementedThisSession(storage, 'prod-001');
    expect(hasIncrementedThisSession(storage, 'prod-002')).toBe(false);
  });

  it('returns false for null storage', () => {
    expect(hasIncrementedThisSession(null, 'prod-001')).toBe(false);
  });

  it('markIncrementedThisSession does not throw for null storage', () => {
    expect(() => markIncrementedThisSession(null, 'prod-001')).not.toThrow();
  });

  it('returns false for null productId', () => {
    expect(hasIncrementedThisSession(makeStorage(), null)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. initSocialProof — integration
// ═══════════════════════════════════════════════════════════════════════

describe('initSocialProof', () => {
  let viewerBadge, soldBadge, section, $wFn, storage;
  let mockGetViewerCount, mockIncrementViewerCount;

  beforeEach(() => {
    viewerBadge = makeElement();
    soldBadge   = makeElement();
    section     = makeElement();
    $wFn        = make$w({ '#viewerCountBadge': viewerBadge, '#soldRecentlyBadge': soldBadge, '#socialProofSection': section });
    storage     = makeStorage();
    mockGetViewerCount       = vi.fn(async () => ({ viewCount: 10, lastSold24h: 3 }));
    mockIncrementViewerCount = vi.fn(async () => ({ ok: true }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns the viewer count data on success', async () => {
    const result = await initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: mockGetViewerCount,
      incrementViewerCount: mockIncrementViewerCount,
    });
    expect(result).toEqual({ viewCount: 10, lastSold24h: 3 });
  });

  it('calls incrementViewerCount on first visit', async () => {
    await initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: mockGetViewerCount,
      incrementViewerCount: mockIncrementViewerCount,
    });
    // Allow fire-and-forget to settle
    await new Promise(r => setTimeout(r, 50));
    expect(mockIncrementViewerCount).toHaveBeenCalledWith('prod-001');
  });

  it('does not call incrementViewerCount on repeat visit (rate limited)', async () => {
    markIncrementedThisSession(storage, 'prod-001');
    await initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: mockGetViewerCount,
      incrementViewerCount: mockIncrementViewerCount,
    });
    await new Promise(r => setTimeout(r, 10));
    expect(mockIncrementViewerCount).not.toHaveBeenCalled();
  });

  it('shows both badges when counts are above thresholds', async () => {
    await initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: vi.fn(async () => ({ viewCount: 5, lastSold24h: 2 })),
      incrementViewerCount: mockIncrementViewerCount,
    });
    expect(viewerBadge.show).toHaveBeenCalled();
    expect(soldBadge.show).toHaveBeenCalled();
    expect(section.show).toHaveBeenCalled();
  });

  it('hides viewer badge when viewCount < 2', async () => {
    await initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: vi.fn(async () => ({ viewCount: 1, lastSold24h: 3 })),
      incrementViewerCount: mockIncrementViewerCount,
    });
    expect(viewerBadge.hide).toHaveBeenCalled();
    expect(soldBadge.show).toHaveBeenCalled(); // sold badge still shows
    expect(section.show).toHaveBeenCalled();
  });

  it('hides section when both badges are below threshold', async () => {
    await initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: vi.fn(async () => ({ viewCount: 1, lastSold24h: 0 })),
      incrementViewerCount: mockIncrementViewerCount,
    });
    expect(section.hide).toHaveBeenCalled();
    expect(section.show).not.toHaveBeenCalled();
  });

  it('hides section and returns null on getViewerCount error (fail-open)', async () => {
    const result = await initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: vi.fn(async () => { throw new Error('CMS down'); }),
      incrementViewerCount: mockIncrementViewerCount,
    });
    expect(result).toBeNull();
    expect(section.hide).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it('hides section and returns null for null productId', async () => {
    const result = await initSocialProof(null, {
      $w: $wFn, storage,
      getViewerCount: mockGetViewerCount,
      incrementViewerCount: mockIncrementViewerCount,
    });
    expect(result).toBeNull();
    expect(section.hide).toHaveBeenCalled();
  });

  it('does not throw when increment fails (fire-and-forget)', async () => {
    await expect(initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: mockGetViewerCount,
      incrementViewerCount: vi.fn(async () => { throw new Error('Network'); }),
    })).resolves.not.toThrow();
  });

  it('session is marked even when increment fails (no retry within session)', async () => {
    const failingIncrement = vi.fn(async () => { throw new Error('Network'); });
    await initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: mockGetViewerCount,
      incrementViewerCount: failingIncrement,
    });
    await new Promise(r => setTimeout(r, 50));
    // Confirm flag is set despite the increment failing
    expect(hasIncrementedThisSession(storage, 'prod-001')).toBe(true);
    // Second call must not retry
    await initSocialProof('prod-001', {
      $w: $wFn, storage,
      getViewerCount: mockGetViewerCount,
      incrementViewerCount: failingIncrement,
    });
    await new Promise(r => setTimeout(r, 50));
    expect(failingIncrement).toHaveBeenCalledTimes(1);
  });
});
