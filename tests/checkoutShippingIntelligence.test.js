/**
 * Tests for src/public/CheckoutShippingIntelligence.js
 * CF-nnul: Mobile checkout shipping intelligence integration
 *
 * Coverage:
 *   isValidZip                       — ZIP validation
 *   fetchCheckoutShippingRates       — single vs multi-item routing, empty cart
 *   initCheckoutShippingIntelligence — init, ZIP pre-population, button wiring
 *   _handleCalculate (via button)    — valid/invalid zip, API success/failure
 *   renderCheckoutShippingOptions    — freight banner, isEstimate, onItemReady order
 *   getSelectedShippingCode          — selection state after radio click
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('backend/shippingIntelligence.web', () => ({
  getShippingEstimate: vi.fn(),
  calculateBundleQuote: vi.fn(),
}));

import {
  isValidZip,
  fetchCheckoutShippingRates,
  initCheckoutShippingIntelligence,
  renderCheckoutShippingOptions,
  getSelectedShippingCode,
} from '../src/public/CheckoutShippingIntelligence.js';

import {
  getShippingEstimate,
  calculateBundleQuote,
} from 'backend/shippingIntelligence.web';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    value: '',
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    ...overrides,
  };
}

function makeWixEnv(overrides = {}) {
  const els = {
    '#checkoutShippingIntelWidget':   makeEl(),
    '#checkoutShippingZip':           makeEl({ value: '' }),
    '#checkoutShippingCalcBtn':       makeEl(),
    '#checkoutShippingResults':       makeEl(),
    '#checkoutShippingRatesRepeater': makeEl(),
    '#checkoutShippingLoader':        makeEl(),
    '#checkoutShippingError':         makeEl(),
    '#checkoutShippingFreightBanner': makeEl(),
    '#checkoutShippingOrigin':        makeEl(),
    ...overrides,
  };
  const $w = vi.fn(sel => els[sel] ?? null);
  $w.__els = els;
  return $w;
}

function makeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: vi.fn(k => store[k] ?? null),
    setItem: vi.fn((k, v) => { store[k] = String(v); }),
    removeItem: vi.fn(k => { delete store[k]; }),
    _store: store,
  };
}

/** Retrieve the onClick handler registered on a mock element, then call it. */
function triggerClick(el) {
  const handler = el.onClick.mock.calls[0]?.[0];
  if (!handler) throw new Error('No onClick registered on element');
  return handler();
}

const UPS_OPTION = {
  code: 'ups-ground',
  title: 'UPS Ground',
  cost: 49.99,
  estimatedDelivery: '5–7 business days',
  carrier: 'UPS',
  requiresLiftgate: false,
  isEstimate: false,
  isLTL: false,
};

const LTL_OPTION = {
  code: 'ltl-standard',
  title: 'LTL Freight (XPO)',
  cost: 199.00,
  estimatedDelivery: '7–10 business days',
  carrier: 'XPO',
  requiresLiftgate: true,
  isEstimate: false,
  isLTL: true,
};

