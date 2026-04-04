/**
 * warrantyRegistrationPage.test.js
 * CF-46ct — Warranty Registration page controller
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Global $w stub — must be hoisted so it exists when the page module is
//    evaluated (module-level $w.onReady call in Wix Velo page files). ─────────

const { $wStub } = vi.hoisted(() => {
  const stub = Object.assign(
    vi.fn(() => ({ value: '', text: '', onClick: vi.fn(), show: vi.fn(), hide: vi.fn(), expand: vi.fn(), collapse: vi.fn(), enable: vi.fn(), disable: vi.fn() })),
    { onReady: vi.fn() }
  );
  globalThis.$w = stub;
  return { $wStub: stub };
});

// ── Mock wix-location ────────────────────────────────────────────────────────

vi.mock('wix-location', () => ({ default: { query: {}, to: vi.fn() } }));

// ── Mock warrantyService ─────────────────────────────────────────────────────

vi.mock('backend/warrantyService.web', () => ({
  registerWarranty: vi.fn(),
}));

// ── Mock safeInit ────────────────────────────────────────────────────────────

vi.mock('public/safeInit', () => ({
  safeCall: vi.fn((fn) => { try { fn(); } catch {} }),
  safeCollapse: vi.fn(),
  safeExpand: vi.fn(),
  safeText: vi.fn(),
}));

import { initWarrantyRegistrationPage } from '../src/pages/Warranty Registration.js';
import { safeCollapse, safeExpand, safeText } from 'public/safeInit';
import { registerWarranty } from 'backend/warrantyService.web';
import wixLocation from 'wix-location';

const mockRegisterWarranty = vi.mocked(registerWarranty);
const mockWixLocation = /** @type {any} */ (wixLocation);

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeInput(value = '') {
  return { value, enable: vi.fn(), disable: vi.fn() };
}

function makeEl() {
  return {
    text: '',
    value: '',
    expand: vi.fn(),
    collapse: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
  };
}

function make$w(overrides = {}) {
  const els = {
    '#warrantyProductName': makeInput('Canby Futon Frame'),
    '#warrantyProductId': makeInput('prod-abc'),
    '#warrantyOrderId': makeInput('order-123'),
    '#warrantySerialNumber': makeInput('SN-9999'),
    '#warrantyPurchaseDate': { value: '2026-03-01' },
    '#warrantySubmitBtn': { ...makeEl(), onClick: vi.fn() },
    '#warrantySuccessMsg': makeEl(),
    '#warrantyErrorMsg': makeEl(),
    '#warrantyLoadingIndicator': makeEl(),
    '#warrantyRegistrationId': makeEl(),
    '#warrantyRegForm': makeEl(),
    ...overrides,
  };
  return vi.fn((id) => els[id] ?? makeEl());
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('initWarrantyRegistrationPage', () => {
  let $w;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWixLocation.query = {};
    $w = make$w();
    mockRegisterWarranty.mockResolvedValue({ success: true, registrationId: 'reg-001' });
  });

  it('collapses success and error messages on init', async () => {
    await initWarrantyRegistrationPage($w);
    expect(safeCollapse).toHaveBeenCalledWith($w, '#warrantySuccessMsg');
    expect(safeCollapse).toHaveBeenCalledWith($w, '#warrantyErrorMsg');
  });

  it('wires the submit button onClick', async () => {
    const btn = { ...makeEl(), onClick: vi.fn() };
    const $wWithBtn = make$w({ '#warrantySubmitBtn': btn });
    await initWarrantyRegistrationPage($wWithBtn);
    expect(btn.onClick).toHaveBeenCalled();
  });

  it('pre-fills product name from query param', async () => {
    mockWixLocation.query = { productName: 'Murphy Cabinet Bed' };
    const productNameEl = makeInput('');
    const $wWith = make$w({ '#warrantyProductName': productNameEl });
    await initWarrantyRegistrationPage($wWith);
    expect(productNameEl.value).toBe('Murphy Cabinet Bed');
  });

  it('pre-fills order ID from query param', async () => {
    mockWixLocation.query = { orderId: 'order-xyz' };
    const orderIdEl = makeInput('');
    const $wWith = make$w({ '#warrantyOrderId': orderIdEl });
    await initWarrantyRegistrationPage($wWith);
    expect(orderIdEl.value).toBe('order-xyz');
  });

  it('pre-fills product ID from query param', async () => {
    mockWixLocation.query = { productId: 'prod-789' };
    const productIdEl = makeInput('');
    const $wWith = make$w({ '#warrantyProductId': productIdEl });
    await initWarrantyRegistrationPage($wWith);
    expect(productIdEl.value).toBe('prod-789');
  });
});

describe('warranty form submission', () => {
  let $w;
  let submitHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWixLocation.query = {};
    mockRegisterWarranty.mockResolvedValue({ success: true, registrationId: 'reg-002' });

    const btn = { ...makeEl(), onClick: vi.fn((fn) => { submitHandler = fn; }) };
    $w = make$w({ '#warrantySubmitBtn': btn });
  });

  async function triggerSubmit() {
    await initWarrantyRegistrationPage($w);
    await submitHandler();
  }

  it('calls registerWarranty with form field values', async () => {
    await triggerSubmit();
    expect(mockRegisterWarranty).toHaveBeenCalledWith(expect.objectContaining({
      productName: 'Canby Futon Frame',
      productId: 'prod-abc',
      orderId: 'order-123',
      serialNumber: 'SN-9999',
    }));
  });

  it('shows success message on successful registration', async () => {
    await triggerSubmit();
    expect(safeExpand).toHaveBeenCalledWith($w, '#warrantySuccessMsg');
    expect(safeCollapse).toHaveBeenCalledWith($w, '#warrantyRegForm');
  });

  it('shows registration ID in success message', async () => {
    await triggerSubmit();
    expect(safeText).toHaveBeenCalledWith($w, '#warrantyRegistrationId', expect.stringContaining('reg-002'));
  });

  it('shows error message on registration failure', async () => {
    mockRegisterWarranty.mockResolvedValue({ success: false, error: 'Product not found' });
    await triggerSubmit();
    expect(safeExpand).toHaveBeenCalledWith($w, '#warrantyErrorMsg');
    expect(safeText).toHaveBeenCalledWith($w, '#warrantyErrorMsg', 'Product not found');
  });

  it('shows generic error on unexpected throw', async () => {
    mockRegisterWarranty.mockRejectedValue(new Error('Server error'));
    await triggerSubmit();
    expect(safeExpand).toHaveBeenCalledWith($w, '#warrantyErrorMsg');
  });

  it('shows validation error when product name is empty', async () => {
    const emptyNameEl = makeInput('  ');
    const btn = { ...makeEl(), onClick: vi.fn((fn) => { submitHandler = fn; }) };
    const $wNoName = make$w({ '#warrantyProductName': emptyNameEl, '#warrantySubmitBtn': btn });
    await initWarrantyRegistrationPage($wNoName);
    await submitHandler();
    expect(mockRegisterWarranty).not.toHaveBeenCalled();
    expect(safeExpand).toHaveBeenCalledWith($wNoName, '#warrantyErrorMsg');
  });
});
