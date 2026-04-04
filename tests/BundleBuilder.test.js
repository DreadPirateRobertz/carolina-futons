/**
 * @file BundleBuilder.test.js
 * @description Tests for CF-eqc5.2: BundleBuilder — PDP step picker with live
 * price update and Add Bundle to Cart.
 *
 * Covers:
 *  - formatBundlePrice: whole dollars, fractional, zero, negative, Infinity, non-numeric
 *  - formatSavingsBadge: positive, fractional, zero, negative, non-numeric
 *  - selectBundle: updates live price/savings/name text, shows summary, enables add button
 *  - renderBundleOptions: populates repeater data, item name/price/savings text, wires select
 *  - handleAddToCart: success → shows confirmation + collapses section
 *  - handleAddToCart: backend failure → shows error, re-enables button
 *  - handleAddToCart: no selection → shows error without calling backend
 *  - handleAddToCart: thrown error → shows generic error
 *  - initBundleBuilder: loading → renders options → expands section on success
 *  - initBundleBuilder: backend failure → shows error
 *  - initBundleBuilder: empty bundles → shows no-bundles message
 *  - initBundleBuilder: no frameProductId → returns early without fetching
 *  - initBundleBuilder: disables addBtn until bundle selected
 *  - initBundleBuilder: wires addBtn onClick to handleAddToCart
 *  - tolerates null $w elements via safeGet
 *
 * CF-eqc5.2
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatBundlePrice,
  formatSavingsBadge,
  selectBundle,
  renderBundleOptions,
  handleAddToCart,
  initBundleBuilder,
} from '../src/public/BundleBuilder.js';

// ── $w mock factory ───────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text:  '',
    label: '',
    value: '',
    _visible: true,
    _enabled: true,
    _collapsed: false,
    _data: [],
    _itemReadyCb: null,
    _clickHandler: null,
    show:         vi.fn(function () { this._visible = true; }),
    hide:         vi.fn(function () { this._visible = false; }),
    expand:       vi.fn(function () { this._collapsed = false; }),
    collapse:     vi.fn(function () { this._collapsed = true; }),
    enable:       vi.fn(function () { this._enabled = true; }),
    disable:      vi.fn(function () { this._enabled = false; }),
    onClick:      vi.fn(function (fn) { this._clickHandler = fn; }),
    onItemReady:  vi.fn(function (cb) { this._itemReadyCb = cb; }),
    set data(v) { this._data = v; },
    get data()  { return this._data; },
    _triggerItemReady(items) {
      if (!this._itemReadyCb) return;
      for (const item of items) {
        // Each item gets its own element map keyed by `#selector_itemId`
        this._itemReadyCb((sel) => getEl(`${sel}_${item._id}`), item);
      }
    },
    ...overrides,
  };
}

const elements = new Map();

function getEl(sel) {
  const key = sel.replace(/^#/, '');
  if (!elements.has(key)) elements.set(key, makeEl());
  return elements.get(key);
}

const $w = (sel) => getEl(sel);

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BUNDLE_A = {
  _id: 'b-1',
  displayName: 'Classic Futon Set',
  bundlePrice: 699,
  savings: 75,
  couponCode: 'BUNDLE10',
  components: [
    { type: 'frame',    productId: 'p-frame' },
    { type: 'mattress', productId: 'p-matt'  },
    { type: 'cover',    productId: 'p-cover' },
  ],
};

const BUNDLE_B = {
  _id: 'b-2',
  displayName: 'Premium Futon Set',
  bundlePrice: 999.99,
  savings: 150.50,
  couponCode: null,
  components: [
    { type: 'frame',    productId: 'p-frame'  },
    { type: 'mattress', productId: 'p-matt-2' },
    { type: 'cover',    productId: 'p-cover-2'},
  ],
};

// ── formatBundlePrice ─────────────────────────────────────────────────────────

describe('formatBundlePrice', () => {
  it('formats whole-dollar price without cents', () => {
    expect(formatBundlePrice(499)).toBe('$499');
  });

  it('formats fractional price to 2dp', () => {
    expect(formatBundlePrice(499.99)).toBe('$499.99');
  });

  it('formats string price', () => {
    expect(formatBundlePrice('699')).toBe('$699');
  });

  it('returns empty string for 0', () => {
    expect(formatBundlePrice(0)).toBe('');
  });

  it('returns empty string for negative price', () => {
    expect(formatBundlePrice(-10)).toBe('');
  });

  it('returns empty string for Infinity', () => {
    expect(formatBundlePrice(Infinity)).toBe('');
  });

  it('returns empty string for non-numeric input', () => {
    expect(formatBundlePrice('abc')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(formatBundlePrice(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatBundlePrice(undefined)).toBe('');
  });
});

// ── formatSavingsBadge ────────────────────────────────────────────────────────

describe('formatSavingsBadge', () => {
  it('formats whole-dollar savings', () => {
    expect(formatSavingsBadge(50)).toBe('Save $50');
  });

  it('formats fractional savings to 2dp', () => {
    expect(formatSavingsBadge(50.5)).toBe('Save $50.50');
  });

  it('returns empty string for 0', () => {
    expect(formatSavingsBadge(0)).toBe('');
  });

  it('returns empty string for negative savings', () => {
    expect(formatSavingsBadge(-10)).toBe('');
  });

  it('returns empty string for non-numeric input', () => {
    expect(formatSavingsBadge('abc')).toBe('');
  });

  it('returns empty string for null', () => {
    expect(formatSavingsBadge(null)).toBe('');
  });

  it('returns empty string for Infinity', () => {
    expect(formatSavingsBadge(Infinity)).toBe('');
  });
});

// ── selectBundle ──────────────────────────────────────────────────────────────

describe('selectBundle', () => {
  it('sets selected bundle name text', () => {
    selectBundle($w, BUNDLE_A);
    expect(getEl('#bundleSelectedName').text).toBe('Classic Futon Set');
  });

  it('sets live price text', () => {
    selectBundle($w, BUNDLE_A);
    expect(getEl('#bundleSelectedPrice').text).toBe('$699');
  });

  it('sets live savings text', () => {
    selectBundle($w, BUNDLE_A);
    expect(getEl('#bundleSelectedSavings').text).toBe('Save $75');
  });

  it('sets fractional price correctly', () => {
    selectBundle($w, BUNDLE_B);
    expect(getEl('#bundleSelectedPrice').text).toBe('$999.99');
  });

  it('sets fractional savings correctly', () => {
    selectBundle($w, BUNDLE_B);
    expect(getEl('#bundleSelectedSavings').text).toBe('Save $150.50');
  });

  it('shows the summary container', () => {
    selectBundle($w, BUNDLE_A);
    expect(getEl('#bundleSelectedSummary').show).toHaveBeenCalled();
  });

  it('enables the add-to-cart button', () => {
    selectBundle($w, BUNDLE_A);
    expect(getEl('#addBundleBtn').enable).toHaveBeenCalled();
  });

  it('does not throw when elements are absent', () => {
    expect(() => selectBundle(() => null, BUNDLE_A)).not.toThrow();
  });
});

// ── renderBundleOptions ───────────────────────────────────────────────────────

describe('renderBundleOptions', () => {
  it('sets repeater data with correct IDs', () => {
    renderBundleOptions($w, [BUNDLE_A, BUNDLE_B]);
    const data = getEl('#bundleOptionRepeater').data;
    expect(data).toHaveLength(2);
    expect(data[0]._id).toBe('b-1');
    expect(data[1]._id).toBe('b-2');
  });

  it('populates item name text via onItemReady', () => {
    renderBundleOptions($w, [BUNDLE_A]);
    getEl('#bundleOptionRepeater')._triggerItemReady([{ _id: 'b-1', displayName: 'Classic Futon Set', bundlePrice: 699, savings: 75 }]);
    expect(getEl('#bundleOptionName_b-1').text).toBe('Classic Futon Set');
  });

  it('populates item price text via onItemReady', () => {
    renderBundleOptions($w, [BUNDLE_A]);
    getEl('#bundleOptionRepeater')._triggerItemReady([{ _id: 'b-1', displayName: 'Classic Futon Set', bundlePrice: 699, savings: 75 }]);
    expect(getEl('#bundleOptionPrice_b-1').text).toBe('$699');
  });

  it('populates item savings text via onItemReady', () => {
    renderBundleOptions($w, [BUNDLE_A]);
    getEl('#bundleOptionRepeater')._triggerItemReady([{ _id: 'b-1', displayName: 'Classic Futon Set', bundlePrice: 699, savings: 75 }]);
    expect(getEl('#bundleOptionSavings_b-1').text).toBe('Save $75');
  });

  it('wires selectBundleBtn click to selectBundle', () => {
    renderBundleOptions($w, [BUNDLE_A]);
    getEl('#bundleOptionRepeater')._triggerItemReady([{ _id: 'b-1', displayName: 'Classic Futon Set', bundlePrice: 699, savings: 75 }]);

    const btn = getEl('#selectBundleBtn_b-1');
    expect(btn._clickHandler).toBeTruthy();

    btn._clickHandler();
    expect(getEl('#bundleSelectedName').text).toBe('Classic Futon Set');
  });

  it('sets selectBundleBtn label to "Select"', () => {
    renderBundleOptions($w, [BUNDLE_A]);
    getEl('#bundleOptionRepeater')._triggerItemReady([{ _id: 'b-1', displayName: 'Classic Futon Set', bundlePrice: 699, savings: 75 }]);
    expect(getEl('#selectBundleBtn_b-1').label).toBe('Select');
  });

  it('does not throw when repeater element is absent', () => {
    expect(() => renderBundleOptions(() => null, [BUNDLE_A])).not.toThrow();
  });
});

// ── handleAddToCart ───────────────────────────────────────────────────────────

describe('handleAddToCart', () => {
  beforeEach(() => {
    // Select a bundle so state is ready
    selectBundle($w, BUNDLE_A);
  });

  it('calls addBundle with the selected bundle ID', async () => {
    const addBundle = vi.fn().mockResolvedValue({ success: true, bundleTag: 'bundle:b-1' });
    await handleAddToCart($w, { addBundle });
    expect(addBundle).toHaveBeenCalledWith('b-1');
  });

  it('shows confirmation on success', async () => {
    const addBundle = vi.fn().mockResolvedValue({ success: true, bundleTag: 'bundle:b-1' });
    await handleAddToCart($w, { addBundle });
    expect(getEl('#bundleAddedConfirmation').show).toHaveBeenCalled();
  });

  it('collapses the section on success', async () => {
    const addBundle = vi.fn().mockResolvedValue({ success: true });
    await handleAddToCart($w, { addBundle });
    expect(getEl('#bundleBuilderSection').collapse).toHaveBeenCalled();
  });

  it('shows error when backend returns failure', async () => {
    const addBundle = vi.fn().mockResolvedValue({ success: false, error: 'Bundle not found.' });
    await handleAddToCart($w, { addBundle });
    expect(getEl('#bundleBuilderError').text).toBe('Bundle not found.');
    expect(getEl('#bundleBuilderError').show).toHaveBeenCalled();
  });

  it('re-enables button after backend failure', async () => {
    const addBundle = vi.fn().mockResolvedValue({ success: false, error: 'Oops.' });
    await handleAddToCart($w, { addBundle });
    expect(getEl('#addBundleBtn').enable).toHaveBeenCalled();
  });

  it('shows generic error on thrown exception', async () => {
    const addBundle = vi.fn().mockRejectedValue(new Error('Network error'));
    await handleAddToCart($w, { addBundle });
    expect(getEl('#bundleBuilderError').show).toHaveBeenCalled();
  });

  it('does not throw when $w returns null for all elements', async () => {
    const addBundle = vi.fn().mockResolvedValue({ success: true });
    await expect(handleAddToCart(() => null, { addBundle })).resolves.not.toThrow();
  });

  it('does not throw when $w returns null for all elements', async () => {
    const addBundle = vi.fn().mockResolvedValue({ success: true });
    await expect(handleAddToCart(() => null, { addBundle })).resolves.not.toThrow();
  });
});

describe('handleAddToCart — no bundle selected', () => {
  it('shows error without calling backend when nothing is selected', async () => {
    // No selectBundle called — _selectedBundle is null after initBundleBuilder with no frame
    const getBundlesByFrame = vi.fn();
    await initBundleBuilder($w, null, { getBundlesByFrame, addBundle: vi.fn() });

    const addBundle = vi.fn();
    await handleAddToCart($w, { addBundle });
    expect(addBundle).not.toHaveBeenCalled();
    expect(getEl('#bundleBuilderError').show).toHaveBeenCalled();
  });
});

// ── initBundleBuilder ─────────────────────────────────────────────────────────

describe('initBundleBuilder', () => {
  it('calls getBundlesByFrame with the frame product ID', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [BUNDLE_A] });
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getBundlesByFrame).toHaveBeenCalledWith('prod-frame-001');
  });

  it('expands the section when bundles are found', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [BUNDLE_A] });
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getEl('#bundleBuilderSection').expand).toHaveBeenCalled();
  });

  it('populates repeater data when bundles are found', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [BUNDLE_A, BUNDLE_B] });
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getEl('#bundleOptionRepeater').data).toHaveLength(2);
  });

  it('shows no-bundles message when result is empty', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [] });
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getEl('#noBundlesMessage').show).toHaveBeenCalled();
  });

  it('shows error when getBundlesByFrame fails', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: false, error: 'CMS unavailable.' });
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getEl('#bundleBuilderError').show).toHaveBeenCalled();
    expect(getEl('#bundleBuilderError').text).toBe('CMS unavailable.');
  });

  it('shows error on thrown exception', async () => {
    const getBundlesByFrame = vi.fn().mockRejectedValue(new Error('Timeout'));
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getEl('#bundleBuilderError').show).toHaveBeenCalled();
  });

  it('disables addBundleBtn on init before a bundle is selected', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [BUNDLE_A] });
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getEl('#addBundleBtn').disable).toHaveBeenCalled();
  });

  it('wires addBundleBtn onClick', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [BUNDLE_A] });
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getEl('#addBundleBtn').onClick).toHaveBeenCalled();
  });

  it('returns early without fetching when frameProductId is empty', async () => {
    const getBundlesByFrame = vi.fn();
    await initBundleBuilder($w, '', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getBundlesByFrame).not.toHaveBeenCalled();
  });

  it('returns early without fetching when frameProductId is null', async () => {
    const getBundlesByFrame = vi.fn();
    await initBundleBuilder($w, null, { getBundlesByFrame, addBundle: vi.fn() });
    expect(getBundlesByFrame).not.toHaveBeenCalled();
  });

  it('hides loading indicator after success', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [BUNDLE_A] });
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getEl('#bundleBuilderLoading').hide).toHaveBeenCalled();
  });

  it('hides loading indicator after failure', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: false, error: 'err' });
    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() });
    expect(getEl('#bundleBuilderLoading').hide).toHaveBeenCalled();
  });

  it('does not throw when all $w selectors return null', async () => {
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [BUNDLE_A] });
    await expect(
      initBundleBuilder(() => null, 'prod-frame-001', { getBundlesByFrame, addBundle: vi.fn() })
    ).resolves.not.toThrow();
  });

  it('addBundleBtn click triggers handleAddToCart with injected addBundle', async () => {
    const addBundle = vi.fn().mockResolvedValue({ success: true });
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [BUNDLE_A] });

    await initBundleBuilder($w, 'prod-frame-001', { getBundlesByFrame, addBundle });

    // Select a bundle so handleAddToCart has state
    selectBundle($w, BUNDLE_A);

    // Fire the wired onClick
    const clickFn = getEl('#addBundleBtn')._clickHandler;
    expect(clickFn).toBeTruthy();
    await clickFn();

    expect(addBundle).toHaveBeenCalledWith('b-1');
  });
});
