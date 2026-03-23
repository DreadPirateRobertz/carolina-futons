/**
 * cartShippingEstimate.test.js
 *
 * Unit tests for src/public/CartShippingEstimate.js (CF-5bs)
 *
 * Covers:
 *  - buildCartItemsForRates: maps line items to rate request format
 *  - buildCartItemsForRates: filters out items without productId
 *  - getCheapestRate: returns the lowest-cost option
 *  - getCheapestRate: returns null for empty / null input
 *  - formatRateLabel: $X.XX for non-zero cost
 *  - formatRateLabel: FREE for zero cost
 *  - formatRateLabel: null for null input
 *  - _render: collapses row when cart is empty
 *  - _render: shows FREIGHT_MSG when LTL item in cart
 *  - _render: shows FREE_MSG when free shipping qualifies
 *  - _render: shows zip prompt when no ZIP stored and no LTL
 *  - _render: shows calculated rate when ZIP is stored and fetch succeeds
 *  - _render: shows zip prompt when ZIP stored but fetch fails
 *  - _render: shows zip prompt when ZIP stored but result.success is false
 *  - _render: pre-fills ZIP input with stored zip after successful fetch
 *  - initCartShippingEstimate: wires zipBtn onClick once
 *  - initCartShippingEstimate: renders on init
 *  - updateCartShippingEstimate: re-renders with new cart
 *  - initSideCartShippingEstimate: renders with side cart element IDs
 *  - updateSideCartShippingEstimate: re-renders side cart on update
 *  - ZIP submit — valid ZIP: stores ZIP, fetches rates, shows cheapest
 *  - ZIP submit — invalid ZIP: shows validation message
 *  - ZIP submit — fetch failure: shows 'Estimate unavailable'
 *  - ZIP submit — empty options: shows 'Estimate unavailable'
 *  - STORAGE_KEY: is 'cf_shipping_zip'
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('public/CheckoutShippingIntelligence', () => ({
  fetchCheckoutShippingRates: vi.fn(),
  isValidZip: (zip) => /^\d{5}$/.test(String(zip ?? '').trim()),
}));

vi.mock('public/FreightUpsellBanner', () => ({
  hasLTLItemInCart: vi.fn(),
}));

vi.mock('public/cartService', () => ({
  isFreeShippingEnabled: vi.fn(),
  getShippingProgress: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

import {
  buildCartItemsForRates,
  getCheapestRate,
  formatRateLabel,
  initCartShippingEstimate,
  updateCartShippingEstimate,
  initSideCartShippingEstimate,
  updateSideCartShippingEstimate,
  STORAGE_KEY,
  FREIGHT_MSG,
  FREE_MSG,
} from '../src/public/CartShippingEstimate.js';

import { fetchCheckoutShippingRates } from 'public/CheckoutShippingIntelligence';
import { hasLTLItemInCart } from 'public/FreightUpsellBanner';
import { isFreeShippingEnabled, getShippingProgress } from 'public/cartService';
import { announce } from 'public/a11yHelpers';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: vi.fn(k => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = String(v); }),
    removeItem: vi.fn(k => { delete store[k]; }),
    _store: store,
  };
}

function makeEl(overrides = {}) {
  return {
    text: '',
    value: '',
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    accessibility: {},
    ...overrides,
  };
}

function makeCartEnv(overrides = {}) {
  const els = {
    '#cartShippingEstimateRow': makeEl(),
    '#cartShippingResult':       makeEl(),
    '#cartShippingZipForm':      makeEl(),
    '#cartShippingZipInput':     makeEl({ value: '' }),
    '#cartShippingZipBtn':       makeEl(),
    ...overrides,
  };
  const $w = vi.fn(sel => els[sel] ?? null);
  $w.__els = els;
  return $w;
}

function makeSideCartEnv(overrides = {}) {
  const els = {
    '#sideCartShippingRow':      makeEl(),
    '#sideCartShippingResult':   makeEl(),
    '#sideCartShippingZipForm':  makeEl(),
    '#sideCartShippingZipInput': makeEl({ value: '' }),
    '#sideCartShippingZipBtn':   makeEl(),
    ...overrides,
  };
  const $w = vi.fn(sel => els[sel] ?? null);
  $w.__els = els;
  return $w;
}

function makeCart(overrides = {}) {
  return {
    lineItems: [
      {
        _id: 'li-1',
        name: 'Classic Futon Frame',
        quantity: 1,
        price: 299,
        catalogReference: { catalogItemId: 'prod-classic-futon' },
      },
    ],
    totals: { subtotal: 299 },
    ...overrides,
  };
}

function makeRateOption(overrides = {}) {
  return { code: 'UPS_GROUND', title: 'UPS Ground', cost: 49.99, price: '49.99', isLTL: false, ...overrides };
}

/** Fire the onClick handler registered on a mock element. */
function triggerClick(el) {
  const handler = el.onClick.mock.calls[0]?.[0];
  if (!handler) throw new Error('No onClick handler registered on element');
  return handler();
}

