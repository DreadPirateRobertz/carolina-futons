import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// $w mock infrastructure
// ---------------------------------------------------------------------------
const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
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
    focus: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
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

// ---------------------------------------------------------------------------
// Mock ALL imports before they are pulled in
// ---------------------------------------------------------------------------
vi.mock('backend/productRecommendations.web', () => ({
  getSaleProducts: vi.fn(() => Promise.resolve([
    { _id: 'p1', name: 'Deluxe Futon', originalPrice: 599, salePrice: 449 },
    { _id: 'p2', name: 'Classic Futon', originalPrice: 399, salePrice: 299 },
  ])),
}));

vi.mock('backend/promotions.web', () => ({
  getActivePromotion: vi.fn(() => Promise.resolve({
    title: 'Spring Blowout',
    bannerMessage: '25% off everything!',
  })),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
}));

vi.mock('public/salePageHelpers.js', () => ({
  getPriceMatchNote: vi.fn(() => 'We match any competitor price.'),
  formatSalePrice: vi.fn((item) => `$${item.salePrice}`),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Sale page handlers', () => {
  let getSaleProducts, getActivePromotion, initPageSeo, trackEvent,
    initBackToTop, makeClickable, getPriceMatchNote, formatSalePrice;

  beforeAll(async () => {
    const prodRec = await import('backend/productRecommendations.web');
    getSaleProducts = prodRec.getSaleProducts;

    const promos = await import('backend/promotions.web');
    getActivePromotion = promos.getActivePromotion;

    const seo = await import('public/pageSeo.js');
    initPageSeo = seo.initPageSeo;

    const tracker = await import('public/engagementTracker');
    trackEvent = tracker.trackEvent;

    const mobile = await import('public/mobileHelpers');
    initBackToTop = mobile.initBackToTop;

    const a11y = await import('public/a11yHelpers.js');
    makeClickable = a11y.makeClickable;

    const saleHelpers = await import('public/salePageHelpers.js');
    getPriceMatchNote = saleHelpers.getPriceMatchNote;
    formatSalePrice = saleHelpers.formatSalePrice;

    await import('../src/pages/Sale.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();

    getSaleProducts.mockResolvedValue([
      { _id: 'p1', name: 'Deluxe Futon', originalPrice: 599, salePrice: 449 },
      { _id: 'p2', name: 'Classic Futon', originalPrice: 399, salePrice: 299 },
    ]);
    getActivePromotion.mockResolvedValue({
      title: 'Spring Blowout',
      bannerMessage: '25% off everything!',
    });
    getPriceMatchNote.mockReturnValue('We match any competitor price.');
    formatSalePrice.mockImplementation((item) => `$${item.salePrice}`);
  });

  it('calls initBackToTop with $w', async () => {
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });

  it('calls initPageSeo with "sale"', async () => {
    await onReadyHandler();
    expect(initPageSeo).toHaveBeenCalledWith('sale');
  });

  it('tracks page_view event for sale page', async () => {
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'sale' });
  });

  it('sets promotion title and banner message', async () => {
    await onReadyHandler();
    expect(getEl('#salePromoTitle').text).toBe('Spring Blowout');
    expect(getEl('#salePromoBanner').text).toBe('25% off everything!');
  });

  it('sets price match note text', async () => {
    await onReadyHandler();
    expect(getPriceMatchNote).toHaveBeenCalled();
    expect(getEl('#salePriceMatchNote').text).toBe('We match any competitor price.');
  });

  it('sets sale products repeater data and registers onItemReady', async () => {
    await onReadyHandler();
    const repeater = getEl('#saleProductRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data).toEqual([
      { _id: 'p1', name: 'Deluxe Futon', originalPrice: 599, salePrice: 449 },
      { _id: 'p2', name: 'Classic Futon', originalPrice: 399, salePrice: 299 },
    ]);
  });

  it('sets repeater aria label', async () => {
    await onReadyHandler();
    const repeater = getEl('#saleProductRepeater');
    expect(repeater.accessibility.ariaLabel).toBe('Products on sale');
  });

  it('onItemReady sets product name and formatted sale price', async () => {
    await onReadyHandler();
    const repeater = getEl('#saleProductRepeater');
    const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };
    const itemData = { _id: 'p1', name: 'Deluxe Futon', originalPrice: 599, salePrice: 449 };

    onItemReadyCb($item, itemData);

    expect($item('#saleProductName').text).toBe('Deluxe Futon');
    expect(formatSalePrice).toHaveBeenCalledWith(itemData);
    expect($item('#saleProductPrice').text).toBe('$449');
  });

  it('calls makeClickable for the shop link', async () => {
    await onReadyHandler();
    expect(makeClickable).toHaveBeenCalledWith(
      getEl('#saleShopLink'),
      expect.any(Function),
      { ariaLabel: 'Browse all products' }
    );
  });

  it('assigns _id from index when product has no _id', async () => {
    getSaleProducts.mockResolvedValue([
      { name: 'No-ID Futon', originalPrice: 299, salePrice: 199 },
    ]);
    await onReadyHandler();
    const repeater = getEl('#saleProductRepeater');
    expect(repeater.data).toEqual([
      { _id: '0', name: 'No-ID Futon', originalPrice: 299, salePrice: 199 },
    ]);
  });

  it('handles no active promotion gracefully', async () => {
    getActivePromotion.mockResolvedValue(null);
    await onReadyHandler();
    // Should not throw; promo elements remain at default empty string
    expect(getEl('#salePromoTitle').text).toBe('');
    expect(getEl('#salePromoBanner').text).toBe('');
  });
});
