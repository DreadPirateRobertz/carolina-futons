// fabricSwatchesPage.test.js — CF-ahzv: Fabric Swatch Request Page
// Tests for src/pages/Fabric Swatches.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as __resetLocation, __setQuery } from 'wix-location-frontend';

// ── $w mock ─────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement(id) {
  return {
    id,
    text: '',
    value: '',
    html: undefined,
    placeholder: '',
    collapsed: false,
    hidden: false,
    disabled: false,
    label: '',
    data: [],
    style: { backgroundColor: '', borderColor: '', borderWidth: '' },
    accessibility: { ariaLabel: '', ariaLive: '' },
    options: [],
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
    forEachItem: vi.fn(),
    refresh: vi.fn(() => Promise.resolve()),
    setFilter: vi.fn(() => Promise.resolve()),
    focus: vi.fn(),
  };
}

function getEl(sel) {
  const key = sel.replace('#', '');
  if (!elements.has(key)) elements.set(key, createMockElement(key));
  return elements.get(key);
}

// onReadyHandler is captured when the page module first executes.
// Do NOT reset it in beforeEach — the module registers it once at import time.
let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

globalThis.sessionStorage = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
})();

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('backend/swatchRequest.web', () => ({
  submitSwatchRequest: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  setupAccessibleDialog: vi.fn(() => ({
    open: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('public/sharedTokens', () => ({
  colors: {
    mountainBlue: '#5B8FA8',
    espresso: '#3A2518',
    sand: '#E8D5B7',
  },
}));

import { submitSwatchRequest } from 'backend/swatchRequest.web';
import { setupAccessibleDialog, announce } from 'public/a11yHelpers';

// ── Module under test ────────────────────────────────────────────────

// Import page module once — it has module-level state (_selections, _dialog).
// Reset selections via clearAll() in beforeEach; avoid vi.resetModules() so
// alias-based mocks (wix-location-frontend) share state with test helpers.
const mod = await import('../src/pages/Fabric Swatches.js');

beforeEach(async () => {
  elements.clear();
  // Do NOT null onReadyHandler — it's registered once at module load
  sessionStorage.clear();
  vi.clearAllMocks();

  __resetLocation();
  submitSwatchRequest.mockResolvedValue({ success: true, requestId: 'req-123' });
  setupAccessibleDialog.mockReturnValue({ open: vi.fn(), close: vi.fn() });

  // Reset page-level selection state
  mod.clearAll();
});

// ── Page init ────────────────────────────────────────────────────────

describe('page init', () => {
  it('registers $w.onReady handler', () => {
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('collapses tray section on load', async () => {
    await onReadyHandler();
    expect(getEl('#swatchTraySection').collapsed).toBe(true);
  });

  it('hides form overlay on load', async () => {
    await onReadyHandler();
    expect(getEl('#swatchFormOverlay').collapsed).toBe(true);
  });

  it('hides empty state on load', async () => {
    await onReadyHandler();
    expect(getEl('#swatchEmptyState').collapsed).toBe(true);
  });

  it('hides success state on load', async () => {
    await onReadyHandler();
    expect(getEl('#swatchFormSuccess').collapsed).toBe(true);
  });
});

// ── Filter / search ──────────────────────────────────────────────────

describe('filter controls', () => {
  it('registers onChange handlers on all filter dropdowns', async () => {
    await onReadyHandler();
    expect(getEl('#swatchColorFilter').onChange).toHaveBeenCalled();
    expect(getEl('#swatchMaterialFilter').onChange).toHaveBeenCalled();
    expect(getEl('#swatchBrandFilter').onChange).toHaveBeenCalled();
  });

  it('registers onInput handler on search input for debounced filtering', async () => {
    await onReadyHandler();
    expect(getEl('#swatchSearchInput').onInput).toHaveBeenCalled();
  });

  it('clears filters on clearFilters click', async () => {
    await onReadyHandler();
    const clearBtn = getEl('#swatchClearFilters');
    expect(clearBtn.onClick).toHaveBeenCalled();

    const handler = clearBtn.onClick.mock.calls[0][0];
    handler();

    expect(getEl('#swatchSearchInput').value).toBe('');
    expect(getEl('#swatchColorFilter').value).toBe('');
    expect(getEl('#swatchMaterialFilter').value).toBe('');
    expect(getEl('#swatchBrandFilter').value).toBe('');
  });

  it('sets ariaLive polite on result count element', async () => {
    await onReadyHandler();
    expect(getEl('#swatchResultCount').accessibility.ariaLive).toBe('polite');
  });
});

// ── Selection system ─────────────────────────────────────────────────

describe('selection system', () => {
  it('tray expands when first swatch selected', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#C8B89A' });
    expect(getEl('#swatchTraySection').collapsed).toBe(false);
  });

  it('tray collapses when all swatches removed', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#C8B89A' });
    mod.removeSwatch('sw-1');
    expect(getEl('#swatchTraySection').collapsed).toBe(true);
  });

  it('updates tray title with count', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#C8B89A' });
    mod.addSwatch({ _id: 'sw-2', name: 'Espresso', hexColor: '#3A2518' });
    expect(getEl('#swatchTrayTitle').text).toContain('2');
    expect(getEl('#swatchTrayTitle').text).toContain('5');
  });

  it('enforces max 5 selections — returns false', async () => {
    await onReadyHandler();
    for (let i = 1; i <= 5; i++) {
      mod.addSwatch({ _id: `sw-${i}`, name: `Swatch ${i}`, hexColor: '#aaa' });
    }
    const result = mod.addSwatch({ _id: 'sw-6', name: 'Swatch 6', hexColor: '#bbb' });
    expect(result).toBe(false);
    expect(mod.getSelections().length).toBe(5);
  });

  it('ignores duplicate add', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    expect(mod.getSelections().length).toBe(1);
  });

  it('clearAll empties selections', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    mod.addSwatch({ _id: 'sw-2', name: 'Brown', hexColor: '#bbb' });
    mod.clearAll();
    expect(mod.getSelections().length).toBe(0);
  });

  it('persists selection to sessionStorage', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    const stored = JSON.parse(sessionStorage.getItem('swatchSelections'));
    expect(stored).toContainEqual(expect.objectContaining({ _id: 'sw-1' }));
  });

  it('removes swatch from sessionStorage on removal', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    mod.removeSwatch('sw-1');
    const stored = JSON.parse(sessionStorage.getItem('swatchSelections'));
    expect(stored.length).toBe(0);
  });

  it('restores selections from sessionStorage on init', async () => {
    sessionStorage.setItem('swatchSelections', JSON.stringify([
      { _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' },
    ]));
    // Run onReady so the module re-reads sessionStorage
    await onReadyHandler();
    expect(mod.getSelections().length).toBe(1);
  });
});

// ── Max-5 UI enforcement in repeater ────────────────────────────────

describe('max-5 UI enforcement in onItemReady', () => {
  function makeSubItemMock() {
    const subEls = new Map();
    return {
      $item: (sel) => {
        const key = sel.replace('#', '');
        if (!subEls.has(key)) subEls.set(key, createMockElement(key));
        return subEls.get(key);
      },
      getSubEl: (sel) => {
        const key = sel.replace('#', '');
        return subEls.get(key) || createMockElement(key);
      },
    };
  }

  it('disables Add button for unselected in-stock items when at limit', async () => {
    await onReadyHandler();
    for (let i = 1; i <= 5; i++) {
      mod.addSwatch({ _id: `sw-${i}`, name: `Swatch ${i}`, hexColor: '#aaa' });
    }

    const onItemReadyHandler = getEl('#swatchGridRepeater').onItemReady.mock.calls[0][0];
    const { $item, getSubEl } = makeSubItemMock();

    onItemReadyHandler($item, { _id: 'sw-6', name: 'New Swatch', hexColor: '#bbb', inStock: true });

    expect(getSubEl('#swatchSelectBtn').disabled).toBe(true);
  });

  it('does NOT disable Add button for unselected in-stock items below limit', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Swatch 1', hexColor: '#aaa' });

    const onItemReadyHandler = getEl('#swatchGridRepeater').onItemReady.mock.calls[0][0];
    const { $item, getSubEl } = makeSubItemMock();

    onItemReadyHandler($item, { _id: 'sw-2', name: 'Other', hexColor: '#bbb', inStock: true });

    expect(getSubEl('#swatchSelectBtn').disabled).toBe(false);
  });

  it('always disables Add button for out-of-stock items', async () => {
    await onReadyHandler();

    const onItemReadyHandler = getEl('#swatchGridRepeater').onItemReady.mock.calls[0][0];
    const { $item, getSubEl } = makeSubItemMock();

    onItemReadyHandler($item, { _id: 'sw-oos', name: 'OOS Swatch', hexColor: '#ccc', inStock: false });

    expect(getSubEl('#swatchSelectBtn').disabled).toBe(true);
  });
});

// ── productSlug from URL ─────────────────────────────────────────────

describe('productSlug from URL', () => {
  it('passes productSlug to submitSwatchRequest when ?product= is set', async () => {
    __setQuery({ product: 'blue-ridge-futon' });
    await onReadyHandler();

    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    getEl('#swatchFirstName').value = 'Jane';
    getEl('#swatchLastName').value  = 'Doe';
    getEl('#swatchEmail').value     = 'jane@example.com';
    getEl('#swatchAddress1').value  = '123 Main St';
    getEl('#swatchCity').value      = 'Charlotte';
    getEl('#swatchState').value     = 'NC';
    getEl('#swatchZip').value       = '28201';

    await mod.submitForm();

    expect(submitSwatchRequest).toHaveBeenCalledWith(expect.objectContaining({
      productSlug: 'blue-ridge-futon',
    }));
  });

  it('omits productSlug when no query param', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    getEl('#swatchFirstName').value = 'Jane';
    getEl('#swatchLastName').value  = 'Doe';
    getEl('#swatchEmail').value     = 'jane@example.com';
    getEl('#swatchAddress1').value  = '123 Main St';
    getEl('#swatchCity').value      = 'Charlotte';
    getEl('#swatchState').value     = 'NC';
    getEl('#swatchZip').value       = '28201';

    await mod.submitForm();

    const call = submitSwatchRequest.mock.calls[0][0];
    expect(call.productSlug).toBeUndefined();
  });
});

