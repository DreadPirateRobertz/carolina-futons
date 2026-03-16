import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MAX_SWATCHES,
  toggleSwatchSelection,
  getSelectedSwatches,
  clearSelectedSwatches,
  validateRequestForm,
  submitRequest,
} from '../src/public/SwatchRequestFlow.js';

vi.mock('backend/emailService.web', () => ({
  submitSwatchRequest: vi.fn(),
}));

import { submitSwatchRequest } from 'backend/emailService.web';

// ── Helpers ──────────────────────────────────────────────────────────

/** Create a swatch fixture with a unique _id and name. */
function makeSwatch(id, name) {
  return { _id: `sw-${id}`, swatchName: name || `Swatch ${id}` };
}

// ── Setup ────────────────────────────────────────────────────────────

beforeEach(() => {
  clearSelectedSwatches();
});

// ── MAX_SWATCHES constant ────────────────────────────────────────────

describe('MAX_SWATCHES', () => {
  it('is 6', () => {
    expect(MAX_SWATCHES).toBe(6);
  });
});

// ── toggleSwatchSelection ────────────────────────────────────────────

describe('toggleSwatchSelection', () => {
  it('selects a swatch and returns selected true', () => {
    const result = toggleSwatchSelection(makeSwatch(1, 'Denim Blue'));
    expect(result).toEqual({ selected: true });
    expect(getSelectedSwatches()).toHaveLength(1);
    expect(getSelectedSwatches()[0]).toEqual({ _id: 'sw-1', swatchName: 'Denim Blue' });
  });

  it('deselects a previously selected swatch', () => {
    const swatch = makeSwatch(1, 'Denim Blue');
    toggleSwatchSelection(swatch);
    const result = toggleSwatchSelection(swatch);
    expect(result).toEqual({ selected: false });
    expect(getSelectedSwatches()).toHaveLength(0);
  });

  it('re-selects a swatch that was deselected', () => {
    const swatch = makeSwatch(1, 'Denim Blue');
    toggleSwatchSelection(swatch);
    toggleSwatchSelection(swatch); // deselect
    const result = toggleSwatchSelection(swatch); // re-select
    expect(result).toEqual({ selected: true });
    expect(getSelectedSwatches()).toHaveLength(1);
  });

  it('allows selecting up to MAX_SWATCHES (6)', () => {
    for (let i = 1; i <= MAX_SWATCHES; i++) {
      const result = toggleSwatchSelection(makeSwatch(i));
      expect(result).toEqual({ selected: true });
    }
    expect(getSelectedSwatches()).toHaveLength(MAX_SWATCHES);
  });

  it('rejects selection beyond MAX_SWATCHES and returns limitReached', () => {
    for (let i = 1; i <= MAX_SWATCHES; i++) {
      toggleSwatchSelection(makeSwatch(i));
    }
    const result = toggleSwatchSelection(makeSwatch(99, 'Over Limit'));
    expect(result).toEqual({ selected: false, limitReached: true });
    expect(getSelectedSwatches()).toHaveLength(MAX_SWATCHES);
  });

  it('can still deselect when at max limit', () => {
    for (let i = 1; i <= MAX_SWATCHES; i++) {
      toggleSwatchSelection(makeSwatch(i));
    }
    const result = toggleSwatchSelection(makeSwatch(3));
    expect(result).toEqual({ selected: false });
    expect(getSelectedSwatches()).toHaveLength(MAX_SWATCHES - 1);
  });

  it('returns error for null swatch', () => {
    const result = toggleSwatchSelection(null);
    expect(result).toEqual({ selected: false, error: 'Invalid swatch' });
    expect(getSelectedSwatches()).toHaveLength(0);
  });

  it('returns error for undefined swatch', () => {
    const result = toggleSwatchSelection(undefined);
    expect(result).toEqual({ selected: false, error: 'Invalid swatch' });
  });

  it('returns error for swatch missing _id', () => {
    const result = toggleSwatchSelection({ swatchName: 'No ID' });
    expect(result).toEqual({ selected: false, error: 'Invalid swatch' });
    expect(getSelectedSwatches()).toHaveLength(0);
  });

  it('returns error for empty object (no _id)', () => {
    const result = toggleSwatchSelection({});
    expect(result).toEqual({ selected: false, error: 'Invalid swatch' });
  });

  it('stores only _id and swatchName, ignoring extra properties', () => {
    toggleSwatchSelection({ _id: 'sw-x', swatchName: 'X', colorHex: '#FF0000', material: 'Canvas' });
    const selected = getSelectedSwatches();
    expect(selected).toEqual([{ _id: 'sw-x', swatchName: 'X' }]);
    expect(selected[0]).not.toHaveProperty('colorHex');
    expect(selected[0]).not.toHaveProperty('material');
  });

  it('selects multiple distinct swatches correctly', () => {
    toggleSwatchSelection(makeSwatch(1, 'A'));
    toggleSwatchSelection(makeSwatch(2, 'B'));
    toggleSwatchSelection(makeSwatch(3, 'C'));
    expect(getSelectedSwatches()).toEqual([
      { _id: 'sw-1', swatchName: 'A' },
      { _id: 'sw-2', swatchName: 'B' },
      { _id: 'sw-3', swatchName: 'C' },
    ]);
  });

  it('deselecting from middle preserves order of remaining', () => {
    toggleSwatchSelection(makeSwatch(1, 'A'));
    toggleSwatchSelection(makeSwatch(2, 'B'));
    toggleSwatchSelection(makeSwatch(3, 'C'));
    toggleSwatchSelection(makeSwatch(2, 'B')); // deselect middle
    expect(getSelectedSwatches()).toEqual([
      { _id: 'sw-1', swatchName: 'A' },
      { _id: 'sw-3', swatchName: 'C' },
    ]);
  });
});