const ESTIMATE_OPTION = {
  code: 'ups-ground',
  title: 'UPS Ground',
  cost: 55.00,
  estimatedDelivery: '5–7 business days',
  carrier: 'UPS',
  requiresLiftgate: false,
  isEstimate: true,
  isLTL: false,
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ── isValidZip ────────────────────────────────────────────────────────────────

describe('isValidZip', () => {
  it('accepts a valid 5-digit zip', () => {
    expect(isValidZip('28701')).toBe(true);
  });

  it('accepts another valid 5-digit zip', () => {
    expect(isValidZip('10001')).toBe(true);
  });

  it('rejects null', () => {
    expect(isValidZip(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidZip(undefined)).toBe(false);
  });

  it('rejects a 4-digit zip', () => {
    expect(isValidZip('2870')).toBe(false);
  });

  it('rejects a 6-digit zip', () => {
    expect(isValidZip('287011')).toBe(false);
  });

  it('rejects non-numeric input', () => {
    expect(isValidZip('abcde')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidZip('')).toBe(false);
  });
});

// ── fetchCheckoutShippingRates ────────────────────────────────────────────────

describe('fetchCheckoutShippingRates', () => {
  it('returns error for empty cart', async () => {
    const result = await fetchCheckoutShippingRates([], '28701');
    expect(result.success).toBe(false);
    expect(result.options).toEqual([]);
  });

  it('routes single-item cart through getShippingEstimate', async () => {
    getShippingEstimate.mockResolvedValue({ success: true, options: [UPS_OPTION] });
    const items = [{ productId: 'prod-abc', quantity: 1, price: 399 }];
    const result = await fetchCheckoutShippingRates(items, '28701');
    expect(getShippingEstimate).toHaveBeenCalledWith('prod-abc', '28701');
    expect(calculateBundleQuote).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('routes multi-item cart through calculateBundleQuote', async () => {
    calculateBundleQuote.mockResolvedValue({ success: true, options: [UPS_OPTION] });
    const items = [
      { productId: 'prod-a', quantity: 1, price: 300 },
      { productId: 'prod-b', quantity: 2, price: 150 },
    ];
    const result = await fetchCheckoutShippingRates(items, '28701');
    expect(calculateBundleQuote).toHaveBeenCalledWith(
      [
        { productId: 'prod-a', quantity: 1, price: 300 },
        { productId: 'prod-b', quantity: 2, price: 150 },
      ],
      '28701'
    );
    expect(getShippingEstimate).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});

// ── initCheckoutShippingIntelligence ─────────────────────────────────────────

describe('initCheckoutShippingIntelligence', () => {
  it('sets origin attribution text on init', async () => {
    const $w = makeWixEnv();
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [], { storage });
    expect($w.__els['#checkoutShippingOrigin'].text).toBe('Ships from Hendersonville, NC');
  });

  it('pre-populates ZIP from storage when available', async () => {
    const $w = makeWixEnv();
    const storage = makeStorage({ cf_zip: '28701' });
    await initCheckoutShippingIntelligence($w, [], { storage });
    expect($w.__els['#checkoutShippingZip'].value).toBe('28701');
  });

  it('does not set ZIP when storage is empty', async () => {
    const $w = makeWixEnv();
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [], { storage });
    expect($w.__els['#checkoutShippingZip'].value).toBe('');
  });

  it('hides error, freight banner, results, and loader on init', async () => {
    const $w = makeWixEnv();
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [], { storage });
    expect($w.__els['#checkoutShippingError'].hide).toHaveBeenCalled();
    expect($w.__els['#checkoutShippingFreightBanner'].hide).toHaveBeenCalled();
    expect($w.__els['#checkoutShippingResults'].hide).toHaveBeenCalled();
    expect($w.__els['#checkoutShippingLoader'].hide).toHaveBeenCalled();
  });

  it('registers onClick on calculate button', async () => {
    const $w = makeWixEnv();
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [], { storage });
    expect($w.__els['#checkoutShippingCalcBtn'].onClick).toHaveBeenCalledOnce();
  });

  it('shows inline error for invalid ZIP when calculate button is clicked', async () => {
    const $w = makeWixEnv();
    $w.__els['#checkoutShippingZip'].value = 'bad';
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [], { storage });

    await triggerClick($w.__els['#checkoutShippingCalcBtn']);

    const errEl = $w.__els['#checkoutShippingError'];
    expect(errEl.text).toMatch(/valid.*zip/i);
    expect(errEl.show).toHaveBeenCalled();
    expect(getShippingEstimate).not.toHaveBeenCalled();
  });

  it('calls API and renders results for valid ZIP', async () => {
    getShippingEstimate.mockResolvedValue({ success: true, options: [UPS_OPTION] });
    const $w = makeWixEnv();
    $w.__els['#checkoutShippingZip'].value = '28701';
    const storage = makeStorage();
    const onSelect = vi.fn();
    await initCheckoutShippingIntelligence($w, [{ productId: 'prod-a', quantity: 1, price: 399 }], { storage, onSelect });

    await triggerClick($w.__els['#checkoutShippingCalcBtn']);

    expect(getShippingEstimate).toHaveBeenCalledWith('prod-a', '28701');
    expect($w.__els['#checkoutShippingResults'].show).toHaveBeenCalled();
  });

  it('saves ZIP to storage after successful fetch', async () => {
    getShippingEstimate.mockResolvedValue({ success: true, options: [UPS_OPTION] });
    const $w = makeWixEnv();
    $w.__els['#checkoutShippingZip'].value = '28701';
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [{ productId: 'prod-a', quantity: 1, price: 399 }], { storage });

    await triggerClick($w.__els['#checkoutShippingCalcBtn']);

    expect(storage.setItem).toHaveBeenCalledWith('cf_zip', '28701');
  });

  it('shows fallback contact message when API returns no options', async () => {
    getShippingEstimate.mockResolvedValue({ success: true, options: [] });
    const $w = makeWixEnv();
    $w.__els['#checkoutShippingZip'].value = '28701';
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [{ productId: 'prod-a', quantity: 1, price: 399 }], { storage });

    await triggerClick($w.__els['#checkoutShippingCalcBtn']);

    const errEl = $w.__els['#checkoutShippingError'];
    expect(errEl.text).toMatch(/828.*252.*9449/);
    expect(errEl.show).toHaveBeenCalled();
  });

  it('shows fallback contact message when API throws', async () => {
    getShippingEstimate.mockRejectedValue(new Error('network error'));
    const $w = makeWixEnv();
    $w.__els['#checkoutShippingZip'].value = '28701';
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [{ productId: 'prod-a', quantity: 1, price: 399 }], { storage });

    await triggerClick($w.__els['#checkoutShippingCalcBtn']);

    const errEl = $w.__els['#checkoutShippingError'];
    expect(errEl.text).toMatch(/Contact us/i);
    expect(errEl.show).toHaveBeenCalled();
  });

  it('shows and hides loader during API call', async () => {
    let resolveApi;
    getShippingEstimate.mockReturnValue(new Promise(res => { resolveApi = res; }));

    const $w = makeWixEnv();
    $w.__els['#checkoutShippingZip'].value = '28701';
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [{ productId: 'prod-a', quantity: 1, price: 399 }], { storage });

    const clickPromise = triggerClick($w.__els['#checkoutShippingCalcBtn']);

    // Loader should be shown while in flight
    expect($w.__els['#checkoutShippingLoader'].show).toHaveBeenCalled();

    resolveApi({ success: true, options: [UPS_OPTION] });
    await clickPromise;

    expect($w.__els['#checkoutShippingLoader'].hide).toHaveBeenCalled();
  });
});

