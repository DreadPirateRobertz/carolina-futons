/**
 * Tests for src/pages/Bundle.js
 *
 * Covers: initBundle — product load, selection, deselect, max-cap,
 * UI state updates, pricing, add-to-cart, remove from summary,
 * a11y announcements, error states, element nicknames.
 *
 * See CF-7wm9 for original specification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('backend/bundleBuilder.web.js', () => ({
  getBundlePageProducts: vi.fn(),
  calculateBundlePrice: vi.fn(),
  addBundleToCart: vi.fn(),
}));

import { initBundle } from '../src/pages/Bundle.js';
import { announce } from 'public/a11yHelpers.js';
import {
  getBundlePageProducts,
  calculateBundlePrice,
  addBundleToCart,
} from 'backend/bundleBuilder.web.js';

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    label: '',
    value: '',
    accessibility: {},
    customClassList: { add: vi.fn(), remove: vi.fn() },
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    src: '',
    alt: '',
  };
}

function createMockRepeater() {
  const el = createMockElement();
  let _data = [];
  el.onItemReady = vi.fn();
  el.forEachItem = vi.fn((cb) => _data.forEach(item => cb(createMock$w(), item)));
  Object.defineProperty(el, 'data', {
    configurable: true,
    get: () => _data,
    set: (v) => { _data = v; },
  });
  return el;
}

function createMock$w(repeaterOverrides = {}) {
  const elements = {};
  const repeaters = {
    '#bundleProductRepeater': createMockRepeater(),
    '#bundleSummaryRepeater': createMockRepeater(),
    ...repeaterOverrides,
  };
  return vi.fn((selector) => {
    if (repeaters[selector]) return repeaters[selector];
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  });
}

const MOCK_PRODUCTS = [
  { _id: 'p1', name: 'Hardwood Frame', price: 299, formattedPrice: '$299.00', mainMedia: { url: 'img1.jpg' } },
  { _id: 'p2', name: 'Cotton Mattress', price: 199, formattedPrice: '$199.00', mainMedia: { url: 'img2.jpg' } },
  { _id: 'p3', name: 'Denim Cover',    price: 89,  formattedPrice: '$89.00',  mainMedia: { url: 'img3.jpg' } },
  { _id: 'p4', name: 'Oak Frame',      price: 349, formattedPrice: '$349.00', mainMedia: { url: 'img4.jpg' } },
  { _id: 'p5', name: 'Memory Foam',    price: 249, formattedPrice: '$249.00', mainMedia: { url: 'img5.jpg' } },
];

function mockProducts(products = MOCK_PRODUCTS) {
  getBundlePageProducts.mockResolvedValue({ success: true, products });
}

function mockPrice(overrides = {}) {
  calculateBundlePrice.mockResolvedValue({
    success: true,
    bundlePrice: 450,
    savings: 50,
    discountPercent: 10,
    tier: 'Essentials Bundle',
    ...overrides,
  });
}

function standardSetup(repeaterOverrides = {}) {
  vi.clearAllMocks();
  const $w = createMock$w(repeaterOverrides);
  return { $w };
}

// Returns the onItemReady handler registered for a repeater
function getItemReadyHandler(repeaterEl) {
  const calls = repeaterEl.onItemReady.mock.calls;
  if (!calls.length) throw new Error('No onItemReady handler registered on repeater');
  return calls[calls.length - 1][0];
}

// Calls onItemReady with a fresh $item mock and the given itemData
function callItemReady(repeaterEl, itemData) {
  const handler = getItemReadyHandler(repeaterEl);
  const $item = createMock$w();
  handler($item, itemData);
  return $item;
}

// Returns the onClick handler registered on an element
function getClickHandler(el) {
  const calls = el.onClick.mock.calls;
  if (!calls.length) throw new Error('No onClick handler registered on element');
  return calls[calls.length - 1][0];
}

// ── initBundle — setup ────────────────────────────────────────────────

describe('initBundle — setup', () => {
  let $w;

  beforeEach(() => {
    ({ $w } = standardSetup());
    mockProducts();
    mockPrice();
  });

  it('shows bundleLoader while loading', async () => {
    let resolveProducts;
    getBundlePageProducts.mockReturnValue(new Promise(r => { resolveProducts = r; }));
    const pending = initBundle($w);
    expect($w('#bundleLoader').show).toHaveBeenCalled();
    resolveProducts({ success: true, products: MOCK_PRODUCTS });
    await pending;
  });

  it('hides bundleLoader after products load', async () => {
    await initBundle($w);
    expect($w('#bundleLoader').hide).toHaveBeenCalled();
  });

  it('hides bundleLoader even when getBundlePageProducts throws', async () => {
    getBundlePageProducts.mockRejectedValue(new Error('network error'));
    await initBundle($w);
    expect($w('#bundleLoader').hide).toHaveBeenCalled();
  });

  it('collapses bundleSummarySection initially', async () => {
    await initBundle($w);
    expect($w('#bundleSummarySection').collapse).toHaveBeenCalled();
  });

  it('hides bundleDiscountBadge initially', async () => {
    await initBundle($w);
    expect($w('#bundleDiscountBadge').hide).toHaveBeenCalled();
  });

  it('hides bundleError initially', async () => {
    await initBundle($w);
    expect($w('#bundleError').hide).toHaveBeenCalled();
  });

  it('disables bundleAddToCartBtn initially', async () => {
    await initBundle($w);
    expect($w('#bundleAddToCartBtn').disable).toHaveBeenCalled();
  });

  it('shows bundleEmptyState initially', async () => {
    await initBundle($w);
    expect($w('#bundleEmptyState').show).toHaveBeenCalled();
  });

  it('calls getBundlePageProducts', async () => {
    await initBundle($w);
    expect(getBundlePageProducts).toHaveBeenCalled();
  });

  it('registers onItemReady on bundleProductRepeater before setting .data', async () => {
    const productRepeater = createMockRepeater();
    const callOrder = [];
    productRepeater.onItemReady.mockImplementation(() => callOrder.push('onItemReady'));
    Object.defineProperty(productRepeater, 'data', {
      get: () => [],
      set: () => callOrder.push('data'),
    });
    const { $w } = standardSetup({ '#bundleProductRepeater': productRepeater });
    mockProducts();
    mockPrice();
    await initBundle($w);
    const onItemReadyIdx = callOrder.indexOf('onItemReady');
    const dataIdx = callOrder.indexOf('data');
    expect(onItemReadyIdx).toBeGreaterThanOrEqual(0);
    expect(dataIdx).toBeGreaterThan(onItemReadyIdx);
  });

  it('registers onItemReady on bundleSummaryRepeater', async () => {
    // Summary repeater .data is only set after selections — just verify onItemReady is wired.
    const summaryRepeater = createMockRepeater();
    const { $w } = standardSetup({ '#bundleSummaryRepeater': summaryRepeater });
    mockProducts();
    mockPrice();
    await initBundle($w);
    expect(summaryRepeater.onItemReady).toHaveBeenCalled();
  });
});

// ── product repeater items ────────────────────────────────────────────

describe('initBundle — product repeater item rendering', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockProducts();
    mockPrice();
    await initBundle($w);
  });

  it('sets bundleProductRepeater.data with all products', () => {
    expect($w('#bundleProductRepeater').data).toHaveLength(MOCK_PRODUCTS.length);
  });

  it('populates bundleProductName on onItemReady', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item('#bundleProductName').text).toBe('Hardwood Frame');
  });

  it('populates bundleProductPrice on onItemReady', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item('#bundleProductPrice').text).toBe('$299.00');
  });

  it('sets bundleProductImage src on onItemReady', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item('#bundleProductImage').src).toBe('img1.jpg');
  });

  it('hides bundleSelectedBadge initially on onItemReady', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item('#bundleSelectedBadge').hide).toHaveBeenCalled();
  });

  it('wires onClick on bundleSelectBtn during onItemReady', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item('#bundleSelectBtn').onClick).toHaveBeenCalled();
  });

  it('sets ariaPressed to "false" on bundleSelectBtn initially', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item('#bundleSelectBtn').accessibility.ariaPressed).toBe('false');
  });
});

// ── selection state ───────────────────────────────────────────────────

describe('initBundle — selection', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockProducts();
    mockPrice();
    await initBundle($w);
  });

  it('selects item on bundleSelectBtn click', async () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($item('#bundleSelectBtn'))();
    expect($w('#bundleProductRepeater').data.find(d => d._id === 'p1')?.selected).toBe(true);
  });

  it('deselects already-selected item on second click', async () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($item('#bundleSelectBtn'))();
    await getClickHandler($item('#bundleSelectBtn'))();
    expect($w('#bundleProductRepeater').data.find(d => d._id === 'p1')?.selected).toBeFalsy();
  });

  it('shows bundleSelectedBadge when item is selected', async () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($item('#bundleSelectBtn'))();
    expect($item('#bundleSelectedBadge').show).toHaveBeenCalled();
  });

  it('sets ariaPressed to "true" when item is selected', async () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($item('#bundleSelectBtn'))();
    expect($item('#bundleSelectBtn').accessibility.ariaPressed).toBe('true');
  });

  it('sets ariaPressed back to "false" when item is deselected', async () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($item('#bundleSelectBtn'))(); // select
    await getClickHandler($item('#bundleSelectBtn'))(); // deselect
    expect($item('#bundleSelectBtn').accessibility.ariaPressed).toBe('false');
  });

  it('hides bundleSelectedBadge when item is deselected', async () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($item('#bundleSelectBtn'))();
    await getClickHandler($item('#bundleSelectBtn'))();
    expect($item('#bundleSelectedBadge').hide).toHaveBeenCalledTimes(2); // once in onItemReady, once on deselect
  });
});

// ── max cap ───────────────────────────────────────────────────────────

describe('initBundle — max 4 items cap', () => {
  it('allows selecting up to 4 items', async () => {
    const { $w } = standardSetup();
    mockProducts();
    mockPrice();
    await initBundle($w);
    for (const product of MOCK_PRODUCTS.slice(0, 4)) {
      const $item = callItemReady($w('#bundleProductRepeater'), product);
      await getClickHandler($item('#bundleSelectBtn'))();
    }
    const selectedCount = $w('#bundleProductRepeater').data.filter(d => d.selected).length;
    expect(selectedCount).toBe(4);
  });

  it('does not select a 5th item beyond max cap', async () => {
    const { $w } = standardSetup();
    mockProducts();
    mockPrice();
    await initBundle($w);
    for (const product of MOCK_PRODUCTS.slice(0, 4)) {
      const $item = callItemReady($w('#bundleProductRepeater'), product);
      await getClickHandler($item('#bundleSelectBtn'))();
    }
    // Try to select 5th
    const $item5 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[4]);
    await getClickHandler($item5('#bundleSelectBtn'))();
    const selectedCount = $w('#bundleProductRepeater').data.filter(d => d.selected).length;
    expect(selectedCount).toBe(4);
  });

  it('announces max-cap when 5th item attempted', async () => {
    const { $w } = standardSetup();
    mockProducts();
    mockPrice();
    await initBundle($w);
    for (const product of MOCK_PRODUCTS.slice(0, 4)) {
      const $item = callItemReady($w('#bundleProductRepeater'), product);
      await getClickHandler($item('#bundleSelectBtn'))();
    }
    // Clear only announce mock so onItemReady handler registration is preserved.
    announce.mockClear();
    const $item5 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[4]);
    await getClickHandler($item5('#bundleSelectBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/max|4|limit/i));
  });
});

// ── UI state: < 2 selected ────────────────────────────────────────────

describe('initBundle — UI state with 0 selected', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockProducts();
    mockPrice();
    await initBundle($w);
  });

  it('keeps addToCartBtn disabled with 0 selected', () => {
    expect($w('#bundleAddToCartBtn').disable).toHaveBeenCalled();
    expect($w('#bundleAddToCartBtn').enable).not.toHaveBeenCalled();
  });

  it('shows bundleEmptyState with 0 selected', () => {
    expect($w('#bundleEmptyState').show).toHaveBeenCalled();
  });

  it('keeps bundleSummarySection collapsed with 0 selected', () => {
    expect($w('#bundleSummarySection').expand).not.toHaveBeenCalled();
  });

  it('keeps bundleDiscountBadge hidden with 0 selected', () => {
    expect($w('#bundleDiscountBadge').show).not.toHaveBeenCalled();
  });
});

// ── UI state: ≥ 2 selected ────────────────────────────────────────────

describe('initBundle — UI state with ≥2 selected', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockProducts();
    mockPrice();
    await initBundle($w);
    // Select two items
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    const $item2 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[1]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    await getClickHandler($item2('#bundleSelectBtn'))();
  });

  it('enables bundleAddToCartBtn with 2 selected', () => {
    expect($w('#bundleAddToCartBtn').enable).toHaveBeenCalled();
  });

  it('sets bundleAddToCartBtn label with item count', () => {
    expect($w('#bundleAddToCartBtn').label).toMatch(/2 items/i);
  });

  it('expands bundleSummarySection with 2 selected', () => {
    expect($w('#bundleSummarySection').expand).toHaveBeenCalled();
  });

  it('hides bundleEmptyState with 2 selected', () => {
    expect($w('#bundleEmptyState').hide).toHaveBeenCalled();
  });

  it('shows bundleDiscountBadge with 2 selected', () => {
    expect($w('#bundleDiscountBadge').show).toHaveBeenCalled();
  });

  it('updates bundleDiscountBadge text with discount percent', () => {
    expect($w('#bundleDiscountBadge').text).toMatch(/10%|Save/i);
  });

  it('updates bundleTotalPrice text', () => {
    expect($w('#bundleTotalPrice').text).toMatch(/Bundle Total/i);
  });
});

// ── pricing ───────────────────────────────────────────────────────────

describe('initBundle — pricing', () => {
  it('calls calculateBundlePrice when ≥2 items selected', async () => {
    const { $w } = standardSetup();
    mockProducts();
    mockPrice();
    await initBundle($w);
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    const $item2 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[1]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    await getClickHandler($item2('#bundleSelectBtn'))();
    expect(calculateBundlePrice).toHaveBeenCalledWith(['p1', 'p2']);
  });

  it('does not call calculateBundlePrice with only 1 item', async () => {
    const { $w } = standardSetup();
    mockProducts();
    mockPrice();
    await initBundle($w);
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    expect(calculateBundlePrice).not.toHaveBeenCalled();
  });

  it('falls back to sum of individual prices when bundlePrice is NaN', async () => {
    const { $w } = standardSetup();
    mockProducts();
    calculateBundlePrice.mockResolvedValue({ success: true, bundlePrice: NaN, savings: NaN, discountPercent: 10 });
    await initBundle($w);
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    const $item2 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[1]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    await getClickHandler($item2('#bundleSelectBtn'))();
    // Should show $498.00 (299 + 199), not "$NaN"
    expect($w('#bundleTotalPrice').text).toMatch(/\$\d+\.\d{2}/);
    expect($w('#bundleTotalPrice').text).not.toContain('NaN');
  });

  it('falls back to sum of individual prices when bundlePrice is Infinity', async () => {
    const { $w } = standardSetup();
    mockProducts();
    calculateBundlePrice.mockResolvedValue({ success: true, bundlePrice: Infinity, discountPercent: 0 });
    await initBundle($w);
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    const $item2 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[1]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    await getClickHandler($item2('#bundleSelectBtn'))();
    expect($w('#bundleTotalPrice').text).not.toContain('Infinity');
    expect($w('#bundleTotalPrice').text).toMatch(/\$\d+\.\d{2}/);
  });

  it('hides discount badge when calculateBundlePrice returns no discount', async () => {
    const { $w } = standardSetup();
    mockProducts();
    calculateBundlePrice.mockResolvedValue({ success: true, bundlePrice: 498, savings: 0, discountPercent: 0 });
    await initBundle($w);
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    const $item2 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[1]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    await getClickHandler($item2('#bundleSelectBtn'))();
    // With 0 discount, badge should be hidden
    expect($w('#bundleDiscountBadge').hide).toHaveBeenCalled();
  });
});

// ── summary repeater ──────────────────────────────────────────────────

describe('initBundle — summary repeater', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockProducts();
    mockPrice();
    await initBundle($w);
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    const $item2 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[1]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    await getClickHandler($item2('#bundleSelectBtn'))();
  });

  it('populates bundleSummaryRepeater.data with selected items', () => {
    expect($w('#bundleSummaryRepeater').data).toHaveLength(2);
  });

  it('summary item has correct name', () => {
    const item = $w('#bundleSummaryRepeater').data.find(d => d._id === 'p1');
    expect(item?.name).toBe('Hardwood Frame');
  });

  it('renders bundleSummaryName in onItemReady', () => {
    const $item = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    expect($item('#bundleSummaryName').text).toBe('Hardwood Frame');
  });

  it('renders bundleSummaryPrice in onItemReady', () => {
    const $item = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    expect($item('#bundleSummaryPrice').text).toBe('$299.00');
  });

  it('wires onClick on bundleSummaryRemoveBtn in onItemReady', () => {
    const $item = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    expect($item('#bundleSummaryRemoveBtn').onClick).toHaveBeenCalled();
  });
});

// ── remove from summary ───────────────────────────────────────────────

describe('initBundle — remove item via summary', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockProducts();
    mockPrice();
    await initBundle($w);
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    const $item2 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[1]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    await getClickHandler($item2('#bundleSelectBtn'))();
  });

  it('removes item from selection when remove button clicked', async () => {
    const $summaryItem = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($summaryItem('#bundleSummaryRemoveBtn'))();
    expect($w('#bundleSummaryRepeater').data.find(d => d._id === 'p1')).toBeUndefined();
  });

  it('collapses summarySection when selection drops below 2', async () => {
    const $summaryItem = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    const collapsesBefore = $w('#bundleSummarySection').collapse.mock.calls.length;
    await getClickHandler($summaryItem('#bundleSummaryRemoveBtn'))();
    expect($w('#bundleSummarySection').collapse.mock.calls.length).toBeGreaterThan(collapsesBefore);
  });

  it('announces item removal', async () => {
    const $summaryItem = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($summaryItem('#bundleSummaryRemoveBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/removed|Hardwood Frame/i));
  });

  it('deselects item in product repeater data when removed', async () => {
    const $summaryItem = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($summaryItem('#bundleSummaryRemoveBtn'))();
    expect($w('#bundleProductRepeater').data.find(d => d._id === 'p1')?.selected).toBeFalsy();
  });
});

// ── add to cart ───────────────────────────────────────────────────────

describe('initBundle — add to cart', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockProducts();
    mockPrice();
    await initBundle($w);
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    const $item2 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[1]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    await getClickHandler($item2('#bundleSelectBtn'))();
  });

  it('calls addBundleToCart with selected product IDs', async () => {
    addBundleToCart.mockResolvedValue({ success: true });
    await getClickHandler($w('#bundleAddToCartBtn'))();
    expect(addBundleToCart).toHaveBeenCalledWith(expect.arrayContaining(['p1', 'p2']));
  });

  it('clears selection after successful add', async () => {
    addBundleToCart.mockResolvedValue({ success: true });
    await getClickHandler($w('#bundleAddToCartBtn'))();
    const selected = $w('#bundleProductRepeater').data.filter(d => d.selected);
    expect(selected).toHaveLength(0);
  });

  it('announces success after add to cart', async () => {
    addBundleToCart.mockResolvedValue({ success: true });
    await getClickHandler($w('#bundleAddToCartBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/added|cart/i));
  });

  it('shows bundleError when addBundleToCart returns success: false', async () => {
    addBundleToCart.mockResolvedValue({ success: false, error: 'Cart unavailable' });
    await getClickHandler($w('#bundleAddToCartBtn'))();
    expect($w('#bundleError').show).toHaveBeenCalled();
    expect($w('#bundleError').text).toMatch(/Cart unavailable|unable/i);
  });

  it('shows bundleError when addBundleToCart throws', async () => {
    addBundleToCart.mockRejectedValue(new Error('network error'));
    await getClickHandler($w('#bundleAddToCartBtn'))();
    expect($w('#bundleError').show).toHaveBeenCalled();
  });

  it('announces error when addBundleToCart fails', async () => {
    addBundleToCart.mockResolvedValue({ success: false, error: 'Cart unavailable' });
    await getClickHandler($w('#bundleAddToCartBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/error|unable|unavailable|try again/i));
  });

  it('does not clear selection when addBundleToCart returns success: false', async () => {
    addBundleToCart.mockResolvedValue({ success: false, error: 'Cart unavailable' });
    await getClickHandler($w('#bundleAddToCartBtn'))();
    const selected = $w('#bundleProductRepeater').data.filter(d => d.selected);
    expect(selected).toHaveLength(2);
  });

  it('does not throw when addBundleToCart throws', async () => {
    addBundleToCart.mockRejectedValue(new Error('network error'));
    await expect(getClickHandler($w('#bundleAddToCartBtn'))()).resolves.not.toThrow();
  });
});

// ── error handling ────────────────────────────────────────────────────

describe('initBundle — error handling', () => {
  it('shows bundleError when getBundlePageProducts returns success: false', async () => {
    const { $w } = standardSetup();
    getBundlePageProducts.mockResolvedValue({ success: false, error: 'CMS unavailable' });
    await initBundle($w);
    expect($w('#bundleError').show).toHaveBeenCalled();
  });

  it('shows bundleError when getBundlePageProducts throws', async () => {
    const { $w } = standardSetup();
    getBundlePageProducts.mockRejectedValue(new Error('network error'));
    await initBundle($w);
    expect($w('#bundleError').show).toHaveBeenCalled();
  });

  it('does not throw when getBundlePageProducts throws', async () => {
    const { $w } = standardSetup();
    getBundlePageProducts.mockRejectedValue(new Error('network error'));
    await expect(initBundle($w)).resolves.not.toThrow();
  });

  it('logs error when getBundlePageProducts throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { $w } = standardSetup();
    getBundlePageProducts.mockRejectedValue(new Error('network error'));
    await initBundle($w);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('hides bundleLoader even on error', async () => {
    const { $w } = standardSetup();
    getBundlePageProducts.mockRejectedValue(new Error('network error'));
    await initBundle($w);
    expect($w('#bundleLoader').hide).toHaveBeenCalled();
  });
});

// ── a11y announcements ────────────────────────────────────────────────

describe('initBundle — accessibility announcements', () => {
  it('announces when item is selected', async () => {
    const { $w } = standardSetup();
    mockProducts();
    mockPrice();
    await initBundle($w);
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($item('#bundleSelectBtn'))();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/Hardwood Frame|added|selected/i));
  });

  it('announces when item is deselected', async () => {
    const { $w } = standardSetup();
    mockProducts();
    mockPrice();
    await initBundle($w);
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    await getClickHandler($item('#bundleSelectBtn'))(); // select
    // Clear only the announce mock so click handler registration is preserved.
    announce.mockClear();
    await getClickHandler($item('#bundleSelectBtn'))(); // deselect
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/removed|deselected/i));
  });
});

// ── element nicknames ─────────────────────────────────────────────────

describe('element nicknames — all required IDs are addressed', () => {
  let $w;

  beforeEach(async () => {
    ({ $w } = standardSetup());
    mockProducts();
    mockPrice();
    await initBundle($w);
    // Trigger some interactions to touch all elements
    const $item1 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    const $item2 = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[1]);
    await getClickHandler($item1('#bundleSelectBtn'))();
    await getClickHandler($item2('#bundleSelectBtn'))();
    callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
  });

  it('addresses #bundleHeroSection', () => {
    expect($w).toHaveBeenCalledWith('#bundleHeroSection');
  });

  it('addresses #bundleProductRepeater', () => {
    expect($w).toHaveBeenCalledWith('#bundleProductRepeater');
  });

  it('addresses #bundleSummarySection', () => {
    expect($w).toHaveBeenCalledWith('#bundleSummarySection');
  });

  it('addresses #bundleSummaryRepeater', () => {
    expect($w).toHaveBeenCalledWith('#bundleSummaryRepeater');
  });

  it('addresses #bundleTotalPrice', () => {
    expect($w).toHaveBeenCalledWith('#bundleTotalPrice');
  });

  it('addresses #bundleDiscountBadge', () => {
    expect($w).toHaveBeenCalledWith('#bundleDiscountBadge');
  });

  it('addresses #bundleAddToCartBtn', () => {
    expect($w).toHaveBeenCalledWith('#bundleAddToCartBtn');
  });

  it('addresses #bundleEmptyState', () => {
    expect($w).toHaveBeenCalledWith('#bundleEmptyState');
  });

  it('addresses #bundleLoader', () => {
    expect($w).toHaveBeenCalledWith('#bundleLoader');
  });

  it('addresses #bundleError', () => {
    expect($w).toHaveBeenCalledWith('#bundleError');
  });

  it('product repeater items address #bundleProductImage', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item).toHaveBeenCalledWith('#bundleProductImage');
  });

  it('product repeater items address #bundleProductName', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item).toHaveBeenCalledWith('#bundleProductName');
  });

  it('product repeater items address #bundleProductPrice', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item).toHaveBeenCalledWith('#bundleProductPrice');
  });

  it('product repeater items address #bundleSelectBtn', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item).toHaveBeenCalledWith('#bundleSelectBtn');
  });

  it('product repeater items address #bundleSelectedBadge', () => {
    const $item = callItemReady($w('#bundleProductRepeater'), MOCK_PRODUCTS[0]);
    expect($item).toHaveBeenCalledWith('#bundleSelectedBadge');
  });

  it('summary repeater items address #bundleSummaryName', () => {
    const $item = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    expect($item).toHaveBeenCalledWith('#bundleSummaryName');
  });

  it('summary repeater items address #bundleSummaryPrice', () => {
    const $item = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    expect($item).toHaveBeenCalledWith('#bundleSummaryPrice');
  });

  it('summary repeater items address #bundleSummaryRemoveBtn', () => {
    const $item = callItemReady($w('#bundleSummaryRepeater'), MOCK_PRODUCTS[0]);
    expect($item).toHaveBeenCalledWith('#bundleSummaryRemoveBtn');
  });
});
