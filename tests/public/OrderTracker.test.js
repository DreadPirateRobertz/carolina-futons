/**
 * Tests for src/public/OrderTracker.js
 * CF-vp8k: Order Status Tracker Widget — Velo frontend for Order Tracking page
 *
 * Coverage:
 *   getActiveSteps   — maps fulfillmentStatus to progress bar active step count
 *   initOrderTracker — wires form, calls backend, renders result & progress bar
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock('backend/orderTracking.web', () => ({
  lookupOrder: vi.fn(),
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

import { getActiveSteps, initOrderTracker } from '../../src/public/OrderTracker.js';
import { lookupOrder } from 'backend/orderTracking.web';
import { logError } from 'backend/errorMonitoring.web';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    value: '',
    link: '',
    target: '',
    disabled: false,
    accessibility: { ariaLabel: '', ariaCurrent: '' },
    show: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    onClick: vi.fn(),
    onKeyPress: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    expand: vi.fn().mockResolvedValue(undefined),
    collapse: vi.fn().mockResolvedValue(undefined),
    addCssClass: vi.fn(),
    removeCssClass: vi.fn(),
    onItemReady: vi.fn(),
    ...overrides,
  };
}

const LINE_ITEMS = [
  { name: 'Futon Frame', quantity: 1, price: 299, sku: 'FRM-001' },
  { name: 'Futon Mattress', quantity: 1, price: 149, sku: 'MAT-002' },
];

const BASE_ORDER = {
  success: true,
  order: {
    number: '12345',
    createdDate: '2026-03-01T00:00:00Z',
    status: 'In Transit',
    statusDescription: 'Your package is on its way',
    fulfillmentStatus: 'IN_TRANSIT',
    paymentStatus: 'PAID',
  },
  shipping: {
    carrier: 'UPS',
    serviceName: 'UPS Ground',
    trackingNumber: '1Z999AA10123456784',
    estimatedDelivery: '2026-03-27T00:00:00Z',
    shippingAddress: { city: 'Asheville', state: 'NC', postalCode: '28801' },
  },
  tracking: { status: 'In Transit', statusCode: 'I', activities: [] },
  timeline: [],
  lineItems: LINE_ITEMS,
  totals: { subtotal: 448, shipping: 0, total: 448 },
  notificationsEnabled: false,
};

function makeWixEnv(overrides = {}) {
  const els = {
    '#orderTrackSection':    makeEl(),
    '#orderLookupForm':      makeEl(),
    '#orderNumberInput':     makeEl({ value: '12345' }),
    '#orderEmailInput':      makeEl({ value: 'test@example.com' }),
    '#orderLookupBtn':       makeEl(),
    '#orderLookupError':     makeEl(),
    '#orderLookupSpinner':   makeEl(),
    '#orderResultSection':   makeEl(),
    '#orderStatusBadge':     makeEl(),
    '#orderStatusText':      makeEl(),
    '#orderEstimatedDelivery': makeEl(),
    '#orderCarrierText':     makeEl(),
    '#orderTrackingNumber':  makeEl(),
    '#orderTrackingLink':    makeEl(),
    '#orderItemsRepeater':   makeEl(),
    '#orderProgressBar':     makeEl(),
    '#orderStep1':           makeEl(),
    '#orderStep2':           makeEl(),
    '#orderStep3':           makeEl(),
    '#orderStep4':           makeEl(),
    ...overrides,
  };
  const $w = vi.fn(sel => els[sel] || null);
  $w.__els = els;
  return $w;
}

beforeEach(() => {
  vi.resetAllMocks();
});

// ── getActiveSteps ─────────────────────────────────────────────────────────

describe('getActiveSteps', () => {
  it('returns 1 for NOT_FULFILLED (order placed, not yet shipped)', () => {
    expect(getActiveSteps('NOT_FULFILLED')).toBe(1);
  });

  it('returns 2 for LABEL_CREATED', () => {
    expect(getActiveSteps('LABEL_CREATED')).toBe(2);
  });

  it('returns 3 for IN_TRANSIT', () => {
    expect(getActiveSteps('IN_TRANSIT')).toBe(3);
  });

  it('returns 3 for PICKED_UP', () => {
    expect(getActiveSteps('PICKED_UP')).toBe(3);
  });

  it('returns 3 for OUT_FOR_DELIVERY', () => {
    expect(getActiveSteps('OUT_FOR_DELIVERY')).toBe(3);
  });

  it('returns 4 for DELIVERED', () => {
    expect(getActiveSteps('DELIVERED')).toBe(4);
  });

  it('returns 1 for EXCEPTION', () => {
    expect(getActiveSteps('EXCEPTION')).toBe(1);
  });

  it('returns 1 for RETURNED', () => {
    expect(getActiveSteps('RETURNED')).toBe(1);
  });

  it('returns 1 for UNKNOWN status', () => {
    expect(getActiveSteps('UNKNOWN')).toBe(1);
  });

  it('returns 1 for an unrecognised status string', () => {
    expect(getActiveSteps('SOMETHING_ELSE')).toBe(1);
  });
});

// ── initOrderTracker ──────────────────────────────────────────────────────

describe('initOrderTracker', () => {
  // ── initial state ────────────────────────────────────────────────────

  it('hides orderLookupError on init', async () => {
    const $w = makeWixEnv();
    await initOrderTracker($w);
    expect($w.__els['#orderLookupError'].hide).toHaveBeenCalled();
  });

  it('hides orderLookupSpinner on init', async () => {
    const $w = makeWixEnv();
    await initOrderTracker($w);
    expect($w.__els['#orderLookupSpinner'].hide).toHaveBeenCalled();
  });

  it('hides orderResultSection on init', async () => {
    const $w = makeWixEnv();
    await initOrderTracker($w);
    expect($w.__els['#orderResultSection'].hide).toHaveBeenCalled();
  });

  // ── form wiring ──────────────────────────────────────────────────────

  it('wires orderLookupBtn onClick', async () => {
    const $w = makeWixEnv();
    await initOrderTracker($w);
    expect($w.__els['#orderLookupBtn'].onClick).toHaveBeenCalled();
  });

  it('wires orderNumberInput onKeyPress', async () => {
    const $w = makeWixEnv();
    await initOrderTracker($w);
    expect($w.__els['#orderNumberInput'].onKeyPress).toHaveBeenCalled();
  });

  it('wires orderEmailInput onKeyPress', async () => {
    const $w = makeWixEnv();
    await initOrderTracker($w);
    expect($w.__els['#orderEmailInput'].onKeyPress).toHaveBeenCalled();
  });

  // ── validation ───────────────────────────────────────────────────────

  it('shows error and skips API when order number is empty', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv({ '#orderNumberInput': makeEl({ value: '' }) });
    await initOrderTracker($w);
    // trigger button click handler
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(lookupOrder).not.toHaveBeenCalled();
    expect($w.__els['#orderLookupError'].show).toHaveBeenCalled();
  });

  it('shows error and skips API when email is empty', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv({ '#orderEmailInput': makeEl({ value: '' }) });
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(lookupOrder).not.toHaveBeenCalled();
    expect($w.__els['#orderLookupError'].show).toHaveBeenCalled();
  });

  it('shows error and skips API for invalid email format', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv({ '#orderEmailInput': makeEl({ value: 'not-an-email' }) });
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(lookupOrder).not.toHaveBeenCalled();
    expect($w.__els['#orderLookupError'].show).toHaveBeenCalled();
  });

  // ── loading state ────────────────────────────────────────────────────

  it('shows spinner and hides error when lookup begins', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderLookupSpinner'].show).toHaveBeenCalled();
    expect($w.__els['#orderLookupError'].hide).toHaveBeenCalled();
  });

  it('hides spinner after successful lookup', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderLookupSpinner'].hide).toHaveBeenCalled();
  });

  // ── API call ─────────────────────────────────────────────────────────

  it('calls lookupOrder with trimmed order number and email', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv({
      '#orderNumberInput': makeEl({ value: '  12345  ' }),
      '#orderEmailInput':  makeEl({ value: '  test@example.com  ' }),
    });
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(lookupOrder).toHaveBeenCalledWith('12345', 'test@example.com');
  });

  it('enter key in orderNumberInput triggers lookup', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const [[handler]] = $w.__els['#orderNumberInput'].onKeyPress.mock.calls;
    await handler({ key: 'Enter' });
    expect(lookupOrder).toHaveBeenCalled();
  });

  it('non-Enter key in orderNumberInput does not trigger lookup', async () => {
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const [[handler]] = $w.__els['#orderNumberInput'].onKeyPress.mock.calls;
    await handler({ key: 'a' });
    expect(lookupOrder).not.toHaveBeenCalled();
  });

  it('enter key in orderEmailInput triggers lookup', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const [[handler]] = $w.__els['#orderEmailInput'].onKeyPress.mock.calls;
    await handler({ key: 'Enter' });
    expect(lookupOrder).toHaveBeenCalled();
  });

  // ── success state ────────────────────────────────────────────────────

  it('hides lookup form and shows result section on success', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderLookupForm'].hide).toHaveBeenCalled();
    expect($w.__els['#orderResultSection'].show).toHaveBeenCalled();
  });

  it('sets orderStatusText from order.status', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderStatusText'].text).toBe('In Transit');
  });

  it('sets orderEstimatedDelivery text when estimatedDelivery is present', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderEstimatedDelivery'].text).toContain('Estimated delivery:');
  });

  it('sets orderCarrierText from shipping.carrier', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderCarrierText'].text).toBe('UPS');
  });

  it('sets orderTrackingNumber text from shipping.trackingNumber', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderTrackingNumber'].text).toBe('1Z999AA10123456784');
  });

  it('shows orderTrackingLink when tracking number is present', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderTrackingLink'].show).toHaveBeenCalled();
  });

  it('sets orderTrackingLink.link to UPS tracking URL', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderTrackingLink'].link).toContain('1Z999AA10123456784');
  });

  it('hides orderTrackingLink when no tracking number', async () => {
    const noTracking = {
      ...BASE_ORDER,
      shipping: { ...BASE_ORDER.shipping, trackingNumber: null },
    };
    lookupOrder.mockResolvedValue(noTracking);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderTrackingLink'].hide).toHaveBeenCalled();
  });

  it('sets FedEx tracking URL for FEDEX carrier', async () => {
    const fedex = {
      ...BASE_ORDER,
      shipping: { ...BASE_ORDER.shipping, carrier: 'FEDEX', trackingNumber: 'TRK123' },
    };
    lookupOrder.mockResolvedValue(fedex);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderTrackingLink'].link).toContain('fedex.com');
    expect($w.__els['#orderTrackingLink'].link).toContain('TRK123');
  });

  it('sets USPS tracking URL for USPS carrier', async () => {
    const usps = {
      ...BASE_ORDER,
      shipping: { ...BASE_ORDER.shipping, carrier: 'USPS', trackingNumber: 'TRK456' },
    };
    lookupOrder.mockResolvedValue(usps);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderTrackingLink'].link).toContain('usps.com');
    expect($w.__els['#orderTrackingLink'].link).toContain('TRK456');
  });

  it('hides orderTrackingLink for unknown carrier (no wrong-carrier fallback)', async () => {
    const unknown = {
      ...BASE_ORDER,
      shipping: { ...BASE_ORDER.shipping, carrier: 'DHL', trackingNumber: 'TRK789' },
    };
    lookupOrder.mockResolvedValue(unknown);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderTrackingLink'].hide).toHaveBeenCalled();
    expect($w.__els['#orderTrackingLink'].show).not.toHaveBeenCalled();
  });

  // ── progress bar ─────────────────────────────────────────────────────

  it('activates all 4 steps for DELIVERED', async () => {
    const delivered = { ...BASE_ORDER, order: { ...BASE_ORDER.order, fulfillmentStatus: 'DELIVERED', status: 'Delivered' } };
    lookupOrder.mockResolvedValue(delivered);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderStep1'].addCssClass).toHaveBeenCalledWith('order-step-active');
    expect($w.__els['#orderStep2'].addCssClass).toHaveBeenCalledWith('order-step-active');
    expect($w.__els['#orderStep3'].addCssClass).toHaveBeenCalledWith('order-step-active');
    expect($w.__els['#orderStep4'].addCssClass).toHaveBeenCalledWith('order-step-active');
  });

  it('activates steps 1–3 for IN_TRANSIT (step 4 inactive)', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderStep1'].addCssClass).toHaveBeenCalledWith('order-step-active');
    expect($w.__els['#orderStep2'].addCssClass).toHaveBeenCalledWith('order-step-active');
    expect($w.__els['#orderStep3'].addCssClass).toHaveBeenCalledWith('order-step-active');
    expect($w.__els['#orderStep4'].addCssClass).not.toHaveBeenCalled();
  });

  it('activates only step 1 for NOT_FULFILLED', async () => {
    const notFulfilled = { ...BASE_ORDER, order: { ...BASE_ORDER.order, fulfillmentStatus: 'NOT_FULFILLED', status: 'Processing' } };
    lookupOrder.mockResolvedValue(notFulfilled);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderStep1'].addCssClass).toHaveBeenCalledWith('order-step-active');
    expect($w.__els['#orderStep2'].addCssClass).not.toHaveBeenCalled();
    expect($w.__els['#orderStep3'].addCssClass).not.toHaveBeenCalled();
    expect($w.__els['#orderStep4'].addCssClass).not.toHaveBeenCalled();
  });

  it('removes active CSS from all steps before setting active ones', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderStep1'].removeCssClass).toHaveBeenCalledWith('order-step-active');
    expect($w.__els['#orderStep4'].removeCssClass).toHaveBeenCalledWith('order-step-active');
  });

  // ── line items repeater ──────────────────────────────────────────────

  it('registers onItemReady BEFORE setting .data on orderItemsRepeater', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const callOrder = [];
    // Build repeater directly — makeEl() spread would strip the getter/setter descriptor
    const repeater = {
      show: vi.fn(), hide: vi.fn(),
      onItemReady: vi.fn(() => callOrder.push('onItemReady')),
      _data: undefined,
      get data() { return this._data; },
      set data(v) { callOrder.push('data'); this._data = v; },
    };
    const $w = makeWixEnv({ '#orderItemsRepeater': repeater });
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    const onItemReadyIdx = callOrder.indexOf('onItemReady');
    const dataIdx = callOrder.indexOf('data');
    expect(onItemReadyIdx).toBeGreaterThanOrEqual(0);
    expect(dataIdx).toBeGreaterThan(onItemReadyIdx);
  });

  it('sets orderItemsRepeater.data with _id fields for each line item', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    let capturedData;
    // Build repeater directly — makeEl() spread would strip the getter/setter descriptor
    const repeater = {
      show: vi.fn(), hide: vi.fn(),
      onItemReady: vi.fn(),
      get data() { return capturedData; },
      set data(v) { capturedData = v; },
    };
    const $w = makeWixEnv({ '#orderItemsRepeater': repeater });
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(capturedData).toHaveLength(2);
    expect(capturedData[0]._id).toBeDefined();
    expect(capturedData[0].name).toBe('Futon Frame');
  });

  it('sets item name text in onItemReady callback', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    let capturedCallback;
    const repeater = makeEl({
      onItemReady: vi.fn(cb => { capturedCallback = cb; }),
    });
    const $w = makeWixEnv({ '#orderItemsRepeater': repeater });
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    const $item = vi.fn(() => makeEl());
    capturedCallback($item, { _id: 'i-0', name: 'Futon Frame', quantity: 1, price: 299 });
    expect($item).toHaveBeenCalledWith('#orderItemName');
  });

  // ── error state ──────────────────────────────────────────────────────

  it('shows orderLookupError when API returns success:false', async () => {
    lookupOrder.mockResolvedValue({ success: false, error: 'Order not found.' });
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderLookupError'].show).toHaveBeenCalled();
  });

  it('sets error text from API error message', async () => {
    lookupOrder.mockResolvedValue({ success: false, error: 'Order not found.' });
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderLookupError'].text).toBe('Order not found.');
  });

  it('uses fallback message when success:false has no error field', async () => {
    lookupOrder.mockResolvedValue({ success: false });
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderLookupError'].text).toBe('Order not found. Please check your details.');
  });

  it('hides spinner on API not-found response', async () => {
    lookupOrder.mockResolvedValue({ success: false, error: 'Order not found.' });
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderLookupSpinner'].hide).toHaveBeenCalled();
  });

  it('shows orderLookupError on network rejection', async () => {
    lookupOrder.mockRejectedValue(new Error('network error'));
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderLookupError'].show).toHaveBeenCalled();
  });

  it('calls logError on network rejection', async () => {
    lookupOrder.mockRejectedValue(new Error('network error'));
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'OrderTracker.lookupOrder' }),
    );
  });

  it('hides spinner on network rejection', async () => {
    lookupOrder.mockRejectedValue(new Error('network error'));
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderLookupSpinner'].hide).toHaveBeenCalled();
  });

  // ── clearResult ──────────────────────────────────────────────────────

  it('clearResult hides result section and shows form', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    const { clearResult } = await initOrderTracker($w);
    await clearResult();
    expect($w.__els['#orderResultSection'].hide).toHaveBeenCalled();
    expect($w.__els['#orderLookupForm'].show).toHaveBeenCalled();
  });

  it('clearResult clears the input fields', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    const { clearResult } = await initOrderTracker($w);
    await clearResult();
    expect($w.__els['#orderNumberInput'].value).toBe('');
    expect($w.__els['#orderEmailInput'].value).toBe('');
  });

  // ── tracking link target ─────────────────────────────────────────────

  it('sets orderTrackingLink.target to _blank', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderTrackingLink'].target).toBe('_blank');
  });

  // ── accessibility ─────────────────────────────────────────────────────

  it('sets ariaLabel on orderNumberInput', async () => {
    const $w = makeWixEnv();
    await initOrderTracker($w);
    expect($w.__els['#orderNumberInput'].accessibility.ariaLabel).toBeTruthy();
  });

  it('sets ariaLabel on orderEmailInput', async () => {
    const $w = makeWixEnv();
    await initOrderTracker($w);
    expect($w.__els['#orderEmailInput'].accessibility.ariaLabel).toBeTruthy();
  });

  it('sets ariaLabel on orderStatusBadge with full status text on result', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderStatusBadge'].accessibility.ariaLabel).toContain('In Transit');
  });

  it('sets aria-current=step on active progress steps', async () => {
    const delivered = { ...BASE_ORDER, order: { ...BASE_ORDER.order, fulfillmentStatus: 'DELIVERED', status: 'Delivered' } };
    lookupOrder.mockResolvedValue(delivered);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderStep4'].accessibility.ariaCurrent).toBe('step');
  });

  it('clears aria-current on inactive progress steps', async () => {
    lookupOrder.mockResolvedValue(BASE_ORDER); // IN_TRANSIT → steps 1-3 active
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    expect($w.__els['#orderStep4'].accessibility.ariaCurrent).toBe(false);
  });

  it('sets aria-current=step only on the last active step, not all active steps', async () => {
    const delivered = { ...BASE_ORDER, order: { ...BASE_ORDER.order, fulfillmentStatus: 'DELIVERED', status: 'Delivered' } };
    lookupOrder.mockResolvedValue(delivered);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await handler();
    // Only step 4 (the last active) should have aria-current='step'
    expect($w.__els['#orderStep4'].accessibility.ariaCurrent).toBe('step');
    expect($w.__els['#orderStep1'].accessibility.ariaCurrent).toBe(false);
    expect($w.__els['#orderStep2'].accessibility.ariaCurrent).toBe(false);
    expect($w.__els['#orderStep3'].accessibility.ariaCurrent).toBe(false);
  });

  // ── null safety ──────────────────────────────────────────────────────

  it('does not throw when $w returns null for all elements', async () => {
    const $w = vi.fn(() => null);
    await expect(initOrderTracker($w)).resolves.not.toThrow();
  });

  it('does not throw when estimatedDelivery is absent', async () => {
    const noEst = { ...BASE_ORDER, shipping: { ...BASE_ORDER.shipping, estimatedDelivery: null } };
    lookupOrder.mockResolvedValue(noEst);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await expect(handler()).resolves.not.toThrow();
  });

  it('does not throw when lineItems is empty', async () => {
    const noItems = { ...BASE_ORDER, lineItems: [] };
    lookupOrder.mockResolvedValue(noItems);
    const $w = makeWixEnv();
    await initOrderTracker($w);
    const handler = $w.__els['#orderLookupBtn'].onClick.mock.calls[0][0];
    await expect(handler()).resolves.not.toThrow();
  });
});