// ── Reset mocks before each test ──────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no LTL, free shipping disabled, progress not qualifying
  hasLTLItemInCart.mockReturnValue(false);
  isFreeShippingEnabled.mockReturnValue(false);
  getShippingProgress.mockReturnValue({ qualifies: false, remaining: 100, progressPct: 0 });
});

// ═══════════════════════════════════════════════════════════════════
// Pure helpers
// ═══════════════════════════════════════════════════════════════════

describe('buildCartItemsForRates', () => {
  it('maps catalogReference.catalogItemId to productId', () => {
    const items = buildCartItemsForRates([
      { catalogReference: { catalogItemId: 'prod-1' }, quantity: 2, price: 100 },
    ]);
    expect(items).toEqual([{ productId: 'prod-1', quantity: 2, price: 100 }]);
  });

  it('falls back to item.productId when catalogReference is absent', () => {
    const items = buildCartItemsForRates([
      { productId: 'prod-fallback', quantity: 1, price: 50 },
    ]);
    expect(items[0].productId).toBe('prod-fallback');
  });

  it('filters out items with no productId', () => {
    const items = buildCartItemsForRates([
      { catalogReference: { catalogItemId: 'prod-a' }, quantity: 1, price: 0 },
      { name: 'No ID item', quantity: 1, price: 20 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe('prod-a');
  });

  it('handles empty array', () => {
    expect(buildCartItemsForRates([])).toEqual([]);
  });

  it('handles null / undefined', () => {
    expect(buildCartItemsForRates(null)).toEqual([]);
    expect(buildCartItemsForRates(undefined)).toEqual([]);
  });
});

describe('getCheapestRate', () => {
  it('returns the option with the lowest cost', () => {
    const options = [
      makeRateOption({ cost: 59.99 }),
      makeRateOption({ code: 'UPS_2DAY', cost: 89.99 }),
      makeRateOption({ code: 'UPS_CHEAPEST', cost: 39.99 }),
    ];
    expect(getCheapestRate(options).cost).toBe(39.99);
  });

  it('returns the single option when only one exists', () => {
    const option = makeRateOption({ cost: 49.99 });
    expect(getCheapestRate([option])).toBe(option);
  });

  it('returns null for empty array', () => {
    expect(getCheapestRate([])).toBeNull();
  });

  it('returns null for null', () => {
    expect(getCheapestRate(null)).toBeNull();
  });
});

describe('formatRateLabel', () => {
  it('returns $X.XX for non-zero cost', () => {
    expect(formatRateLabel({ cost: 49.99 })).toBe('$49.99');
  });

  it('returns FREE for zero cost', () => {
    expect(formatRateLabel({ cost: 0 })).toBe('FREE');
  });

  it('returns null for null option', () => {
    expect(formatRateLabel(null)).toBeNull();
  });

  it('formats cost with two decimal places', () => {
    expect(formatRateLabel({ cost: 5 })).toBe('$5.00');
  });
});

describe('STORAGE_KEY', () => {
  it('is cf_shipping_zip', () => {
    expect(STORAGE_KEY).toBe('cf_shipping_zip');
  });
});

// ═══════════════════════════════════════════════════════════════════
// _render behaviour (exercised via initCartShippingEstimate)
// ═══════════════════════════════════════════════════════════════════

describe('render — empty cart', () => {
  it('collapses row when cart has no line items', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();
    await initCartShippingEstimate($w, { lineItems: [] }, { storage });
    expect($w.__els['#cartShippingEstimateRow'].collapse).toHaveBeenCalled();
  });

  it('collapses row for null cart', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();
    await initCartShippingEstimate($w, null, { storage });
    expect($w.__els['#cartShippingEstimateRow'].collapse).toHaveBeenCalled();
  });
});

describe('render — LTL freight item', () => {
  it('shows FREIGHT_MSG when cart contains an LTL item', async () => {
    hasLTLItemInCart.mockReturnValue(true);
    const $w = makeCartEnv();
    const storage = makeStorage();
    await initCartShippingEstimate($w, makeCart(), { storage });

    const result = $w.__els['#cartShippingResult'];
    expect(result.text).toBe(FREIGHT_MSG);
    expect($w.__els['#cartShippingZipForm'].collapse).toHaveBeenCalled();
  });
});

describe('render — free shipping threshold', () => {
  it('shows FREE_MSG when free shipping is enabled and threshold is met', async () => {
    isFreeShippingEnabled.mockReturnValue(true);
    getShippingProgress.mockReturnValue({ qualifies: true, remaining: 0, progressPct: 100 });

    const $w = makeCartEnv();
    const storage = makeStorage();
    await initCartShippingEstimate($w, makeCart({ totals: { subtotal: 500 } }), { storage });

    expect($w.__els['#cartShippingResult'].text).toBe(FREE_MSG);
  });

  it('does not show FREE_MSG when free shipping is disabled', async () => {
    isFreeShippingEnabled.mockReturnValue(false);
    getShippingProgress.mockReturnValue({ qualifies: true });

    const $w = makeCartEnv();
    const storage = makeStorage();
    fetchCheckoutShippingRates.mockResolvedValue({ success: false, options: [] });
    await initCartShippingEstimate($w, makeCart(), { storage });

    expect($w.__els['#cartShippingResult'].text).not.toBe(FREE_MSG);
  });
});

describe('render — no ZIP stored', () => {
  it('shows zip prompt when no ZIP is in storage', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage(); // empty
    await initCartShippingEstimate($w, makeCart(), { storage });

    expect($w.__els['#cartShippingZipForm'].expand).toHaveBeenCalled();
    expect($w.__els['#cartShippingResult'].hide).toHaveBeenCalled();
  });
});

