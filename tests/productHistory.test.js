/**
 * Tests for public/ProductHistory.js
 * CF-f6ds: Recently Viewed Products
 *
 * Coverage:
 *   - trackView: falsy id no-op, deduplification (move to front), LRU eviction at MAX_HISTORY
 *   - getRecentlyViewed: returns most-recent-first order
 *   - clearHistory: empties storage
 *   - Storage unavailable: graceful fallback (null storage)
 *   - Corrupt/invalid storage data: graceful fallback to []
 */
import { describe, it, expect } from 'vitest';
import {
  trackView,
  getRecentlyViewed,
  clearHistory,
  STORAGE_KEY,
  MAX_HISTORY,
} from '../src/public/ProductHistory.js';

// ── Helpers ──────────────────────────────────────────────────────────

/** Create an in-memory sessionStorage-like object for testing. */
function makeStorage() {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// 1. trackView — basic behaviour
// ═══════════════════════════════════════════════════════════════════════

describe('trackView — basic behaviour', () => {
  it('does nothing for a null productId', () => {
    const storage = makeStorage();
    trackView(null, { storage });
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('does nothing for an empty string productId', () => {
    const storage = makeStorage();
    trackView('', { storage });
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('does nothing for a false productId', () => {
    const storage = makeStorage();
    trackView(false, { storage });
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('does nothing for 0 productId', () => {
    const storage = makeStorage();
    trackView(0, { storage });
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('adds a productId to history', () => {
    const storage = makeStorage();
    trackView('prod-abc', { storage });
    expect(getRecentlyViewed({ storage })).toEqual(['prod-abc']);
  });

  it('prepends — most recent first', () => {
    const storage = makeStorage();
    trackView('prod-1', { storage });
    trackView('prod-2', { storage });
    trackView('prod-3', { storage });
    expect(getRecentlyViewed({ storage })).toEqual(['prod-3', 'prod-2', 'prod-1']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. trackView — deduplication (LRU move-to-front)
// ═══════════════════════════════════════════════════════════════════════

describe('trackView — deduplication', () => {
  it('moves an existing entry to the front on re-visit', () => {
    const storage = makeStorage();
    trackView('prod-1', { storage });
    trackView('prod-2', { storage });
    trackView('prod-3', { storage });
    // Re-visit prod-1 — should move to front, no duplicates
    trackView('prod-1', { storage });
    expect(getRecentlyViewed({ storage })).toEqual(['prod-1', 'prod-3', 'prod-2']);
  });

  it('does not duplicate the most recent entry when re-tracked', () => {
    const storage = makeStorage();
    trackView('prod-abc', { storage });
    trackView('prod-abc', { storage });
    expect(getRecentlyViewed({ storage })).toEqual(['prod-abc']);
  });

  it('maintains correct order after multiple re-visits', () => {
    const storage = makeStorage();
    ['a', 'b', 'c', 'd'].forEach(id => trackView(id, { storage }));
    trackView('b', { storage }); // b: d,c,b,a → b,d,c,a
    trackView('a', { storage }); // a: b,d,c,a → a,b,d,c
    expect(getRecentlyViewed({ storage })).toEqual(['a', 'b', 'd', 'c']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. trackView — LRU eviction at MAX_HISTORY
// ═══════════════════════════════════════════════════════════════════════

describe('trackView — LRU eviction', () => {
  it('caps history at MAX_HISTORY entries', () => {
    const storage = makeStorage();
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      trackView(`prod-${i}`, { storage });
    }
    expect(getRecentlyViewed({ storage })).toHaveLength(MAX_HISTORY);
  });

  it('evicts the oldest entry when MAX_HISTORY is exceeded', () => {
    const storage = makeStorage();
    for (let i = 0; i < MAX_HISTORY; i++) {
      trackView(`prod-${i}`, { storage });
    }
    // At this point prod-0 is oldest; adding prod-new evicts it
    trackView('prod-new', { storage });
    const history = getRecentlyViewed({ storage });
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0]).toBe('prod-new');
    expect(history).not.toContain('prod-0');
  });

  it('does not evict when deduplicating (re-visit does not grow the list)', () => {
    const storage = makeStorage();
    for (let i = 0; i < MAX_HISTORY; i++) {
      trackView(`prod-${i}`, { storage });
    }
    // Re-visit an existing entry — list length must stay at MAX_HISTORY
    trackView('prod-5', { storage });
    expect(getRecentlyViewed({ storage })).toHaveLength(MAX_HISTORY);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. getRecentlyViewed
// ═══════════════════════════════════════════════════════════════════════

describe('getRecentlyViewed', () => {
  it('returns [] for empty storage', () => {
    const storage = makeStorage();
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('returns the full history array, most recent first', () => {
    const storage = makeStorage();
    ['p1', 'p2', 'p3'].forEach(id => trackView(id, { storage }));
    expect(getRecentlyViewed({ storage })).toEqual(['p3', 'p2', 'p1']);
  });

  it('returns [] when stored value is not a JSON array', () => {
    const storage = makeStorage();
    storage.setItem(STORAGE_KEY, 'not-json');
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('returns [] when stored value is a JSON object (not array)', () => {
    const storage = makeStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('returns [] when storage is null (unavailable)', () => {
    expect(getRecentlyViewed({ storage: null })).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. clearHistory
// ═══════════════════════════════════════════════════════════════════════

describe('clearHistory', () => {
  it('removes all entries from history', () => {
    const storage = makeStorage();
    ['p1', 'p2', 'p3'].forEach(id => trackView(id, { storage }));
    clearHistory({ storage });
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('is a no-op when history is already empty', () => {
    const storage = makeStorage();
    expect(() => clearHistory({ storage })).not.toThrow();
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('does not throw when storage is null (unavailable)', () => {
    expect(() => clearHistory({ storage: null })).not.toThrow();
  });

  it('allows trackView to work normally after clearHistory', () => {
    const storage = makeStorage();
    ['p1', 'p2'].forEach(id => trackView(id, { storage }));
    clearHistory({ storage });
    trackView('p3', { storage });
    expect(getRecentlyViewed({ storage })).toEqual(['p3']);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. Storage unavailable / error resilience
// ═══════════════════════════════════════════════════════════════════════

describe('storage unavailable / error resilience', () => {
  it('trackView does not throw when storage.setItem throws (quota exceeded)', () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError'); },
      removeItem: () => {},
    };
    expect(() => trackView('prod-abc', { storage })).not.toThrow();
  });

  it('trackView does not throw when storage.getItem throws', () => {
    const storage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(() => trackView('prod-abc', { storage })).not.toThrow();
  });

  it('getRecentlyViewed returns [] when getItem throws', () => {
    const storage = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(getRecentlyViewed({ storage })).toEqual([]);
  });

  it('clearHistory does not throw when removeItem throws', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => { throw new Error('SecurityError'); },
    };
    expect(() => clearHistory({ storage })).not.toThrow();
  });
});