// ── Form / submission ─────────────────────────────────────────────────

describe('form submission', () => {
  const validForm = {
    swatchFirstName: 'Jane',
    swatchLastName:  'Doe',
    swatchEmail:     'jane@example.com',
    swatchAddress1:  '123 Main St',
    swatchCity:      'Charlotte',
    swatchState:     'NC',
    swatchZip:       '28201',
  };

  function fillForm(overrides = {}) {
    const fields = { ...validForm, ...overrides };
    for (const [id, val] of Object.entries(fields)) {
      getEl(`#${id}`).value = val;
    }
  }

  it('shows form modal when openForm called', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    mod.openForm();
    expect(getEl('#swatchFormOverlay').collapsed).toBe(false);
  });

  it('calls submitSwatchRequest with correct payload', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    fillForm();
    await mod.submitForm();
    expect(submitSwatchRequest).toHaveBeenCalledWith(expect.objectContaining({
      swatchIds: ['sw-1'],
      contactInfo: expect.objectContaining({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        zip: '28201',
      }),
    }));
  });

  it('shows success state on successful submission', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    fillForm();
    await mod.submitForm();
    expect(getEl('#swatchFormSuccess').collapsed).toBe(false);
  });

  it('shows error message on failed submission', async () => {
    submitSwatchRequest.mockResolvedValueOnce({ success: false, error: 'Server error' });
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    fillForm();
    await mod.submitForm();
    expect(getEl('#swatchFormError').collapsed).toBe(false);
    expect(getEl('#swatchFormError').text).toContain('Server error');
  });

  it('shows validation error when required fields missing', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    fillForm({ swatchEmail: '' });
    await mod.submitForm();
    expect(submitSwatchRequest).not.toHaveBeenCalled();
    expect(getEl('#swatchFormError').collapsed).toBe(false);
  });

  it('validates ZIP format before submit', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    fillForm({ swatchZip: 'ABCDE' });
    await mod.submitForm();
    expect(submitSwatchRequest).not.toHaveBeenCalled();
    expect(getEl('#swatchFormError').text).toMatch(/zip/i);
  });

  it('clears selections after successful submission', async () => {
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    fillForm();
    await mod.submitForm();
    expect(mod.getSelections().length).toBe(0);
  });

  it('submit button shows Sending... during in-flight request', async () => {
    let resolveSubmit;
    submitSwatchRequest.mockImplementationOnce(
      () => new Promise(r => { resolveSubmit = r; })
    );
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    fillForm();
    const submitPromise = mod.submitForm();
    // Synchronously after call, button should be in Sending... state
    expect(getEl('#swatchSubmitBtn').label).toBe('Sending...');
    resolveSubmit({ success: true, requestId: 'req-1' });
    await submitPromise;
  });

  it('re-enables submit button after error', async () => {
    submitSwatchRequest.mockRejectedValueOnce(new Error('Network failure'));
    await onReadyHandler();
    mod.addSwatch({ _id: 'sw-1', name: 'Oatmeal', hexColor: '#aaa' });
    fillForm();
    await mod.submitForm();
    expect(getEl('#swatchSubmitBtn').label).toBe('Send My Swatches');
    expect(getEl('#swatchSubmitBtn').disabled).toBe(false);
  });
});

// ── SEO ──────────────────────────────────────────────────────────────

describe('SEO', () => {
  it('injects JSON-LD schema into swatchSchemaHtml', async () => {
    await onReadyHandler();
    const el = getEl('#swatchSchemaHtml');
    const content = el.html ?? el.value;
    expect(content).toBeTruthy();
    expect(content).toContain('application/ld+json');
    expect(content).toContain('Service');
  });
});