describe('render — ZIP stored', () => {
  it('shows cheapest rate when ZIP is stored and fetch succeeds', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage({ [STORAGE_KEY]: '28792' });
    fetchCheckoutShippingRates.mockResolvedValue({
      success: true,
      options: [makeRateOption({ cost: 49.99 }), makeRateOption({ cost: 29.99, code: 'CHEAP' })],
    });

    await initCartShippingEstimate($w, makeCart(), { storage });

    expect($w.__els['#cartShippingResult'].text).toBe('$29.99');
    expect($w.__els['#cartShippingZipForm'].collapse).toHaveBeenCalled();
  });

  it('pre-fills ZIP input with stored ZIP after successful fetch', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage({ [STORAGE_KEY]: '28792' });
    fetchCheckoutShippingRates.mockResolvedValue({
      success: true,
      options: [makeRateOption({ cost: 39.99 })],
    });

    await initCartShippingEstimate($w, makeCart(), { storage });
    expect($w.__els['#cartShippingZipInput'].value).toBe('28792');
  });

  it('falls back to zip prompt when fetch throws', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage({ [STORAGE_KEY]: '28792' });
    fetchCheckoutShippingRates.mockRejectedValue(new Error('network error'));

    await initCartShippingEstimate($w, makeCart(), { storage });
    expect($w.__els['#cartShippingZipForm'].expand).toHaveBeenCalled();
  });

  it('falls back to zip prompt when result.success is false', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage({ [STORAGE_KEY]: '28792' });
    fetchCheckoutShippingRates.mockResolvedValue({ success: false, options: [] });

    await initCartShippingEstimate($w, makeCart(), { storage });
    expect($w.__els['#cartShippingZipForm'].expand).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// initCartShippingEstimate / updateCartShippingEstimate
// ═══════════════════════════════════════════════════════════════════

describe('initCartShippingEstimate', () => {
  it('wires zipBtn onClick on init', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();
    await initCartShippingEstimate($w, makeCart(), { storage });
    expect($w.__els['#cartShippingZipBtn'].onClick).toHaveBeenCalled();
  });

  it('expands cart row on init with items', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();
    await initCartShippingEstimate($w, makeCart(), { storage });
    expect($w.__els['#cartShippingEstimateRow'].expand).toHaveBeenCalled();
  });
});

