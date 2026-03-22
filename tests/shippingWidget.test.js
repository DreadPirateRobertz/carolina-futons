/**
 * @file shippingWidget.test.js
 * @description Tests for src/public/ShippingWidget.js — product page zip-input widget.
 *
 * CF-o0va: Product Page #shippingEstimateWidget
 *
 * Covers:
 *  - isValidZip: pure zip validation
 *  - initShippingWidget: pre-population, wiring, calculate flow, rendering, errors
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/shippingIntelligence.web', () => ({
  getShippingEstimate: vi.fn(),
}));
vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

import { isValidZip, initShippingWidget } from '../src/public/ShippingWidget.js';
import { getShippingEstimate } from 'backend/shippingIntelligence.web';
import { logError } from 'backend/errorMonitoring.web';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    value: '',
    link: '',
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    onItemReady: vi.fn(),
    addCssClass: vi.fn(),
    removeCssClass: vi.fn(),
    ...overrides,
  };
}

function makeWixEnv(overrides = {}) {
  const els = {
    '#shippingEstimateSection': makeEl(),
    '#shippingZipInput':        makeEl({ value: '' }),
    '#shippingCalculateBtn':    makeEl(),
    '#shippingOptionsSection':  makeEl(),
    '#shippingOptionsRepeater': makeEl(),
    '#shippingLoadingText':     makeEl(),
    '#shippingErrorText':       makeEl(),
    '#shippingFreightNote':     makeEl(),
    '#shippingOriginText':      makeEl(),
    '#shippingHandlingNote':    makeEl(),
    ...overrides,
  };
  const $w = vi.fn(sel => els[sel] || null);
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

const BASE_RESULT = {
  success: true,
  options: [
    { code: 'ups-ground', title: 'UPS Ground', cost: 49.99, currency: 'USD',
      deliveryTime: '5-7 business days', isEstimate: false, requiresFreight: false },
    { code: 'ups-3day', title: 'UPS 3-Day Select', cost: 89.99, currency: 'USD',
      deliveryTime: '3 business days', isEstimate: false, requiresFreight: false },
  ],
  handlingFee_usd: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
});

// ── isValidZip ────────────────────────────────────────────────────────────

describe('isValidZip', () => {
  it('accepts a valid 5-digit zip', () => {
    expect(isValidZip('28701')).toBe(true);
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
  it('rejects null', () => {
    expect(isValidZip(null)).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidZip('')).toBe(false);
  });
});

// ── initShippingWidget ────────────────────────────────────────────────────

describe('initShippingWidget', () => {

  // ── pre-population ──────────────────────────────────────────────────

  it('pre-populates zip from storage when saved', async () => {
    const storage = makeStorage({ cf_zip: '28701' });
    const $w = makeWixEnv();
    await initShippingWidget($w, 'prod-1', { storage });
    expect($w.__els['#shippingZipInput'].value).toBe('28701');
  });

  it('leaves zip empty when storage has no saved zip', async () => {
    const storage = makeStorage();
    const $w = makeWixEnv();
    await initShippingWidget($w, 'prod-1', { storage });
    expect($w.__els['#shippingZipInput'].value).toBe('');
  });

  // ── origin text ─────────────────────────────────────────────────────

  it('sets #shippingOriginText to Ships from Hendersonville NC', async () => {
    const storage = makeStorage();
    const $w = makeWixEnv();
    await initShippingWidget($w, 'prod-1', { storage });
    expect($w.__els['#shippingOriginText'].text).toContain('Hendersonville');
  });

  // ── button wiring ───────────────────────────────────────────────────

  it('registers onClick on #shippingCalculateBtn', async () => {
    const storage = makeStorage();
    const $w = makeWixEnv();
    await initShippingWidget($w, 'prod-1', { storage });
    expect($w.__els['#shippingCalculateBtn'].onClick).toHaveBeenCalledTimes(1);
  });

  it('registers onKeyPress on #shippingZipInput', async () => {
    const storage = makeStorage();
    const $w = makeWixEnv();
    await initShippingWidget($w, 'prod-1', { storage });
    expect($w.__els['#shippingZipInput'].onKeyPress).toHaveBeenCalledTimes(1);
  });

  // ── invalid zip ─────────────────────────────────────────────────────

  it('shows error and does not call API for invalid zip', async () => {
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '123' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#shippingErrorText'].show).toHaveBeenCalled();
    expect(getShippingEstimate).not.toHaveBeenCalled();
  });

  // ── loading state ───────────────────────────────────────────────────

  it('shows loading while API is in flight', async () => {
    let resolve;
    getShippingEstimate.mockReturnValue(new Promise(r => { resolve = r; }));
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    const p = handler();
    expect($w.__els['#shippingLoadingText'].show).toHaveBeenCalled();
    resolve(BASE_RESULT);
    await p;
  });

  it('hides loading after API resolves', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#shippingLoadingText'].hide).toHaveBeenCalled();
  });

  // ── API call ────────────────────────────────────────────────────────

  it('calls getShippingEstimate with productId and zip', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '10001' }) });
    await initShippingWidget($w, 'prod-abc', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(getShippingEstimate).toHaveBeenCalledWith('prod-abc', '10001');
  });

  // ── success rendering ───────────────────────────────────────────────

  it('saves zip to storage on success', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(storage.setItem).toHaveBeenCalledWith('cf_zip', '28701');
  });

  it('shows #shippingOptionsSection on success', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#shippingOptionsSection'].show).toHaveBeenCalled();
  });

  it('registers onItemReady BEFORE setting .data on repeater', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    const callOrder = [];
    const repeater = {
      show: vi.fn(), hide: vi.fn(),
      onItemReady: vi.fn(() => callOrder.push('onItemReady')),
      _data: undefined,
      get data() { return this._data; },
      set data(v) { callOrder.push('data'); this._data = v; },
    };
    const $w = makeWixEnv({
      '#shippingZipInput': makeEl({ value: '28701' }),
      '#shippingOptionsRepeater': repeater,
    });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(callOrder.indexOf('onItemReady')).toBeLessThan(callOrder.indexOf('data'));
  });

  it('sets repeater data with _id and option fields', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    let capturedData;
    const repeater = {
      show: vi.fn(), hide: vi.fn(),
      onItemReady: vi.fn(),
      get data() { return capturedData; },
      set data(v) { capturedData = v; },
    };
    const $w = makeWixEnv({
      '#shippingZipInput': makeEl({ value: '28701' }),
      '#shippingOptionsRepeater': repeater,
    });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(capturedData).toHaveLength(2);
    expect(capturedData[0]._id).toBeDefined();
    expect(capturedData[0].title).toBe('UPS Ground');
  });

  it('sets #shippingOptionTitle and #shippingOptionCost in onItemReady', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    let capturedCallback;
    const repeater = makeEl({
      onItemReady: vi.fn(cb => { capturedCallback = cb; }),
    });
    const $w = makeWixEnv({
      '#shippingZipInput': makeEl({ value: '28701' }),
      '#shippingOptionsRepeater': repeater,
    });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    const titleEl = makeEl();
    const costEl = makeEl();
    const $item = vi.fn(sel => {
      if (sel === '#shippingOptionTitle') return titleEl;
      if (sel === '#shippingOptionCost') return costEl;
      return makeEl();
    });
    capturedCallback($item, { _id: 'o-0', title: 'UPS Ground', cost: 49.99, isEstimate: false });
    expect(titleEl.text).toBe('UPS Ground');
    expect(costEl.text).toBe('$49.99');
  });

  it('appends (estimated) to title for isEstimate options', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    let capturedCallback;
    const repeater = makeEl({
      onItemReady: vi.fn(cb => { capturedCallback = cb; }),
    });
    const $w = makeWixEnv({
      '#shippingZipInput': makeEl({ value: '28701' }),
      '#shippingOptionsRepeater': repeater,
    });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    const titleEl = makeEl();
    const $item = vi.fn(sel => sel === '#shippingOptionTitle' ? titleEl : makeEl());
    capturedCallback($item, { _id: 'o-0', title: 'LTL Freight', cost: 299, isEstimate: true });
    expect(titleEl.text).toContain('estimated');
  });

  // ── freight note ────────────────────────────────────────────────────

  it('shows #shippingFreightNote when any option requiresFreight', async () => {
    const freightResult = {
      ...BASE_RESULT,
      options: [{ ...BASE_RESULT.options[0], requiresFreight: true }],
    };
    getShippingEstimate.mockResolvedValue(freightResult);
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#shippingFreightNote'].show).toHaveBeenCalled();
  });

  it('hides #shippingFreightNote when no options requiresFreight', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#shippingFreightNote'].hide).toHaveBeenCalled();
  });

  // ── handling fee note ───────────────────────────────────────────────

  it('shows #shippingHandlingNote when handlingFee_usd > 0', async () => {
    const withFee = { ...BASE_RESULT, handlingFee_usd: 25 };
    getShippingEstimate.mockResolvedValue(withFee);
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#shippingHandlingNote'].show).toHaveBeenCalled();
  });

  it('hides #shippingHandlingNote when handlingFee_usd is 0', async () => {
    getShippingEstimate.mockResolvedValue(BASE_RESULT);
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#shippingHandlingNote'].hide).toHaveBeenCalled();
  });

  // ── API error ───────────────────────────────────────────────────────

  it('shows friendly message for invalid_zip API error', async () => {
    getShippingEstimate.mockResolvedValue({ success: false, error: 'invalid_zip' });
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '99999' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#shippingErrorText'].show).toHaveBeenCalled();
    expect($w.__els['#shippingErrorText'].text).toContain('valid');
  });

  it('shows API error message for other failures', async () => {
    getShippingEstimate.mockResolvedValue({ success: false, error: 'Service unavailable' });
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#shippingErrorText'].text).toBe('Service unavailable');
  });

  it('calls logError and shows message on exception', async () => {
    getShippingEstimate.mockRejectedValue(new Error('network failure'));
    const storage = makeStorage();
    const $w = makeWixEnv({ '#shippingZipInput': makeEl({ value: '28701' }) });
    await initShippingWidget($w, 'prod-1', { storage });
    const handler = $w.__els['#shippingCalculateBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'ShippingWidget.calculate' }),
    );
    expect($w.__els['#shippingErrorText'].show).toHaveBeenCalled();
  });

  // ── null safety ─────────────────────────────────────────────────────

  it('does not throw when $w returns null for all elements', async () => {
    const storage = makeStorage();
    const $w = vi.fn(() => null);
    await expect(initShippingWidget($w, 'prod-1', { storage })).resolves.not.toThrow();
  });
});