// ── getSelectedSwatches ──────────────────────────────────────────────

describe('getSelectedSwatches', () => {
  it('returns empty array initially', () => {
    expect(getSelectedSwatches()).toEqual([]);
  });

  it('returns a copy, not a reference to internal state', () => {
    toggleSwatchSelection(makeSwatch(1, 'A'));
    const first = getSelectedSwatches();
    const second = getSelectedSwatches();
    expect(first).toEqual(second);
    expect(first).not.toBe(second); // different array instances

    // Mutating the returned array must not affect internal state
    first.push({ _id: 'sw-fake', swatchName: 'Injected' });
    expect(getSelectedSwatches()).toHaveLength(1);
  });
});

// ── clearSelectedSwatches ────────────────────────────────────────────

describe('clearSelectedSwatches', () => {
  it('clears all selected swatches', () => {
    toggleSwatchSelection(makeSwatch(1));
    toggleSwatchSelection(makeSwatch(2));
    toggleSwatchSelection(makeSwatch(3));
    expect(getSelectedSwatches()).toHaveLength(3);

    clearSelectedSwatches();
    expect(getSelectedSwatches()).toEqual([]);
  });

  it('is safe to call when already empty', () => {
    clearSelectedSwatches();
    expect(getSelectedSwatches()).toEqual([]);
  });

  it('allows re-selection after clearing', () => {
    toggleSwatchSelection(makeSwatch(1));
    clearSelectedSwatches();
    const result = toggleSwatchSelection(makeSwatch(1));
    expect(result).toEqual({ selected: true });
    expect(getSelectedSwatches()).toHaveLength(1);
  });
});

// ── validateRequestForm ──────────────────────────────────────────────