// ── renderCheckoutShippingOptions ─────────────────────────────────────────────

describe('renderCheckoutShippingOptions', () => {
  it('shows freight banner when LTL option is present', () => {
    const $w = makeWixEnv();
    renderCheckoutShippingOptions($w, [LTL_OPTION]);
    expect($w.__els['#checkoutShippingFreightBanner'].show).toHaveBeenCalled();
  });

  it('hides freight banner when no LTL options', () => {
    const $w = makeWixEnv();
    renderCheckoutShippingOptions($w, [UPS_OPTION]);
    expect($w.__els['#checkoutShippingFreightBanner'].hide).toHaveBeenCalled();
  });

  it('shows freight banner when option has requiresFreight flag', () => {
    const $w = makeWixEnv();
    const freightOption = { ...UPS_OPTION, requiresFreight: true, requiresLiftgate: false, isLTL: false };
    renderCheckoutShippingOptions($w, [freightOption]);
    expect($w.__els['#checkoutShippingFreightBanner'].show).toHaveBeenCalled();
  });

  it('registers onItemReady BEFORE setting .data on repeater', () => {
    const $w = makeWixEnv();
    const repeater = $w.__els['#checkoutShippingRatesRepeater'];
    const callOrder = [];
    repeater.onItemReady = vi.fn(() => callOrder.push('onItemReady'));
    Object.defineProperty(repeater, 'data', {
      set: () => callOrder.push('data'),
      get: () => [],
    });

    renderCheckoutShippingOptions($w, [UPS_OPTION]);

    expect(callOrder[0]).toBe('onItemReady');
    expect(callOrder[1]).toBe('data');
  });

  it('appends "(estimated)" suffix to title when isEstimate is true', () => {
    const $w = makeWixEnv();
    const repeater = $w.__els['#checkoutShippingRatesRepeater'];

    let capturedHandler;
    repeater.onItemReady = vi.fn(fn => { capturedHandler = fn; });

    renderCheckoutShippingOptions($w, [ESTIMATE_OPTION]);

    const itemEl = {
      '#checkoutShippingOptionTitle': makeEl(),
      '#checkoutShippingOptionPrice': makeEl(),
      '#checkoutShippingOptionDelivery': makeEl(),
      '#checkoutShippingOptionRadio': makeEl(),
    };
    const $item = sel => itemEl[sel];

    capturedHandler($item, { ...ESTIMATE_OPTION, _id: 'checkout-shipping-0' });

    expect(itemEl['#checkoutShippingOptionTitle'].text).toBe('UPS Ground (estimated)');
  });

  it('does not append "(estimated)" suffix when isEstimate is false', () => {
    const $w = makeWixEnv();
    const repeater = $w.__els['#checkoutShippingRatesRepeater'];

    let capturedHandler;
    repeater.onItemReady = vi.fn(fn => { capturedHandler = fn; });

    renderCheckoutShippingOptions($w, [UPS_OPTION]);

    const itemEl = {
      '#checkoutShippingOptionTitle': makeEl(),
      '#checkoutShippingOptionPrice': makeEl(),
      '#checkoutShippingOptionDelivery': makeEl(),
      '#checkoutShippingOptionRadio': makeEl(),
    };
    const $item = sel => itemEl[sel];

    capturedHandler($item, { ...UPS_OPTION, _id: 'checkout-shipping-0' });

    expect(itemEl['#checkoutShippingOptionTitle'].text).toBe('UPS Ground');
  });

  it('formats cost correctly in price element', () => {
    const $w = makeWixEnv();
    const repeater = $w.__els['#checkoutShippingRatesRepeater'];

    let capturedHandler;
    repeater.onItemReady = vi.fn(fn => { capturedHandler = fn; });

    renderCheckoutShippingOptions($w, [UPS_OPTION]);

    const itemEl = {
      '#checkoutShippingOptionTitle': makeEl(),
      '#checkoutShippingOptionPrice': makeEl(),
      '#checkoutShippingOptionDelivery': makeEl(),
      '#checkoutShippingOptionRadio': makeEl(),
    };
    const $item = sel => itemEl[sel];

    capturedHandler($item, { ...UPS_OPTION, _id: 'checkout-shipping-0' });

    expect(itemEl['#checkoutShippingOptionPrice'].text).toBe('$49.99');
  });

  it('sets delivery text on delivery element', () => {
    const $w = makeWixEnv();
    const repeater = $w.__els['#checkoutShippingRatesRepeater'];

    let capturedHandler;
    repeater.onItemReady = vi.fn(fn => { capturedHandler = fn; });

    renderCheckoutShippingOptions($w, [UPS_OPTION]);

    const itemEl = {
      '#checkoutShippingOptionTitle': makeEl(),
      '#checkoutShippingOptionPrice': makeEl(),
      '#checkoutShippingOptionDelivery': makeEl(),
      '#checkoutShippingOptionRadio': makeEl(),
    };
    const $item = sel => itemEl[sel];

    capturedHandler($item, { ...UPS_OPTION, _id: 'checkout-shipping-0' });

    expect(itemEl['#checkoutShippingOptionDelivery'].text).toBe('5–7 business days');
  });

  it('shows the results container after rendering', () => {
    const $w = makeWixEnv();
    renderCheckoutShippingOptions($w, [UPS_OPTION]);
    expect($w.__els['#checkoutShippingResults'].show).toHaveBeenCalled();
  });
});

