/**
 * Tests for src/public/BundleBuilder.js — the PDP-side widget. Distinct
 * from tests/BundleBuilder.test.js which targets backend/bundleBuilder.web.js.
 *
 * Covers:
 *   - formatBundlePrice / formatSavingsBadge — pure formatters incl. edge cases
 *   - selectBundle — DOM wiring + state mutation
 *   - renderBundleOptions — repeater data shape + onItemReady wiring
 *   - handleAddToCart — happy path, error path, no-selection guard, addBtn lifecycle
 *   - initBundleBuilder — load success, load failure, empty bundles, exception path
 *
 * Dependencies are injected via the `deps` parameter so we don't need to
 * mock `backend/bundleService.web` at the module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the backend module so the import at the top of BundleBuilder.js resolves
// during test loading. The actual injected deps win over these defaults.
vi.mock('backend/bundleService.web', () => ({
  getBundlesByFrame: vi.fn(),
  addBundle: vi.fn(),
}));

import {
  formatBundlePrice,
  formatSavingsBadge,
  selectBundle,
  renderBundleOptions,
  handleAddToCart,
  initBundleBuilder,
} from '../src/public/BundleBuilder.js';

// ── $w mock factory ─────────────────────────────────────────────────

/**
 * Build a Wix-style `$w` selector. Returns a function that, given a selector
 * string, produces a stub element with text/show/hide/enable/disable handlers.
 * The same element instance is returned for the same selector across calls
 * so tests can assert post-state.
 */
