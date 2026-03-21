/**
 * @file browseAbandonmentTracking.test.js
 * @description Tests for CF-83o6 browse abandonment client-side tracking.
 *
 * Tests:
 *  - trackProductView: stored after 30s, NOT before
 *  - trackProductView: correct data stored
 *  - trackProductView: cancel function prevents write
 *  - trackProductView: multiple views, most recent wins
 *  - clearBrowseAbandonment: removes stored data, cancels pending timer
 *  - getBrowseAbandonmentData: returns stored product or null
 *  - Edge cases: missing productId, null storage, null fields
 *  - Module exports: BROWSE_STORAGE_KEY, MIN_DWELL_MS
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  trackProductView,
  getBrowseAbandonmentData,
  clearBrowseAbandonment,
  BROWSE_STORAGE_KEY,
  MIN_DWELL_MS,
} from '../src/public/browseAbandonment.js';

// ── helpers ───────────────────────────────────────────────────────────

/** Build a minimal fake sessionStorage object */
function makeStorage() {
  const store = {};
  return {
    getItem: (k) => Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  };
}

// ═══════════════════════════════════════════════════════════════════
// trackProductView — timing guard (30s minimum)
// ═══════════════════════════════════════════════════════════════════

describe('trackProductView — timing guard', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = makeStorage();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does NOT store before 30s', () => {
    trackProductView('p1', 'Test Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS - 1);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  it('does NOT store at 29999ms', () => {
    trackProductView('p1', 'Test Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(29999);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  it('stores at exactly 30s', () => {
    trackProductView('p1', 'Test Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).not.toBeNull();
  });

  it('stores after more than 30s', () => {
    trackProductView('p1', 'Test Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(60 * 1000);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).not.toBeNull();
  });

  it('returns a cancel function', () => {
    const cancel = trackProductView('p1', 'Test Sofa', 'img.jpg', 499, { storage });
    expect(typeof cancel).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════════
// trackProductView — data stored correctly
// ═══════════════════════════════════════════════════════════════════

describe('trackProductView — stored data', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = makeStorage();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('stores correct productId', () => {
    trackProductView('sofa-blue', 'Blue Ridge Sofa', 'img.jpg', 799, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productId).toBe('sofa-blue');
  });

  it('stores productName, productImage, and price', () => {
    trackProductView('sofa-blue', 'Blue Ridge Sofa', 'sofa.jpg', 799, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productName).toBe('Blue Ridge Sofa');
    expect(data.productImage).toBe('sofa.jpg');
    expect(data.price).toBe(799);
  });

  it('includes a viewedAt timestamp', () => {
    trackProductView('p1', 'Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(typeof data.viewedAt).toBe('number');
    expect(data.viewedAt).toBeGreaterThan(0);
  });

  it('normalizes missing price to 0', () => {
    trackProductView('p1', 'Sofa', 'img.jpg', null, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.price).toBe(0);
  });

  it('normalizes null productName to empty string', () => {
    trackProductView('p1', null, 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productName).toBe('');
  });

  it('normalizes null productImage to empty string', () => {
    trackProductView('p1', 'Sofa', null, 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productImage).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════
// trackProductView — cancel function
// ═══════════════════════════════════════════════════════════════════

describe('trackProductView — cancel function', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = makeStorage();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('cancel before 30s prevents storage', () => {
    const cancel = trackProductView('p1', 'Sofa', 'img.jpg', 499, { storage });
    cancel();
    vi.advanceTimersByTime(MIN_DWELL_MS);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  it('cancel after 30s is no-op (data already written)', () => {
    const cancel = trackProductView('p1', 'Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    cancel(); // too late — data already stored
    expect(storage.getItem(BROWSE_STORAGE_KEY)).not.toBeNull();
  });

  it('cancel does not throw', () => {
    const cancel = trackProductView('p1', 'Sofa', 'img.jpg', 499, { storage });
    expect(() => cancel()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// trackProductView — multiple views (most recent wins)
// ═══════════════════════════════════════════════════════════════════

describe('trackProductView — multiple views', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = makeStorage();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('second view cancels first pending timer', () => {
    trackProductView('p1', 'Sofa A', 'a.jpg', 499, { storage });
    vi.advanceTimersByTime(15000); // halfway through
    trackProductView('p2', 'Sofa B', 'b.jpg', 599, { storage }); // cancels p1
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productId).toBe('p2');
  });

  it('first product is NOT stored when second view fires', () => {
    trackProductView('p1', 'Sofa A', 'a.jpg', 499, { storage });
    trackProductView('p2', 'Sofa B', 'b.jpg', 599, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productId).toBe('p2');
  });

  it('stores second product when first already stored', () => {
    trackProductView('p1', 'Sofa A', 'a.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS); // p1 stored
    trackProductView('p2', 'Sofa B', 'b.jpg', 599, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS); // p2 overwrites p1
    const data = JSON.parse(storage.getItem(BROWSE_STORAGE_KEY));
    expect(data.productId).toBe('p2');
  });
});

// ═══════════════════════════════════════════════════════════════════
// clearBrowseAbandonment
// ═══════════════════════════════════════════════════════════════════

describe('clearBrowseAbandonment', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = makeStorage();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('removes stored product data', () => {
    trackProductView('p1', 'Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    clearBrowseAbandonment({ storage });
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  it('cancels pending timer — product not stored after clear', () => {
    trackProductView('p1', 'Sofa', 'img.jpg', 499, { storage });
    clearBrowseAbandonment({ storage }); // cancel before 30s fires
    vi.advanceTimersByTime(MIN_DWELL_MS);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  it('is safe to call on empty storage', () => {
    expect(() => clearBrowseAbandonment({ storage })).not.toThrow();
  });

  it('is safe to call with null storage', () => {
    expect(() => clearBrowseAbandonment({ storage: null })).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// getBrowseAbandonmentData
// ═══════════════════════════════════════════════════════════════════

describe('getBrowseAbandonmentData', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = makeStorage();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('returns null when nothing stored', () => {
    expect(getBrowseAbandonmentData({ storage })).toBeNull();
  });

  it('returns stored product data', () => {
    trackProductView('sofa-blue', 'Blue Sofa', 'img.jpg', 799, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = getBrowseAbandonmentData({ storage });
    expect(data).not.toBeNull();
    expect(data.productId).toBe('sofa-blue');
  });

  it('returns full product object with all fields', () => {
    trackProductView('sofa-blue', 'Blue Sofa', 'sofa.jpg', 799, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    const data = getBrowseAbandonmentData({ storage });
    expect(data).toMatchObject({
      productId: 'sofa-blue',
      productName: 'Blue Sofa',
      productImage: 'sofa.jpg',
      price: 799,
    });
  });

  it('returns null after clearBrowseAbandonment', () => {
    trackProductView('p1', 'Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    clearBrowseAbandonment({ storage });
    expect(getBrowseAbandonmentData({ storage })).toBeNull();
  });

  it('returns null when storage is null', () => {
    expect(getBrowseAbandonmentData({ storage: null })).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// trackProductView — edge cases
// ═══════════════════════════════════════════════════════════════════

describe('trackProductView — edge cases', () => {
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
    storage = makeStorage();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('does not store when productId is empty string', () => {
    trackProductView('', 'Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  it('does not store when productId is null', () => {
    trackProductView(null, 'Sofa', 'img.jpg', 499, { storage });
    vi.advanceTimersByTime(MIN_DWELL_MS);
    expect(storage.getItem(BROWSE_STORAGE_KEY)).toBeNull();
  });

  it('returns no-op cancel when productId is missing', () => {
    const cancel = trackProductView('', 'Sofa', 'img.jpg', 499, { storage });
    expect(typeof cancel).toBe('function');
    expect(() => cancel()).not.toThrow();
  });

  it('does not throw when storage is null', () => {
    trackProductView('p1', 'Sofa', 'img.jpg', 499, { storage: null });
    expect(() => vi.advanceTimersByTime(MIN_DWELL_MS)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// module exports
// ═══════════════════════════════════════════════════════════════════

describe('module exports', () => {
  it('exports BROWSE_STORAGE_KEY as a non-empty string', () => {
    expect(typeof BROWSE_STORAGE_KEY).toBe('string');
    expect(BROWSE_STORAGE_KEY.length).toBeGreaterThan(0);
  });

  it('exports MIN_DWELL_MS as 30000', () => {
    expect(MIN_DWELL_MS).toBe(30000);
  });
});
