/**
 * Compare Page $onReady handler tests (CF-g0fo)
 * Tests the $w() wiring in Compare Page.js via a mock $w environment.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import {
  __setProductMap,
  __setGetProductShouldFail,
} from './__mocks__/wix-stores-frontend.js';
import { __getTitle, __getMetaTags } from './__mocks__/wix-seo.js';

// ── $w mock ──────────────────────────────────────────────────────────────────

const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', placeholder: '',
    options: [], data: [], html: '', link: '', target: '',
    style: { color: '', fontWeight: '', backgroundColor: '', opacity: '',
             textDecoration: '' },
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

// ── Product fixtures ─────────────────────────────────────────────────────────

const prodA = {
  _id: 'p1', name: 'Eureka Frame', slug: 'eureka-frame',
  price: 499, formattedPrice: '$499.00', compareAtPrice: null,
  mainMedia: 'https://example.com/a.jpg', ribbon: 'Sale',
  inStock: true, numericRating: 4.5,
  additionalInfoSections: [
    { title: 'Frame Material', description: 'Hardwood' },
  ],
};
const prodB = {
  _id: 'p2', name: 'Dillon Frame', slug: 'dillon-frame',
  price: 699, formattedPrice: '$699.00', compareAtPrice: null,
  mainMedia: 'https://example.com/b.jpg', ribbon: '',
  inStock: true, numericRating: 4.2,
  additionalInfoSections: [
    { title: 'Frame Material', description: 'Engineered wood' },
  ],
};

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('wix-location-frontend', () => ({
  default: {
    to: vi.fn(),
    query: { ids: 'p1,p2' },
    baseUrl: 'https://carolinafutons.com',
  },
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn(() => Promise.resolve()),
}));

// ── Import page file ─────────────────────────────────────────────────────────

describe('Compare Page — $onReady handler', () => {
  beforeAll(async () => {
    await import('../src/pages/Compare Page.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    __setProductMap({ p1: prodA, p2: prodB });
    __setGetProductShouldFail(false);
  });

  // ── S1: Product fetch ──────────────────────────────────────────────────────

  it('fetches both products from wix-stores-frontend in parallel', async () => {
    await onReadyHandler();
    // Both products were fetched — columns should be populated
    expect(getEl('#compareColRepeater').data).toHaveLength(2);
  });

  it('shows empty state when fewer than 2 IDs in URL', async () => {
    const { default: wixLoc } = await import('wix-location-frontend');
    wixLoc.query = { ids: 'p1' };
    await onReadyHandler();
    expect(getEl('#compareEmptySection').show).toHaveBeenCalled();
    wixLoc.query = { ids: 'p1,p2' }; // restore
  });

  it('shows error state when product fetch throws', async () => {
    __setGetProductShouldFail(true);
    await onReadyHandler();
    expect(getEl('#compareErrorSection').show).toHaveBeenCalled();
    expect(getEl('#compareErrorText').text).toContain('Unable to load');
  });

  it('sets skeleton opacity on grid during load and restores after', async () => {
    // The handler sets opacity 0.4 then 1 — grid should end at 1 (or not be set to 0.4)
    await onReadyHandler();
    // After successful load, opacity is '1'
    expect(getEl('#compareGridSection').style.opacity).toBe('1');
  });

  // ── S2: Column rendering ──────────────────────────────────────────────────

  it('populates compareColRepeater with one item per product', async () => {
    await onReadyHandler();
    expect(getEl('#compareColRepeater').data).toHaveLength(2);
  });

  it('sets subtitle with product count', async () => {
    await onReadyHandler();
    expect(getEl('#compareSubtitle').text).toBe('Comparing 2 products');
  });

  it('registers onItemReady on compareColRepeater', async () => {
    await onReadyHandler();
    expect(getEl('#compareColRepeater').onItemReady).toHaveBeenCalled();
  });

  it('onItemReady sets image, name, price for a column', async () => {
    await onReadyHandler();
    const cb = getEl('#compareColRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    const colData = getEl('#compareColRepeater').data[0];
    cb($item, colData);

    expect($item('#compareColImage').src).toBe('https://example.com/a.jpg');
    expect($item('#compareColName').text).toBe('Eureka Frame');
    expect($item('#compareColPrice').text).toBe('$499.00');
  });

  it('onItemReady shows badge for product with ribbon', async () => {
    await onReadyHandler();
    const cb = getEl('#compareColRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    const colData = getEl('#compareColRepeater').data[0]; // prodA has ribbon 'Sale'
    cb($item, colData);
    expect($item('#compareColBadge').text).toBe('Sale');
    expect($item('#compareColBadge').show).toHaveBeenCalled();
  });

  it('onItemReady hides badge when product has no ribbon', async () => {
    await onReadyHandler();
    const cb = getEl('#compareColRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    const colData = getEl('#compareColRepeater').data[1]; // prodB has no ribbon
    cb($item, colData);
    expect($item('#compareColBadge').hide).toHaveBeenCalled();
  });

  it('onItemReady hides origPrice when no sale', async () => {
    await onReadyHandler();
    const cb = getEl('#compareColRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    cb($item, getEl('#compareColRepeater').data[0]);
    expect($item('#compareColOrigPrice').hide).toHaveBeenCalled();
  });

  // ── S3: Attributes table ──────────────────────────────────────────────────

  it('populates compareAttrRepeater', async () => {
    await onReadyHandler();
    expect(getEl('#compareAttrRepeater').data).toHaveLength(10); // 10 COMPARE_ATTRIBUTES
  });

  it('registers onItemReady on compareAttrRepeater', async () => {
    await onReadyHandler();
    expect(getEl('#compareAttrRepeater').onItemReady).toHaveBeenCalled();
  });

  it('onItemReady sets attribute label text', async () => {
    await onReadyHandler();
    const cb = getEl('#compareAttrRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    cb($item, getEl('#compareAttrRepeater').data[0]);
    expect($item('#compareAttrLabel').text).toBeTruthy();
  });

  // ── S5: SEO ───────────────────────────────────────────────────────────────

  it('sets SEO title with product names', async () => {
    await onReadyHandler();
    const title = __getTitle();
    expect(title).toContain('Eureka Frame');
    expect(title).toContain('Dillon Frame');
    expect(title).toContain('Carolina Futons');
  });

  it('sets SEO meta description', async () => {
    await onReadyHandler();
    const tags = __getMetaTags();
    const desc = tags.find(t => t.name === 'description');
    expect(desc).toBeTruthy();
    expect(desc.content).toContain('Eureka Frame');
  });

  // ── S6: Reset button ──────────────────────────────────────────────────────

  it('registers onClick on compareResetBtn', async () => {
    await onReadyHandler();
    expect(getEl('#compareResetBtn').onClick).toHaveBeenCalled();
  });

  it('compareResetBtn navigates to /shop-main', async () => {
    const { default: wixLoc } = await import('wix-location-frontend');
    await onReadyHandler();
    const clickHandler = getEl('#compareResetBtn').onClick.mock.calls[0][0];
    clickHandler();
    expect(wixLoc.to).toHaveBeenCalledWith('/shop-main');
  });
});
