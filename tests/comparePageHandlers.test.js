import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', placeholder: '',
    options: [], data: [], html: '', link: '', target: '',
    style: { color: '', fontWeight: '', backgroundColor: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
  };
}
function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}
let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock data ───────────────────────────────────────────────────

const mockComparisonData = {
  success: true,
  products: [
    { _id: 'p1', name: 'Frame A', slug: 'frame-a', mainMedia: 'img1.jpg', formattedPrice: '$599', ribbon: 'Sale' },
    { _id: 'p2', name: 'Frame B', slug: 'frame-b', mainMedia: 'img2.jpg', formattedPrice: '$799', ribbon: '' },
  ],
  rows: [
    { label: 'Material', cells: [{ value: 'Pine' }, { value: 'Oak' }], differs: true },
  ],
  badges: { bestValue: 'p1', bestRated: 'p2', mostPopular: null },
  sharedCategory: 'futon-frames',
};

const mockGetComparisonData = vi.fn(() => Promise.resolve(mockComparisonData));
const mockBuildShareableUrl = vi.fn(() => Promise.resolve('/compare?ids=p1,p2'));
const mockTrackComparison = vi.fn(() => Promise.resolve());
const mockGetCompareList = vi.fn(() => [{ _id: 'p1' }, { _id: 'p2' }]);
const mockRemoveFromCompare = vi.fn();
const mockAddToCompare = vi.fn();
const mockInitPageSeo = vi.fn();
const mockTrackProductPageView = vi.fn();
const mockCollapseOnMobile = vi.fn();
const mockInitBackToTop = vi.fn();
const mockIsMobile = vi.fn(() => false);
const mockMakeClickable = vi.fn();
const mockAnnounce = vi.fn();
const mockWixLocationTo = vi.fn();
const mockCopyToClipboard = vi.fn(() => Promise.resolve());

// ── Module mocks ────────────────────────────────────────────────

vi.mock('backend/comparisonService.web', () => ({
  getComparisonData: (...args) => mockGetComparisonData(...args),
  buildShareableUrl: (...args) => mockBuildShareableUrl(...args),
  trackComparison: (...args) => mockTrackComparison(...args),
}));

vi.mock('public/galleryHelpers.js', () => ({
  getCompareList: (...args) => mockGetCompareList(...args),
  removeFromCompare: (...args) => mockRemoveFromCompare(...args),
  addToCompare: (...args) => mockAddToCompare(...args),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { sandLight: '#F5F0EB', mountainBlue: '#4A7C59' },
}));

vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: (...args) => mockCollapseOnMobile(...args),
  initBackToTop: (...args) => mockInitBackToTop(...args),
  isMobile: (...args) => mockIsMobile(...args),
}));

vi.mock('public/engagementTracker', () => ({
  trackProductPageView: (...args) => mockTrackProductPageView(...args),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: (...args) => mockAnnounce(...args),
  makeClickable: (...args) => mockMakeClickable(...args),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: (...args) => mockInitPageSeo(...args),
}));

vi.mock('wix-location-frontend', () => ({
  default: {
    to: (...args) => mockWixLocationTo(...args),
    query: { ids: 'p1,p2' },
    baseUrl: 'https://carolinafutons.com',
  },
}));

vi.mock('wix-window-frontend', () => ({
  copyToClipboard: (...args) => mockCopyToClipboard(...args),
}));

// ── Test suite ──────────────────────────────────────────────────