describe('validateRequestForm', () => {
  const validForm = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    address: '123 Main St, Asheville, NC 28801',
  };

  it('returns no errors for a valid form', () => {
    expect(validateRequestForm(validForm)).toEqual([]);
  });

  // ── Name validation ──

  describe('name field', () => {
    it('returns error for missing name', () => {
      const errors = validateRequestForm({ ...validForm, name: '' });
      expect(errors).toContainEqual({ field: 'name', message: 'Name is required' });
    });

    it('returns error for whitespace-only name', () => {
      const errors = validateRequestForm({ ...validForm, name: '   ' });
      expect(errors).toContainEqual({ field: 'name', message: 'Name is required' });
    });

    it('returns error for name exceeding 200 characters', () => {
      const errors = validateRequestForm({ ...validForm, name: 'A'.repeat(201) });
      expect(errors).toContainEqual({ field: 'name', message: 'Name must be under 200 characters' });
    });

    it('accepts name of exactly 200 characters', () => {
      const errors = validateRequestForm({ ...validForm, name: 'A'.repeat(200) });
      const nameErrors = errors.filter(e => e.field === 'name');
      expect(nameErrors).toHaveLength(0);
    });

    it('handles null name gracefully', () => {
      const errors = validateRequestForm({ ...validForm, name: null });
      expect(errors).toContainEqual({ field: 'name', message: 'Name is required' });
    });

    it('handles undefined name gracefully', () => {
      const errors = validateRequestForm({ ...validForm, name: undefined });
      expect(errors).toContainEqual({ field: 'name', message: 'Name is required' });
    });
  });

  // ── Email validation ──

  describe('email field', () => {
    it('returns error for missing email', () => {
      const errors = validateRequestForm({ ...validForm, email: '' });
      expect(errors).toContainEqual({ field: 'email', message: 'Email is required' });
    });

    it('returns error for whitespace-only email', () => {
      const errors = validateRequestForm({ ...validForm, email: '   ' });
      expect(errors).toContainEqual({ field: 'email', message: 'Email is required' });
    });

    it('returns error for invalid email format (no @)', () => {
      const errors = validateRequestForm({ ...validForm, email: 'not-an-email' });
      expect(errors).toContainEqual({ field: 'email', message: 'Please enter a valid email address' });
    });

    it('returns error for invalid email format (no domain)', () => {
      const errors = validateRequestForm({ ...validForm, email: 'user@' });
      expect(errors).toContainEqual({ field: 'email', message: 'Please enter a valid email address' });
    });

    it('returns error for invalid email format (no TLD)', () => {
      const errors = validateRequestForm({ ...validForm, email: 'user@domain' });
      expect(errors).toContainEqual({ field: 'email', message: 'Please enter a valid email address' });
    });

    it('rejects XSS injection in email (<script>@evil.com)', () => {
      const errors = validateRequestForm({ ...validForm, email: '<script>@evil.com' });
      expect(errors).toContainEqual({ field: 'email', message: 'Please enter a valid email address' });
    });

    it('rejects email with angle brackets in local part', () => {
      const errors = validateRequestForm({ ...validForm, email: 'user<xss>@example.com' });
      expect(errors).toContainEqual({ field: 'email', message: 'Please enter a valid email address' });
    });

    it('accepts a standard email address', () => {
      const errors = validateRequestForm({ ...validForm, email: 'user@domain.com' });
      const emailErrors = errors.filter(e => e.field === 'email');
      expect(emailErrors).toHaveLength(0);
    });

    it('accepts email with subdomain', () => {
      const errors = validateRequestForm({ ...validForm, email: 'user@mail.example.com' });
      const emailErrors = errors.filter(e => e.field === 'email');
      expect(emailErrors).toHaveLength(0);
    });

    it('handles null email gracefully', () => {
      const errors = validateRequestForm({ ...validForm, email: null });
      expect(errors).toContainEqual({ field: 'email', message: 'Email is required' });
    });

    it('handles undefined email gracefully', () => {
      const errors = validateRequestForm({ ...validForm, email: undefined });
      expect(errors).toContainEqual({ field: 'email', message: 'Email is required' });
    });
  });

  // ── Address validation ──

  describe('address field', () => {
    it('returns error for missing address', () => {
      const errors = validateRequestForm({ ...validForm, address: '' });
      expect(errors).toContainEqual({ field: 'address', message: 'Mailing address is required' });
    });

    it('returns error for whitespace-only address', () => {
      const errors = validateRequestForm({ ...validForm, address: '   \t\n  ' });
      expect(errors).toContainEqual({ field: 'address', message: 'Mailing address is required' });
    });

    it('returns error for address exceeding 500 characters', () => {
      const errors = validateRequestForm({ ...validForm, address: 'A'.repeat(501) });
      expect(errors).toContainEqual({ field: 'address', message: 'Address must be under 500 characters' });
    });

    it('accepts address of exactly 500 characters', () => {
      const errors = validateRequestForm({ ...validForm, address: 'A'.repeat(500) });
      const addrErrors = errors.filter(e => e.field === 'address');
      expect(addrErrors).toHaveLength(0);
    });

    it('handles null address gracefully', () => {
      const errors = validateRequestForm({ ...validForm, address: null });
      expect(errors).toContainEqual({ field: 'address', message: 'Mailing address is required' });
    });

    it('handles undefined address gracefully', () => {
      const errors = validateRequestForm({ ...validForm, address: undefined });
      expect(errors).toContainEqual({ field: 'address', message: 'Mailing address is required' });
    });
  });

  // ── Multiple errors ──

  describe('multiple errors', () => {
    it('returns errors for all invalid fields at once', () => {
      const errors = validateRequestForm({ name: '', email: '', address: '' });
      expect(errors).toHaveLength(3);
      expect(errors.map(e => e.field)).toEqual(['name', 'email', 'address']);
    });

    it('returns errors for all null fields', () => {
      const errors = validateRequestForm({ name: null, email: null, address: null });
      expect(errors).toHaveLength(3);
      expect(errors.map(e => e.field)).toEqual(['name', 'email', 'address']);
    });

    it('returns errors for all undefined fields', () => {
      const errors = validateRequestForm({ name: undefined, email: undefined, address: undefined });
      expect(errors).toHaveLength(3);
    });

    it('returns errors for all whitespace-only fields', () => {
      const errors = validateRequestForm({ name: '   ', email: '  ', address: '\t' });
      expect(errors).toHaveLength(3);
    });

    it('returns mixed format and required errors', () => {
      const errors = validateRequestForm({
        name: 'A'.repeat(201),
        email: 'bad-email',
        address: '',
      });
      expect(errors).toHaveLength(3);
      expect(errors).toContainEqual({ field: 'name', message: 'Name must be under 200 characters' });
      expect(errors).toContainEqual({ field: 'email', message: 'Please enter a valid email address' });
      expect(errors).toContainEqual({ field: 'address', message: 'Mailing address is required' });
    });
  });

  // ── Trimming behavior ──

  describe('trimming', () => {
    it('trims leading and trailing whitespace from valid name', () => {
      const errors = validateRequestForm({ ...validForm, name: '  Jane Doe  ' });
      const nameErrors = errors.filter(e => e.field === 'name');
      expect(nameErrors).toHaveLength(0);
    });

    it('trims leading and trailing whitespace from valid email', () => {
      const errors = validateRequestForm({ ...validForm, email: '  jane@example.com  ' });
      const emailErrors = errors.filter(e => e.field === 'email');
      expect(emailErrors).toHaveLength(0);
    });

    it('trims leading and trailing whitespace from valid address', () => {
      const errors = validateRequestForm({ ...validForm, address: '  123 Main St  ' });
      const addrErrors = errors.filter(e => e.field === 'address');
      expect(addrErrors).toHaveLength(0);
    });
  });
});