describe('updateCartShippingEstimate', () => {
  it('re-renders with new cart and collapses when cart becomes empty', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();
    await initCartShippingEstimate($w, makeCart(), { storage });

    vi.clearAllMocks();
    await updateCartShippingEstimate($w, { lineItems: [] }, { storage });
    expect($w.__els['#cartShippingEstimateRow'].collapse).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Side Cart
// ═══════════════════════════════════════════════════════════════════

describe('initSideCartShippingEstimate', () => {
  it('renders with side-cart element IDs', async () => {
    const $w = makeSideCartEnv();
    const storage = makeStorage();
    await initSideCartShippingEstimate($w, makeCart(), { storage });
    expect($w.__els['#sideCartShippingRow'].expand).toHaveBeenCalled();
  });

  it('wires sideCartShippingZipBtn onClick', async () => {
    const $w = makeSideCartEnv();
    const storage = makeStorage();
    await initSideCartShippingEstimate($w, makeCart(), { storage });
    expect($w.__els['#sideCartShippingZipBtn'].onClick).toHaveBeenCalledOnce();
  });

  it('shows FREIGHT_MSG in side cart when LTL item present', async () => {
    hasLTLItemInCart.mockReturnValue(true);
    const $w = makeSideCartEnv();
    const storage = makeStorage();
    await initSideCartShippingEstimate($w, makeCart(), { storage });
    expect($w.__els['#sideCartShippingResult'].text).toBe(FREIGHT_MSG);
  });
});

describe('updateSideCartShippingEstimate', () => {
  it('re-renders side cart when called with updated cart', async () => {
    const $w = makeSideCartEnv();
    const storage = makeStorage();
    await initSideCartShippingEstimate($w, makeCart(), { storage });

    hasLTLItemInCart.mockReturnValue(true);
    await updateSideCartShippingEstimate($w, makeCart(), { storage });
    expect($w.__els['#sideCartShippingResult'].text).toBe(FREIGHT_MSG);
  });
});

// ═══════════════════════════════════════════════════════════════════
// ZIP submit handler (triggered via button onClick)
// ═══════════════════════════════════════════════════════════════════

describe('ZIP submit handler', () => {
  it('stores valid ZIP and shows cheapest rate', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();
    fetchCheckoutShippingRates.mockResolvedValue({
      success: true,
      options: [makeRateOption({ cost: 49.99 })],
    });

    await initCartShippingEstimate($w, makeCart(), { storage });
    $w.__els['#cartShippingZipInput'].value = '28792';
    await triggerClick($w.__els['#cartShippingZipBtn']);

    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, '28792');
    expect($w.__els['#cartShippingResult'].text).toBe('$49.99');
  });

  it('shows validation message for invalid ZIP', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();

    await initCartShippingEstimate($w, makeCart(), { storage });
    $w.__els['#cartShippingZipInput'].value = '123';
    await triggerClick($w.__els['#cartShippingZipBtn']);

    expect($w.__els['#cartShippingResult'].text).toBe('Enter a valid 5-digit ZIP');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('calls announce with the estimated rate after valid fetch', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();
    fetchCheckoutShippingRates.mockResolvedValue({
      success: true,
      options: [makeRateOption({ cost: 39.99 })],
    });

    await initCartShippingEstimate($w, makeCart(), { storage });
    $w.__els['#cartShippingZipInput'].value = '28792';
    await triggerClick($w.__els['#cartShippingZipBtn']);

    expect(announce).toHaveBeenCalledWith($w, 'Estimated shipping: $39.99');
  });

  it('shows Estimate unavailable when fetch throws', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();
    fetchCheckoutShippingRates.mockRejectedValue(new Error('network'));

    await initCartShippingEstimate($w, makeCart(), { storage });
    $w.__els['#cartShippingZipInput'].value = '28792';
    await triggerClick($w.__els['#cartShippingZipBtn']);

    expect($w.__els['#cartShippingResult'].text).toBe('Estimate unavailable');
  });

  it('shows Estimate unavailable when options array is empty', async () => {
    const $w = makeCartEnv();
    const storage = makeStorage();
    fetchCheckoutShippingRates.mockResolvedValue({ success: true, options: [] });

    await initCartShippingEstimate($w, makeCart(), { storage });
    $w.__els['#cartShippingZipInput'].value = '28792';
    await triggerClick($w.__els['#cartShippingZipBtn']);

    expect($w.__els['#cartShippingResult'].text).toBe('Estimate unavailable');
  });
});