describe('Compare Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Compare Page.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── 1. initPageSeo ──────────────────────────────────────────

  it('calls initPageSeo with compareProducts', async () => {
    await onReadyHandler();
    expect(mockInitPageSeo).toHaveBeenCalledWith('compareProducts');
  });

  // ── 2. Gets product IDs from URL query ──────────────────────

  it('parses product IDs from wixLocationFrontend.query.ids', async () => {
    await onReadyHandler();
    expect(mockGetComparisonData).toHaveBeenCalledWith(['p1', 'p2']);
  });

  // ── 3. Calls getComparisonData ──────────────────────────────

  it('calls getComparisonData with the parsed product IDs', async () => {
    await onReadyHandler();
    expect(mockGetComparisonData).toHaveBeenCalledTimes(1);
    expect(mockGetComparisonData).toHaveBeenCalledWith(['p1', 'p2']);
  });

  // ── 4. Tracks page view and comparison ──────────────────────

  it('tracks page view and comparison event', async () => {
    await onReadyHandler();
    expect(mockTrackProductPageView).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Product Comparison' })
    );
    expect(mockTrackComparison).toHaveBeenCalledWith(['p1', 'p2']);
  });

  // ── 5. Loading state ────────────────────────────────────────

  it('shows loading indicator then hides it after data loads', async () => {
    await onReadyHandler();
    const loading = getEl('#compareLoading');
    expect(loading.show).toHaveBeenCalled();
    expect(loading.hide).toHaveBeenCalled();
  });

  // ── 6. Product headers: image, name, price ──────────────────

  it('sets product image, name, and price for each header column', async () => {
    await onReadyHandler();

    expect(getEl('#compareImage1').src).toBe('img1.jpg');
    expect(getEl('#compareImage1').alt).toBe('Frame A - Carolina Futons');
    expect(getEl('#compareName1').text).toBe('Frame A');
    expect(getEl('#comparePrice1').text).toBe('$599');

    expect(getEl('#compareImage2').src).toBe('img2.jpg');
    expect(getEl('#compareImage2').alt).toBe('Frame B - Carolina Futons');
    expect(getEl('#compareName2').text).toBe('Frame B');
    expect(getEl('#comparePrice2').text).toBe('$799');
  });

  // ── 7. Ribbon badges ───────────────────────────────────────

  it('shows ribbon badge when present and hides when empty', async () => {
    await onReadyHandler();

    expect(getEl('#compareBadge1').text).toBe('Sale');
    expect(getEl('#compareBadge1').show).toHaveBeenCalled();
    expect(getEl('#compareBadge2').hide).toHaveBeenCalled();
  });

  // ── 8. Page title ──────────────────────────────────────────

  it('sets comparison page title to "Comparing 2 Products"', async () => {
    await onReadyHandler();
    expect(getEl('#comparePageTitle').text).toBe('Comparing 2 Products');
  });

  // ── 9. Comparison rows repeater ────────────────────────────

  it('sets repeater data and onItemReady renders label and cell values', async () => {
    await onReadyHandler();

    const repeater = getEl('#comparisonRowRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data).toEqual([
      { _id: 'row-0', label: 'Material', cells: [{ value: 'Pine' }, { value: 'Oak' }], differs: true },
    ]);

    // Simulate onItemReady callback
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    const itemData = { _id: 'row-0', label: 'Material', cells: [{ value: 'Pine' }, { value: 'Oak' }], differs: true };
    itemReadyCb($item, itemData);

    expect($item('#rowLabel').text).toBe('Material');
    expect($item('#rowCell1').text).toBe('Pine');
    expect($item('#rowCell2').text).toBe('Oak');
  });

  // ── 10. Diff highlighting ──────────────────────────────────

  it('applies sandLight background color when row differs', async () => {
    await onReadyHandler();

    const repeater = getEl('#comparisonRowRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    const itemData = { _id: 'row-0', label: 'Material', cells: [{ value: 'Pine' }, { value: 'Oak' }], differs: true };
    itemReadyCb($item, itemData);

    expect($item('#rowCell1').style.backgroundColor).toBe('#F5F0EB');
    expect($item('#rowCell2').style.backgroundColor).toBe('#F5F0EB');
  });

  // ── 11. Winner badges ─────────────────────────────────────

  it('shows "Best Value" badge for p1 and "Best Rated" for p2', async () => {
    await onReadyHandler();

    expect(getEl('#winnerBadge1').text).toBe('Best Value');
    expect(getEl('#winnerBadge1').show).toHaveBeenCalled();
    expect(getEl('#winnerBadge1').style.color).toBe('#4A7C59');

    expect(getEl('#winnerBadge2').text).toBe('Best Rated');
    expect(getEl('#winnerBadge2').show).toHaveBeenCalled();
    expect(getEl('#winnerBadge2').style.color).toBe('#4A7C59');
  });

  // ── 12. Share button ──────────────────────────────────────

  it('calls buildShareableUrl and registers onClick on share button', async () => {
    await onReadyHandler();

    expect(mockBuildShareableUrl).toHaveBeenCalledWith(['p1', 'p2']);
    expect(getEl('#shareCompareBtn').onClick).toHaveBeenCalled();
  });

  // ── 13. Share button click copies URL ─────────────────────

  it('copies full shareable URL to clipboard on share click', async () => {
    await onReadyHandler();

    const clickHandler = getEl('#shareCompareBtn').onClick.mock.calls[0][0];
    await clickHandler();

    expect(mockCopyToClipboard).toHaveBeenCalledWith('https://carolinafutons.com/compare?ids=p1,p2');
    expect(getEl('#shareCompareBtn').label).toBe('Link Copied!');
    expect(mockAnnounce).toHaveBeenCalledWith($w, 'Comparison link copied to clipboard');
  });

  // ── 14. Remove buttons ────────────────────────────────────

  it('registers onClick for each product remove button, calls removeFromCompare', async () => {
    await onReadyHandler();

    expect(getEl('#removeProduct1').onClick).toHaveBeenCalled();
    expect(getEl('#removeProduct2').onClick).toHaveBeenCalled();

    // Simulate clicking remove on product 1 — only 1 remaining, shows empty state
    const removeCb = getEl('#removeProduct1').onClick.mock.calls[0][0];
    await removeCb();
    expect(mockRemoveFromCompare).toHaveBeenCalledWith('p1');
  });

  // ── 15. Add product button ────────────────────────────────

  it('registers onClick on add product button that navigates to shared category', async () => {
    await onReadyHandler();

    expect(getEl('#addProductBtn').onClick).toHaveBeenCalled();

    const addCb = getEl('#addProductBtn').onClick.mock.calls[0][0];
    addCb();
    expect(mockWixLocationTo).toHaveBeenCalledWith('/futon-frames');
  });

  // ── 16. Empty state when fewer than 2 products ────────────

  it('shows empty state when fewer than 2 products are available', async () => {
    const { default: wixLoc } = await import('wix-location-frontend');
    const origQuery = wixLoc.query;
    wixLoc.query = { ids: '' };
    mockGetCompareList.mockReturnValueOnce([]);

    await onReadyHandler();

    expect(getEl('#compareEmptyState').show).toHaveBeenCalled();
    expect(getEl('#compareEmptyState').expand).toHaveBeenCalled();
    expect(getEl('#emptyStateTitle').text).toBe('Compare Products');

    // Restore
    wixLoc.query = origQuery;
  });

  // ── 17. ARIA region roles and labels on product columns ───

  it('sets ARIA region role and label on product columns', async () => {
    await onReadyHandler();

    expect(getEl('#compareCol1').accessibility.role).toBe('region');
    expect(getEl('#compareCol1').accessibility.ariaLabel).toBe('Product 1: Frame A');

    expect(getEl('#compareCol2').accessibility.role).toBe('region');
    expect(getEl('#compareCol2').accessibility.ariaLabel).toBe('Product 2: Frame B');
  });

  // ── 18. Content visibility after successful load ──────────

  it('shows compare content and hides loading after successful data fetch', async () => {
    await onReadyHandler();

    expect(getEl('#compareContent').hide).toHaveBeenCalled();
    expect(getEl('#compareContent').show).toHaveBeenCalled();
  });
});