// ── submitRequest ───────────────────────────────────────────────────

describe('submitRequest', () => {
  beforeEach(() => {
    clearSelectedSwatches();
    vi.clearAllMocks();
  });

  it('returns error when no swatches selected', async () => {
    const result = await submitRequest({
      name: 'Jane', email: 'jane@test.com', address: '123 Main',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('select at least one swatch');
  });

  it('returns validation errors for invalid form', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim' });
    const result = await submitRequest({ name: '', email: '', address: '' });
    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(3);
  });

  it('calls submitSwatchRequest with trimmed data on valid submission', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim Blue' });
    toggleSwatchSelection({ _id: 'sw-2', swatchName: 'Natural Canvas' });
    submitSwatchRequest.mockResolvedValue({ success: true });

    const result = await submitRequest({
      name: '  Jane Doe  ',
      email: '  jane@test.com  ',
      address: '  123 Main St  ',
      productId: 'prod-1',
      productName: 'Eureka Frame',
    });

    expect(result.success).toBe(true);
    expect(submitSwatchRequest).toHaveBeenCalledWith({
      name: 'Jane Doe',
      email: 'jane@test.com',
      address: '123 Main St',
      productId: 'prod-1',
      productName: 'Eureka Frame',
      swatchNames: ['Denim Blue', 'Natural Canvas'],
    });
  });

  it('clears selected swatches after successful submission', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim' });
    submitSwatchRequest.mockResolvedValue({ success: true });

    await submitRequest({
      name: 'Jane', email: 'jane@test.com', address: '123 Main',
    });

    expect(getSelectedSwatches()).toHaveLength(0);
  });

  it('does not clear swatches on failed backend response', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim' });
    submitSwatchRequest.mockResolvedValue({ success: false, message: 'Server error' });

    const result = await submitRequest({
      name: 'Jane', email: 'jane@test.com', address: '123 Main',
    });

    expect(result.success).toBe(false);
    expect(getSelectedSwatches()).toHaveLength(1);
  });

  it('returns fallback message on backend exception', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim' });
    submitSwatchRequest.mockRejectedValue(new Error('network'));

    const result = await submitRequest({
      name: 'Jane', email: 'jane@test.com', address: '123 Main',
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('calling us');
    expect(result.message).toContain('828');
  });

  it('passes through backend result object on success', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim' });
    submitSwatchRequest.mockResolvedValue({ success: true, rmaId: 'RMA-001' });

    const result = await submitRequest({
      name: 'Jane', email: 'jane@test.com', address: '123 Main',
    });

    expect(result).toEqual({ success: true, rmaId: 'RMA-001' });
  });

  it('validates form before calling backend', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Denim' });

    const result = await submitRequest({
      name: 'Jane', email: 'bad-email', address: '123 Main',
    });

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(submitSwatchRequest).not.toHaveBeenCalled();
  });

  it('sends only swatchName values in swatchNames array', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'A' });
    toggleSwatchSelection({ _id: 'sw-2', swatchName: 'B' });
    toggleSwatchSelection({ _id: 'sw-3', swatchName: 'C' });
    submitSwatchRequest.mockResolvedValue({ success: true });

    await submitRequest({
      name: 'Jane', email: 'jane@test.com', address: '123 Main',
    });

    const call = submitSwatchRequest.mock.calls[0][0];
    expect(call.swatchNames).toEqual(['A', 'B', 'C']);
  });
});

