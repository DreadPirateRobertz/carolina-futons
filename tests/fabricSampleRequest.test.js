/**
 * fabricSampleRequest.test.js — CF-gkbx: Fabric Sample Request modal UI
 * Tests for src/public/FabricSampleRequest.js
 * TDD: written before implementation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w mock ──────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    data: [],
    collapsed: false,
    hidden: false,
    disabled: false,
    accessibility: { ariaLabel: '' },
    show: vi.fn(function () { this.hidden = false; return Promise.resolve(); }),
    hide: vi.fn(function () { this.hidden = true; return Promise.resolve(); }),
    collapse: vi.fn(function () { this.collapsed = true; return Promise.resolve(); }),
    expand: vi.fn(function () { this.collapsed = false; return Promise.resolve(); }),
    enable: vi.fn(function () { this.disabled = false; }),
    disable: vi.fn(function () { this.disabled = true; }),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onInput: vi.fn(),
    onItemReady: vi.fn(),
    focus: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

globalThis.$w = (sel) => getEl(sel);

// ── Backend mock (hoisted for per-test configuration) ─────────────────

const backendMocks = vi.hoisted(() => ({
  getAvailableSwatches: vi.fn(),
  submitFabricSample: vi.fn(),
}));

vi.mock('backend/fabricSampleService.web', () => ({
  getAvailableSwatches: backendMocks.getAvailableSwatches,
  submitFabricSample: backendMocks.submitFabricSample,
}));

import {
  initFabricSampleRequest,
  getSelectedSwatchCount,
  clearSwatchSelections,
  selectSwatch,
} from '../src/public/FabricSampleRequest.js';

// ── Fixtures ─────────────────────────────────────────────────────────

const mockSwatches = [
  { _id: 'sw-1', swatchName: 'Natural Oatmeal', colorFamily: 'Neutral' },
  { _id: 'sw-2', swatchName: 'Espresso Brown',  colorFamily: 'Brown'   },
  { _id: 'sw-3', swatchName: 'Slate Blue',       colorFamily: 'Blue'    },
  { _id: 'sw-4', swatchName: 'Forest Green',     colorFamily: 'Green'   },
];

async function setup(overrides = {}) {
  elements.clear();
  vi.clearAllMocks();
  clearSwatchSelections();

  backendMocks.getAvailableSwatches.mockResolvedValue({
    success: true,
    data: { swatches: mockSwatches },
    ...overrides.swatchResult,
  });

  backendMocks.submitFabricSample.mockResolvedValue(
    overrides.submitResult ?? { success: true, requestId: 'req-001' }
  );

  await initFabricSampleRequest($w, overrides.productId ?? 'prod-123');
}

// Fire the onClick handler registered on an element
function click(selector) {
  const el = getEl(selector);
  const handler = el.onClick.mock.calls.at(-1)?.[0];
  if (handler) return handler();
}

// ── initFabricSampleRequest ───────────────────────────────────────────

describe('initFabricSampleRequest', () => {
  it('calls getAvailableSwatches on init', async () => {
    await setup();
    expect(backendMocks.getAvailableSwatches).toHaveBeenCalledOnce();
  });

  it('sets data on #swatchSelectRepeater with available swatches', async () => {
    await setup();
    expect(getEl('#swatchSelectRepeater').data).toEqual(mockSwatches);
  });

  it('registers onClick on #swatchRequestBtn', async () => {
    await setup();
    expect(getEl('#swatchRequestBtn').onClick).toHaveBeenCalled();
  });

  it('collapses #swatchModal initially', async () => {
    await setup();
    expect(getEl('#swatchModal').collapsed).toBe(true);
  });
});

// ── Modal open/close ─────────────────────────────────────────────────

describe('modal open/close', () => {
  it('expands #swatchModal when #swatchRequestBtn is clicked', async () => {
    await setup();
    await click('#swatchRequestBtn');
    expect(getEl('#swatchModal').collapsed).toBe(false);
  });

  it('hides #swatchSuccess when modal opens', async () => {
    await setup();
    await click('#swatchRequestBtn');
    expect(getEl('#swatchSuccess').hide).toHaveBeenCalled();
  });

  it('hides #swatchError when modal opens', async () => {
    await setup();
    await click('#swatchRequestBtn');
    expect(getEl('#swatchError').hide).toHaveBeenCalled();
  });
});

// ── Swatch selection ─────────────────────────────────────────────────

describe('swatch selection', () => {
  it('getSelectedSwatchCount starts at 0', async () => {
    await setup();
    expect(getSelectedSwatchCount()).toBe(0);
  });

  it('selectSwatch adds a swatch and increments count', () => {
    clearSwatchSelections();
    expect(selectSwatch('sw-1')).toBe(true);
    expect(getSelectedSwatchCount()).toBe(1);
  });

  it('allows selecting up to 3 swatches', () => {
    clearSwatchSelections();
    selectSwatch('sw-1');
    selectSwatch('sw-2');
    selectSwatch('sw-3');
    expect(getSelectedSwatchCount()).toBe(3);
  });

  it('rejects a 4th swatch selection', () => {
    clearSwatchSelections();
    selectSwatch('sw-1');
    selectSwatch('sw-2');
    selectSwatch('sw-3');
    expect(selectSwatch('sw-4')).toBe(false);
    expect(getSelectedSwatchCount()).toBe(3);
  });

  it('returns false for duplicate swatch selection', () => {
    clearSwatchSelections();
    selectSwatch('sw-1');
    expect(selectSwatch('sw-1')).toBe(false);
    expect(getSelectedSwatchCount()).toBe(1);
  });
});

// ── Form submission — success ─────────────────────────────────────────

describe('form submission — success', () => {
  it('calls submitFabricSample with form values', async () => {
    await setup();
    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');

    expect(backendMocks.submitFabricSample).toHaveBeenCalledOnce();
    const [args] = backendMocks.submitFabricSample.mock.calls[0];
    expect(args.contactInfo.name).toBe('Jane Doe');
    expect(args.contactInfo.email).toBe('jane@example.com');
    expect(args.contactInfo.address).toBe('123 Main St');
  });

  it('shows #swatchSuccess on successful submission', async () => {
    await setup();
    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchSuccess').show).toHaveBeenCalled();
  });

  it('sets success message text', async () => {
    await setup();
    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchSuccess').text).toMatch(/on.*way|sent|request.*received/i);
  });

  it('clears form inputs after success', async () => {
    await setup();
    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchNameInput').value).toBe('');
    expect(getEl('#swatchEmailInput').value).toBe('');
    expect(getEl('#swatchAddressInput').value).toBe('');
  });

  it('passes productId to submitFabricSample', async () => {
    await setup({ productId: 'prod-abc' });
    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    const [args] = backendMocks.submitFabricSample.mock.calls[0];
    expect(args.productId).toBe('prod-abc');
  });
});

// ── Form submission — client-side validation ──────────────────────────

describe('form submission — client-side validation', () => {
  it('shows #swatchError when name is empty', async () => {
    await setup();
    getEl('#swatchNameInput').value = '';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchError').show).toHaveBeenCalled();
    expect(backendMocks.submitFabricSample).not.toHaveBeenCalled();
  });

  it('shows #swatchError when email is empty', async () => {
    await setup();
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = '';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchError').show).toHaveBeenCalled();
    expect(backendMocks.submitFabricSample).not.toHaveBeenCalled();
  });

  it('shows #swatchError when address is empty', async () => {
    await setup();
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchError').show).toHaveBeenCalled();
    expect(backendMocks.submitFabricSample).not.toHaveBeenCalled();
  });

  it('does not submit if no swatches selected (empty swatchIds)', async () => {
    await setup();
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';
    // No swatch selections made

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchError').show).toHaveBeenCalled();
    expect(backendMocks.submitFabricSample).not.toHaveBeenCalled();
  });
});

// ── Form submission — backend error ──────────────────────────────────

describe('form submission — backend error', () => {
  it('shows #swatchError when backend returns failure', async () => {
    await setup({ submitResult: { success: false, error: 'Already requested within 30 days.' } });
    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchError').show).toHaveBeenCalled();
  });

  it('displays backend error message in #swatchError', async () => {
    await setup({ submitResult: { success: false, error: 'Already requested within 30 days.' } });
    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchError').text).toMatch(/30 days/i);
  });

  it('re-enables #swatchSubmitBtn after backend error', async () => {
    await setup({ submitResult: { success: false, error: 'Rate limited.' } });
    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchSubmitBtn').enable).toHaveBeenCalled();
  });

  it('does not show success on backend error', async () => {
    await setup({ submitResult: { success: false, error: 'Rate limited.' } });
    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    await click('#swatchSubmitBtn');
    expect(getEl('#swatchSuccess').show).not.toHaveBeenCalled();
  });
});

// ── Submit button state ───────────────────────────────────────────────

describe('submit button state', () => {
  it('disables #swatchSubmitBtn while submitting', async () => {
    let resolveSubmit;
    backendMocks.submitFabricSample.mockReturnValue(
      new Promise(res => { resolveSubmit = res; })
    );

    // Re-init with the pending promise mock
    elements.clear();
    clearSwatchSelections();
    backendMocks.getAvailableSwatches.mockResolvedValue({ success: true, data: { swatches: mockSwatches } });
    await initFabricSampleRequest($w, 'prod-123');

    selectSwatch('sw-1');
    getEl('#swatchNameInput').value = 'Jane Doe';
    getEl('#swatchEmailInput').value = 'jane@example.com';
    getEl('#swatchAddressInput').value = '123 Main St';

    const clickPromise = click('#swatchSubmitBtn');
    expect(getEl('#swatchSubmitBtn').disable).toHaveBeenCalled();

    resolveSubmit({ success: true, requestId: 'req-001' });
    await clickPromise;
  });
});