// ── getSelectedShippingCode ───────────────────────────────────────────────────

describe('getSelectedShippingCode', () => {
  it('returns null before any selection', async () => {
    const $w = makeWixEnv();
    const storage = makeStorage();
    await initCheckoutShippingIntelligence($w, [], { storage });
    expect(getSelectedShippingCode()).toBeNull();
  });

  it('returns selected code after radio onClick fires', () => {
    const $w = makeWixEnv();
    const repeater = $w.__els['#checkoutShippingRatesRepeater'];

    let capturedHandler;
    repeater.onItemReady = vi.fn(fn => { capturedHandler = fn; });

    renderCheckoutShippingOptions($w, [UPS_OPTION]);

    const radioEl = makeEl();
    const $item = sel => ({
      '#checkoutShippingOptionTitle': makeEl(),
      '#checkoutShippingOptionPrice': makeEl(),
      '#checkoutShippingOptionDelivery': makeEl(),
      '#checkoutShippingOptionRadio': radioEl,
    }[sel]);

    capturedHandler($item, { ...UPS_OPTION, _id: 'checkout-shipping-0' });

    // Trigger the radio onClick
    const radioHandler = radioEl.onClick.mock.calls[0]?.[0];
    radioHandler();

    expect(getSelectedShippingCode()).toBe('ups-ground');
  });

  it('calls onSelect callback with code and option when radio clicked', async () => {
    const $w = makeWixEnv();
    const storage = makeStorage();
    const onSelect = vi.fn();
    await initCheckoutShippingIntelligence($w, [{ productId: 'p', quantity: 1 }], { storage, onSelect });

    const repeater = $w.__els['#checkoutShippingRatesRepeater'];
    let capturedHandler;
    repeater.onItemReady = vi.fn(fn => { capturedHandler = fn; });

    renderCheckoutShippingOptions($w, [UPS_OPTION]);

    const radioEl = makeEl();
    const $item = sel => ({
      '#checkoutShippingOptionTitle': makeEl(),
      '#checkoutShippingOptionPrice': makeEl(),
      '#checkoutShippingOptionDelivery': makeEl(),
      '#checkoutShippingOptionRadio': radioEl,
    }[sel]);

    capturedHandler($item, { ...UPS_OPTION, _id: 'checkout-shipping-0' });

    const radioHandler = radioEl.onClick.mock.calls[0]?.[0];
    radioHandler();

    expect(onSelect).toHaveBeenCalledWith('ups-ground', expect.objectContaining({ code: 'ups-ground' }));
  });
});