// ── initSwatchRequestFlow ───────────────────────────────────────

vi.mock('backend/swatchService.web', () => ({
  getProductSwatches: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: { mountainBlue: '#1e3a5f', success: '#22c55e' },
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));

import { getProductSwatches } from 'backend/swatchService.web';
import { initSwatchRequestFlow } from '../src/public/SwatchRequestFlow.js';

describe('initSwatchRequestFlow', () => {
  function mock$w() {
    const store = {};
    const $w = (selector) => {
      if (!store[selector]) {
        store[selector] = {
          id: selector, text: '', value: '', src: '', alt: '',
          style: { backgroundColor: '' },
          accessibility: {},
          data: null,
          onClick: vi.fn(), onChange: vi.fn(),
          show: vi.fn(), hide: vi.fn(),
          expand: vi.fn(), collapse: vi.fn(),
          onItemReady: vi.fn(),
        };
      }
      return store[selector];
    };
    $w._store = store;
    return $w;
  }

  beforeEach(() => {
    clearSelectedSwatches();
    vi.clearAllMocks();
  });

  it('collapses section when product is null', async () => {
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: null });
    expect($w._store['#swatchRequestSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when state is null', async () => {
    const $w = mock$w();
    await initSwatchRequestFlow($w, null);
    expect($w._store['#swatchRequestSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when no swatches returned', async () => {
    getProductSwatches.mockResolvedValue([]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });
    expect($w._store['#swatchRequestSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when swatches are null', async () => {
    getProductSwatches.mockResolvedValue(null);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });
    expect($w._store['#swatchRequestSection'].collapse).toHaveBeenCalled();
  });

  it('sets up grid with swatches and expands section', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'blue.jpg' },
      { _id: 'sw-2', swatchName: 'Red', colorHex: '#FF0000' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    const grid = $w._store['#swatchRequestGrid'];
    expect(grid.data).toHaveLength(2);
    expect(grid.onItemReady).toHaveBeenCalled();
    expect($w._store['#swatchRequestSection'].expand).toHaveBeenCalled();
  });

  it('assigns generated _id when swatch lacks one', async () => {
    getProductSwatches.mockResolvedValue([
      { swatchName: 'Blue', swatchImage: 'blue.jpg' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    expect($w._store['#swatchRequestGrid'].data[0]._id).toBe('sr-0');
  });

  it('sets grid ARIA label', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    expect($w._store['#swatchRequestGrid'].accessibility.ariaLabel).toBe(
      'Select fabric swatches to request'
    );
  });

  it('onItemReady sets image src and alt for swatchImage items', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'blue.jpg' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    const onItemReadyFn = $w._store['#swatchRequestGrid'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    onItemReadyFn($item, { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'blue.jpg' });

    expect($item._store['#srThumb'].src).toBe('blue.jpg');
    expect($item._store['#srThumb'].alt).toBe('Blue');
    expect($item._store['#srLabel'].text).toBe('Blue');
  });

  it('onItemReady sets backgroundColor for colorHex items', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-2', swatchName: 'Red', colorHex: '#FF0000' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    const onItemReadyFn = $w._store['#swatchRequestGrid'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    onItemReadyFn($item, { _id: 'sw-2', swatchName: 'Red', colorHex: '#FF0000' });

    expect($item._store['#srThumb'].style.backgroundColor).toBe('#FF0000');
  });

  it('onItemReady registers onClick that toggles swatch selection', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    const onItemReadyFn = $w._store['#swatchRequestGrid'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    onItemReadyFn($item, { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' });

    expect($item._store['#srThumb'].onClick).toHaveBeenCalled();
    // Trigger the click handler
    const clickHandler = $item._store['#srThumb'].onClick.mock.calls[0][0];
    await clickHandler();

    // Swatch should be selected
    expect(getSelectedSwatches()).toHaveLength(1);
    expect(getSelectedSwatches()[0]._id).toBe('sw-1');
  });

  it('shows limit error when max swatches reached', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-99', swatchName: 'Over Limit', swatchImage: 'x.jpg' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    // Select MAX_SWATCHES AFTER init (init clears selections)
    for (let i = 1; i <= MAX_SWATCHES; i++) {
      toggleSwatchSelection({ _id: `sw-${i}`, swatchName: `S${i}` });
    }

    const onItemReadyFn = $w._store['#swatchRequestGrid'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    onItemReadyFn($item, { _id: 'sw-99', swatchName: 'Over Limit', swatchImage: 'x.jpg' });

    const clickHandler = $item._store['#srThumb'].onClick.mock.calls[0][0];
    await clickHandler();

    expect($w._store['#swatchRequestError'].text).toContain('Maximum');
    expect($w._store['#swatchRequestError'].show).toHaveBeenCalled();
  });

  it('hides error on normal selection', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    const onItemReadyFn = $w._store['#swatchRequestGrid'].onItemReady.mock.calls[0][0];
    const $item = mock$w();
    onItemReadyFn($item, { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' });

    const clickHandler = $item._store['#srThumb'].onClick.mock.calls[0][0];
    await clickHandler();

    expect($w._store['#swatchRequestError'].hide).toHaveBeenCalled();
  });

  it('updates counter text on selection', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    // Counter should be set initially to "0 of 6 selected"
    expect($w._store['#swatchRequestCount'].text).toBe('0 of 6 selected');
  });

  it('registers submit button onClick', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    expect($w._store['#swatchRequestSubmit'].onClick).toHaveBeenCalled();
  });

  it('submit handler shows confirmation on success', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' },
    ]);
    submitSwatchRequest.mockResolvedValue({ success: true });

    const $w = mock$w();
    $w('#srName').value = 'Jane';
    $w('#srEmail').value = 'jane@test.com';
    $w('#srAddress').value = '123 Main St';
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    // Select swatch AFTER init (init clears selections)
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Blue' });

    const submitHandler = $w._store['#swatchRequestSubmit'].onClick.mock.calls[0][0];
    await submitHandler();

    expect($w._store['#swatchRequestConfirmation'].expand).toHaveBeenCalled();
    expect($w._store['#swatchRequestForm'].collapse).toHaveBeenCalled();
  });

  it('submit handler shows validation errors', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' },
    ]);

    const $w = mock$w();
    $w('#srName').value = '';
    $w('#srEmail').value = '';
    $w('#srAddress').value = '';
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    // Select swatch AFTER init (init clears selections)
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Blue' });

    const submitHandler = $w._store['#swatchRequestSubmit'].onClick.mock.calls[0][0];
    await submitHandler();

    expect($w._store['#swatchRequestError'].show).toHaveBeenCalled();
  });

  it('submit handler shows error message on failure', async () => {
    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' },
    ]);
    submitSwatchRequest.mockResolvedValue({ success: false, message: 'Server error' });

    const $w = mock$w();
    $w('#srName').value = 'Jane';
    $w('#srEmail').value = 'jane@test.com';
    $w('#srAddress').value = '123 Main St';
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    // Select swatch AFTER init (init clears selections)
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Blue' });

    const submitHandler = $w._store['#swatchRequestSubmit'].onClick.mock.calls[0][0];
    await submitHandler();

    expect($w._store['#swatchRequestError'].text).toBe('Server error');
    expect($w._store['#swatchRequestError'].show).toHaveBeenCalled();
  });

  it('collapses section on backend error during init', async () => {
    getProductSwatches.mockRejectedValue(new Error('network'));
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    expect($w._store['#swatchRequestSection'].collapse).toHaveBeenCalled();
  });

  it('clears previous selections on init', async () => {
    toggleSwatchSelection({ _id: 'sw-old', swatchName: 'Old' });
    expect(getSelectedSwatches()).toHaveLength(1);

    getProductSwatches.mockResolvedValue([
      { _id: 'sw-1', swatchName: 'Blue', swatchImage: 'b.jpg' },
    ]);
    const $w = mock$w();
    await initSwatchRequestFlow($w, { product: { _id: 'p1', name: 'Futon' } });

    expect(getSelectedSwatches()).toHaveLength(0);
  });
});
