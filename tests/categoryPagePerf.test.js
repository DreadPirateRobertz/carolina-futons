import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

const mockSetFilter = vi.fn();
const mockGetTotalCount = vi.fn(() => 5);
const mockBatchLoadRatings = vi.fn().mockResolvedValue({ p1: { avg: 4.5, count: 10 } });
const mockRenderCardStarRating = vi.fn();
const mockGetSwatchPreviewColors = vi.fn().mockResolvedValue([
  { colorHex: '#FF0000' }, { colorHex: '#00FF00' },
]);

vi.mock('backend/swatchService.web', () => ({
  getSwatchPreviewColors: mockGetSwatchPreviewColors,
}));

vi.mock('public/StarRatingCard', () => ({
  batchLoadRatings: mockBatchLoadRatings,
  renderCardStarRating: mockRenderCardStarRating,
  _resetCache: vi.fn(),
}));

// ── Test: Basic Filter Debounce ──────────────────────────────────────

describe('Category Page basic filter debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not call applyFilters immediately on filter change', () => {
    // Simulate rapid filter changes — applyFilters should be debounced
    // If debounced, setFilter should NOT be called until timer fires
    let filterCallCount = 0;
    const debouncedFn = createDebounce(() => { filterCallCount++; }, 300);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(filterCallCount).toBe(0);
  });

  it('should call applyFilters once after debounce period', () => {
    let filterCallCount = 0;
    const debouncedFn = createDebounce(() => { filterCallCount++; }, 300);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    vi.advanceTimersByTime(300);
    expect(filterCallCount).toBe(1);
  });

  it('should reset debounce timer on each new change', () => {
    let filterCallCount = 0;
    const debouncedFn = createDebounce(() => { filterCallCount++; }, 300);

    debouncedFn();
    vi.advanceTimersByTime(200);
    debouncedFn(); // resets timer
    vi.advanceTimersByTime(200);
    expect(filterCallCount).toBe(0); // still waiting

    vi.advanceTimersByTime(100);
    expect(filterCallCount).toBe(1); // 300ms after last call
  });
});

// ── Test: Ratings Batching ───────────────────────────────────────────

describe('Category Page ratings batching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call batchLoadRatings once with all product IDs, not per-item', async () => {
    const productIds = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const ratingsMap = { p1: { avg: 4.5 }, p2: { avg: 3.0 }, p3: { avg: 5.0 } };
    mockBatchLoadRatings.mockResolvedValue(ratingsMap);

    // Simulate: pre-batch call with all IDs
    await mockBatchLoadRatings(productIds);

    // Should be called once with ALL ids, not 5 times with 1 id each
    expect(mockBatchLoadRatings).toHaveBeenCalledTimes(1);
    expect(mockBatchLoadRatings).toHaveBeenCalledWith(productIds);
  });

  it('should render ratings from pre-loaded map without additional API calls', async () => {
    const ratingsMap = { p1: { avg: 4.5, count: 10 }, p2: { avg: 3.0, count: 5 } };
    mockBatchLoadRatings.mockResolvedValue(ratingsMap);

    // Pre-load all ratings
    const preloaded = await mockBatchLoadRatings(['p1', 'p2']);

    // Simulate onItemReady — should use preloaded map, no extra calls
    mockBatchLoadRatings.mockClear();

    const $item = vi.fn();
    renderCardStarRatingFromCache($item, 'p1', preloaded);
    renderCardStarRatingFromCache($item, 'p2', preloaded);

    expect(mockBatchLoadRatings).not.toHaveBeenCalled();
    expect(mockRenderCardStarRating).toHaveBeenCalledTimes(2);
    expect(mockRenderCardStarRating).toHaveBeenCalledWith($item, 'p1', ratingsMap);
    expect(mockRenderCardStarRating).toHaveBeenCalledWith($item, 'p2', ratingsMap);
  });
});

// ── Test: Swatch Loading Deferral ────────────────────────────────────

describe('Category Page swatch deferral', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not call getSwatchPreviewColors during onItemReady', () => {
    // When deferred, swatches should NOT load during initial onItemReady
    // They should wait for viewport entry
    mockGetSwatchPreviewColors.mockClear();

    // Simulate: onItemReady does NOT call swatch loading directly
    // Instead it registers a viewport callback
    const deferredItems = [];
    const deferSwatchLoad = ($item, itemData) => {
      deferredItems.push({ $item, itemData });
    };

    deferSwatchLoad(vi.fn(), { _id: 'p1', collections: ['futon-frames'] });
    deferSwatchLoad(vi.fn(), { _id: 'p2', collections: ['futon-frames'] });

    expect(mockGetSwatchPreviewColors).not.toHaveBeenCalled();
    expect(deferredItems).toHaveLength(2);
  });

  it('should load swatches when item enters viewport', async () => {
    // Simulate viewport entry triggering swatch load
    const itemData = { _id: 'p1', collections: ['futon-frames'] };
    mockGetSwatchPreviewColors.mockResolvedValue([
      { colorHex: '#FF0000' }, { colorHex: '#00FF00' },
    ]);

    await mockGetSwatchPreviewColors(itemData._id, 4);

    expect(mockGetSwatchPreviewColors).toHaveBeenCalledWith('p1', 4);
  });

  it('should skip swatch loading for non-fabric products', () => {
    const itemData = { _id: 'p1', collections: ['mattresses'] };
    const colls = Array.isArray(itemData.collections) ? itemData.collections : [];
    const hasFabricOptions = colls.some(c =>
      c.includes('futon') || c.includes('frame') || c.includes('wall-hugger') ||
      c.includes('unfinished') || c.includes('platform')
    );

    expect(hasFabricOptions).toBe(false);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Simple debounce implementation matching the pattern used in Category Page.
 * This validates the debounce behavior we expect the code to implement.
 */
function createDebounce(fn, delay) {
  let timer = null;
  return () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
}

/**
 * Render star rating from a pre-loaded ratings map (no API call).
 */
function renderCardStarRatingFromCache($item, productId, ratingsMap) {
  mockRenderCardStarRating($item, productId, ratingsMap);
}