function makeMockW(overrides = {}) {
  const elements = {};
  const make = () => ({
    text: '',
    show: vi.fn(function () { this.visible = true; }),
    hide: vi.fn(function () { this.visible = false; }),
    expand: vi.fn(function () { this.expanded = true; }),
    collapse: vi.fn(function () { this.collapsed = true; }),
    enable: vi.fn(function () { this.disabled = false; }),
    disable: vi.fn(function () { this.disabled = true; }),
    onClick: vi.fn(function (cb) { this._click = cb; }),
    onItemReady: vi.fn(function (cb) { this._itemReady = cb; }),
    label: '',
    data: [],
    visible: false,
  });

  const $w = (sel) => {
    if (overrides[sel] === null) {
      throw new Error('Element not found: ' + sel);
    }
    if (!elements[sel]) elements[sel] = make();
    return elements[sel];
  };
  $w.__elements = elements;
  return $w;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── formatBundlePrice ────────────────────────────────────────────────

describe('formatBundlePrice', () => {
  it('formats whole-dollar prices without decimals', () => {
    expect(formatBundlePrice(499)).toBe('$499');
  });

  it('formats fractional prices with 2dp', () => {
    expect(formatBundlePrice(499.99)).toBe('$499.99');
  });

  it('returns empty string for zero', () => {
    expect(formatBundlePrice(0)).toBe('');
  });

  it('returns empty string for negative values', () => {
    expect(formatBundlePrice(-5)).toBe('');
  });

  it('returns empty string for non-finite values', () => {
    expect(formatBundlePrice(Infinity)).toBe('');
    expect(formatBundlePrice(-Infinity)).toBe('');
    expect(formatBundlePrice(NaN)).toBe('');
  });

  it('returns empty string for non-numeric input', () => {
    expect(formatBundlePrice('abc')).toBe('');
    expect(formatBundlePrice(null)).toBe('');
    expect(formatBundlePrice(undefined)).toBe('');
  });

  it('parses numeric strings', () => {
    expect(formatBundlePrice('499.50')).toBe('$499.50');
    expect(formatBundlePrice('150')).toBe('$150');
  });
});

// ── formatSavingsBadge ───────────────────────────────────────────────

describe('formatSavingsBadge', () => {
  it('formats whole-dollar savings', () => {
    expect(formatSavingsBadge(50)).toBe('Save $50');
  });

  it('formats fractional savings with 2dp', () => {
    expect(formatSavingsBadge(49.99)).toBe('Save $49.99');
  });

  it('returns empty string when savings are zero', () => {
    expect(formatSavingsBadge(0)).toBe('');
  });

  it('returns empty string for negative savings', () => {
    expect(formatSavingsBadge(-10)).toBe('');
  });

  it('returns empty string for non-finite / non-numeric', () => {
    expect(formatSavingsBadge(NaN)).toBe('');
    expect(formatSavingsBadge(undefined)).toBe('');
    expect(formatSavingsBadge('xx')).toBe('');
  });
});

// ── selectBundle ─────────────────────────────────────────────────────

describe('selectBundle', () => {
  it('writes name, price, savings text to the selected-summary elements', () => {
    const $w = makeMockW();
    selectBundle($w, {
      _id: 'b1',
      displayName: 'Frame + Mattress + Cover',
      bundlePrice: 999,
      savings: 100,
    });
    expect($w.__elements['#bundleSelectedName'].text).toBe('Frame + Mattress + Cover');
    expect($w.__elements['#bundleSelectedPrice'].text).toBe('$999');
    expect($w.__elements['#bundleSelectedSavings'].text).toBe('Save $100');
  });

  it('shows the summary container and enables the add button', () => {
    const $w = makeMockW();
    selectBundle($w, { _id: 'b1', displayName: 'X', bundlePrice: 100, savings: 10 });
    expect($w.__elements['#bundleSelectedSummary'].show).toHaveBeenCalled();
    expect($w.__elements['#addBundleBtn'].enable).toHaveBeenCalled();
  });

  it('handles missing displayName by writing empty string', () => {
    const $w = makeMockW();
    selectBundle($w, { _id: 'b1', bundlePrice: 100, savings: 10 });
    expect($w.__elements['#bundleSelectedName'].text).toBe('');
  });

  it('handles bundle with zero savings (badge empty)', () => {
    const $w = makeMockW();
    selectBundle($w, { _id: 'b1', displayName: 'X', bundlePrice: 100, savings: 0 });
    expect($w.__elements['#bundleSelectedSavings'].text).toBe('');
  });

  it('survives when individual elements are missing (safeGet returns null)', () => {
    const $w = makeMockW({ '#bundleSelectedName': null, '#bundleSelectedPrice': null });
    expect(() => selectBundle($w, { _id: 'b1', displayName: 'X', bundlePrice: 100, savings: 10 })).not.toThrow();
  });
});

// ── renderBundleOptions ─────────────────────────────────────────────

describe('renderBundleOptions', () => {
  it('populates the repeater with bundle data', () => {
    const $w = makeMockW();
    const bundles = [
      { _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 },
      { _id: 'b2', displayName: 'B', bundlePrice: 200, savings: 20 },
    ];
    renderBundleOptions($w, bundles);
    expect($w.__elements['#bundleOptionRepeater'].data).toEqual([
      { _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 },
      { _id: 'b2', displayName: 'B', bundlePrice: 200, savings: 20 },
    ]);
  });

  it('wires the onItemReady callback to fill per-card text + select handler', () => {
    const $w = makeMockW();
    const bundles = [{ _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 }];
    renderBundleOptions($w, bundles);

    const repeater = $w.__elements['#bundleOptionRepeater'];
    expect(repeater.onItemReady).toHaveBeenCalled();

    const $item = makeMockW();
    repeater._itemReady($item, bundles[0]);

    expect($item.__elements['#bundleOptionName'].text).toBe('A');
    expect($item.__elements['#bundleOptionPrice'].text).toBe('$100');
    expect($item.__elements['#bundleOptionSavings'].text).toBe('Save $10');
    expect($item.__elements['#selectBundleBtn'].label).toBe('Select');
    expect($item.__elements['#selectBundleBtn'].onClick).toHaveBeenCalled();
  });

  it('select button click calls selectBundle for the matching bundle', () => {
    const $w = makeMockW();
    const bundles = [{ _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 }];
    renderBundleOptions($w, bundles);
    const $item = makeMockW();
    $w.__elements['#bundleOptionRepeater']._itemReady($item, bundles[0]);

    $item.__elements['#selectBundleBtn']._click();
    expect($w.__elements['#bundleSelectedName'].text).toBe('A');
  });

  it('no-ops when the repeater element is missing', () => {
    const $w = makeMockW({ '#bundleOptionRepeater': null });
    expect(() => renderBundleOptions($w, [{ _id: 'b1' }])).not.toThrow();
  });

  it('handles missing displayName / price / savings on items', () => {
    const $w = makeMockW();
    const bundles = [{ _id: 'b1' }];
    renderBundleOptions($w, bundles);
    const $item = makeMockW();
    $w.__elements['#bundleOptionRepeater']._itemReady($item, bundles[0]);

    expect($item.__elements['#bundleOptionName'].text).toBe('');
    expect($item.__elements['#bundleOptionPrice'].text).toBe('');
    expect($item.__elements['#bundleOptionSavings'].text).toBe('');
  });
});

// ── handleAddToCart ─────────────────────────────────────────────────

describe('handleAddToCart', () => {
  it('shows error and bails when no bundle is selected', async () => {
    const $w = makeMockW();
    // initBundleBuilder('') resets the module's _selectedBundle to null
    await initBundleBuilder($w, '');
    await handleAddToCart($w, { addBundle: vi.fn() });
    expect($w.__elements['#bundleBuilderError'].text).toContain('select a bundle option first');
  });

  it('happy path — calls addBundle, hides error, shows confirmation, collapses section', async () => {
    const $w = makeMockW();
    selectBundle($w, { _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 });

    const addBundle = vi.fn().mockResolvedValue({ success: true });
    await handleAddToCart($w, { addBundle });

    expect(addBundle).toHaveBeenCalledWith('b1');
    expect($w.__elements['#bundleAddedConfirmation'].show).toHaveBeenCalled();
    expect($w.__elements['#bundleBuilderSection'].collapse).toHaveBeenCalled();
  });

  it('shows backend error when addBundle returns success: false', async () => {
    const $w = makeMockW();
    selectBundle($w, { _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 });
    const addBundle = vi.fn().mockResolvedValue({ success: false, error: 'Out of stock' });
    await handleAddToCart($w, { addBundle });
    expect($w.__elements['#bundleBuilderError'].text).toBe('Out of stock');
  });

  it('shows generic error when addBundle returns success: false with no error string', async () => {
    const $w = makeMockW();
    selectBundle($w, { _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 });
    const addBundle = vi.fn().mockResolvedValue({ success: false });
    await handleAddToCart($w, { addBundle });
    expect($w.__elements['#bundleBuilderError'].text).toMatch(/Could not add bundle/);
  });

  it('shows generic error when addBundle throws', async () => {
    const $w = makeMockW();
    selectBundle($w, { _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 });
    const addBundle = vi.fn().mockRejectedValue(new Error('Network down'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleAddToCart($w, { addBundle });
    expect($w.__elements['#bundleBuilderError'].text).toMatch(/Something went wrong/);
    errSpy.mockRestore();
  });

  it('disables the add button during the call and re-enables in finally', async () => {
    const $w = makeMockW();
    selectBundle($w, { _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 });
    const addBundle = vi.fn().mockResolvedValue({ success: true });
    await handleAddToCart($w, { addBundle });
    const addBtn = $w.__elements['#addBundleBtn'];
    expect(addBtn.disable).toHaveBeenCalled();
    expect(addBtn.enable).toHaveBeenCalled();
  });

  it('toggles loading visibility around the call', async () => {
    const $w = makeMockW();
    selectBundle($w, { _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 });
    const addBundle = vi.fn().mockResolvedValue({ success: true });
    await handleAddToCart($w, { addBundle });
    const loading = $w.__elements['#bundleBuilderLoading'];
    expect(loading.show).toHaveBeenCalled();
    expect(loading.hide).toHaveBeenCalled();
  });
});

// ── initBundleBuilder ───────────────────────────────────────────────

describe('initBundleBuilder', () => {
  it('returns early when frameProductId is missing (no backend call)', async () => {
    const $w = makeMockW();
    const getBundlesByFrame = vi.fn();
    await initBundleBuilder($w, '', { getBundlesByFrame });
    expect(getBundlesByFrame).not.toHaveBeenCalled();
  });

  it('disables add button on entry', async () => {
    const $w = makeMockW();
    await initBundleBuilder($w, '');
    expect($w.__elements['#addBundleBtn'].disable).toHaveBeenCalled();
  });

  it('renders bundles and expands the section on success', async () => {
    const $w = makeMockW();
    const bundles = [
      { _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 },
      { _id: 'b2', displayName: 'B', bundlePrice: 200, savings: 20 },
    ];
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles });
    await initBundleBuilder($w, 'frame-1', { getBundlesByFrame });

    expect(getBundlesByFrame).toHaveBeenCalledWith('frame-1');
    expect($w.__elements['#bundleOptionRepeater'].data).toHaveLength(2);
    expect($w.__elements['#bundleBuilderSection'].expand).toHaveBeenCalled();
  });

  it('shows the no-bundles message when the result is empty', async () => {
    const $w = makeMockW();
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [] });
    await initBundleBuilder($w, 'frame-1', { getBundlesByFrame });
    expect($w.__elements['#noBundlesMessage'].show).toHaveBeenCalled();
  });

  it('shows backend error when getBundlesByFrame returns success: false', async () => {
    const $w = makeMockW();
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: false, error: 'CMS down' });
    await initBundleBuilder($w, 'frame-1', { getBundlesByFrame });
    expect($w.__elements['#bundleBuilderError'].text).toBe('CMS down');
  });

  it('shows generic error when getBundlesByFrame returns success: false with no error string', async () => {
    const $w = makeMockW();
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: false });
    await initBundleBuilder($w, 'frame-1', { getBundlesByFrame });
    expect($w.__elements['#bundleBuilderError'].text).toMatch(/Could not load bundle options/);
  });

  it('shows generic error and logs when getBundlesByFrame throws', async () => {
    const $w = makeMockW();
    const getBundlesByFrame = vi.fn().mockRejectedValue(new Error('Boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await initBundleBuilder($w, 'frame-1', { getBundlesByFrame });
    expect($w.__elements['#bundleBuilderError'].text).toMatch(/Could not load bundle options/);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('always hides loading indicator in finally', async () => {
    const $w = makeMockW();
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles: [] });
    await initBundleBuilder($w, 'frame-1', { getBundlesByFrame });
    expect($w.__elements['#bundleBuilderLoading'].hide).toHaveBeenCalled();
  });

  it('wires add button to handleAddToCart with the injected addBundle dep', async () => {
    const $w = makeMockW();
    const bundles = [{ _id: 'b1', displayName: 'A', bundlePrice: 100, savings: 10 }];
    const getBundlesByFrame = vi.fn().mockResolvedValue({ success: true, bundles });
    const addBundle = vi.fn().mockResolvedValue({ success: true });

    await initBundleBuilder($w, 'frame-1', { getBundlesByFrame, addBundle });

    selectBundle($w, bundles[0]);
    await $w.__elements['#addBundleBtn']._click();

    expect(addBundle).toHaveBeenCalledWith('b1');
  });
});
