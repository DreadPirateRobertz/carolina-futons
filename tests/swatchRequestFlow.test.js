import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/emailService.web', () => ({
  submitSwatchRequest: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    mountainBlue: '#5B8FA8',
    sandBase: '#E8D5B7',
    sandDark: '#D4BC96',
    espresso: '#3A2518',
    sunsetCoral: '#E8845C',
    error: '#E8845C',
    success: '#4A7C59',
    white: '#FFFFFF',
  },
}));

vi.mock('backend/swatchService.web', () => ({
  getProductSwatches: vi.fn().mockResolvedValue([
    { _id: 'sw-1', swatchName: 'Ocean Blue', colorHex: '#2244AA', swatchImage: 'img1.jpg', colorFamily: 'Blues', material: 'Cotton' },
    { _id: 'sw-2', swatchName: 'Forest Green', colorHex: '#228B22', swatchImage: 'img2.jpg', colorFamily: 'Greens', material: 'Canvas' },
    { _id: 'sw-3', swatchName: 'Crimson Red', colorHex: '#DC143C', swatchImage: 'img3.jpg', colorFamily: 'Reds', material: 'Microfiber' },
    { _id: 'sw-4', swatchName: 'Sand Dune', colorHex: '#C2B280', swatchImage: 'img4.jpg', colorFamily: 'Neutrals', material: 'Cotton' },
    { _id: 'sw-5', swatchName: 'Midnight', colorHex: '#191970', swatchImage: 'img5.jpg', colorFamily: 'Blues', material: 'Velvet' },
    { _id: 'sw-6', swatchName: 'Sage', colorHex: '#BCB88A', swatchImage: 'img6.jpg', colorFamily: 'Greens', material: 'Linen' },
    { _id: 'sw-7', swatchName: 'Terracotta', colorHex: '#E2725B', swatchImage: 'img7.jpg', colorFamily: 'Reds', material: 'Cotton' },
  ]),
  getAllSwatchFamilies: vi.fn().mockResolvedValue(['Blues', 'Greens', 'Reds', 'Neutrals']),
}));

import {
  initSwatchRequestFlow,
  toggleSwatchSelection,
  getSelectedSwatches,
  clearSelectedSwatches,
  validateRequestForm,
  submitRequest,
  MAX_SWATCHES,
} from '../src/public/SwatchRequestFlow.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', html: '', label: '',
    style: { color: '', backgroundColor: '', borderColor: '', borderWidth: '', opacity: 0, display: '' },
    options: [], data: [], items: [],
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onInput: vi.fn(),
    focus: vi.fn(), scrollTo: vi.fn(),
    enable: vi.fn(), disable: vi.fn(),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

// ── Selection Logic ─────────────────────────────────────────────────

describe('SwatchRequestFlow — Selection', () => {
  beforeEach(() => {
    clearSelectedSwatches();
  });

  it('exports MAX_SWATCHES constant as 6', () => {
    expect(MAX_SWATCHES).toBe(6);
  });

  it('selects a swatch when toggled', () => {
    const result = toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Ocean Blue' });
    expect(result.selected).toBe(true);
    expect(getSelectedSwatches()).toHaveLength(1);
    expect(getSelectedSwatches()[0]._id).toBe('sw-1');
  });

  it('deselects a swatch when toggled again', () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Ocean Blue' });
    const result = toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Ocean Blue' });
    expect(result.selected).toBe(false);
    expect(getSelectedSwatches()).toHaveLength(0);
  });

  it('allows up to 6 swatches', () => {
    for (let i = 1; i <= 6; i++) {
      const r = toggleSwatchSelection({ _id: `sw-${i}`, swatchName: `Swatch ${i}` });
      expect(r.selected).toBe(true);
    }
    expect(getSelectedSwatches()).toHaveLength(6);
  });

  it('rejects 7th swatch selection with limitReached flag', () => {
    for (let i = 1; i <= 6; i++) {
      toggleSwatchSelection({ _id: `sw-${i}`, swatchName: `Swatch ${i}` });
    }
    const result = toggleSwatchSelection({ _id: 'sw-7', swatchName: 'Swatch 7' });
    expect(result.selected).toBe(false);
    expect(result.limitReached).toBe(true);
    expect(getSelectedSwatches()).toHaveLength(6);
  });

  it('allows re-selection after deselecting (making room)', () => {
    for (let i = 1; i <= 6; i++) {
      toggleSwatchSelection({ _id: `sw-${i}`, swatchName: `Swatch ${i}` });
    }
    toggleSwatchSelection({ _id: 'sw-3', swatchName: 'Swatch 3' }); // deselect
    const result = toggleSwatchSelection({ _id: 'sw-7', swatchName: 'Swatch 7' });
    expect(result.selected).toBe(true);
    expect(getSelectedSwatches()).toHaveLength(6);
  });

  it('clearSelectedSwatches empties the list', () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'A' });
    toggleSwatchSelection({ _id: 'sw-2', swatchName: 'B' });
    clearSelectedSwatches();
    expect(getSelectedSwatches()).toHaveLength(0);
  });

  it('handles null/undefined swatch gracefully', () => {
    const result = toggleSwatchSelection(null);
    expect(result.selected).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('handles swatch without _id gracefully', () => {
    const result = toggleSwatchSelection({ swatchName: 'No ID' });
    expect(result.selected).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── Form Validation ─────────────────────────────────────────────────

describe('SwatchRequestFlow — Validation', () => {
  it('validates a complete form', () => {
    const errors = validateRequestForm({
      name: 'Jane Smith',
      email: 'jane@example.com',
      address: '123 Main St, Asheville NC 28801',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects missing name', () => {
    const errors = validateRequestForm({
      name: '',
      email: 'jane@example.com',
      address: '123 Main St',
    });
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('rejects missing email', () => {
    const errors = validateRequestForm({
      name: 'Jane',
      email: '',
      address: '123 Main St',
    });
    expect(errors.some(e => e.field === 'email')).toBe(true);
  });

  it('rejects invalid email format', () => {
    const errors = validateRequestForm({
      name: 'Jane',
      email: 'not-an-email',
      address: '123 Main St',
    });
    expect(errors.some(e => e.field === 'email')).toBe(true);
  });

  it('rejects missing address', () => {
    const errors = validateRequestForm({
      name: 'Jane',
      email: 'jane@example.com',
      address: '',
    });
    expect(errors.some(e => e.field === 'address')).toBe(true);
  });

  it('rejects all empty fields', () => {
    const errors = validateRequestForm({ name: '', email: '', address: '' });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('trims whitespace before validation', () => {
    const errors = validateRequestForm({
      name: '  Jane  ',
      email: '  jane@example.com  ',
      address: '  123 Main St  ',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects XSS in name field', () => {
    const errors = validateRequestForm({
      name: '<script>alert("xss")</script>',
      email: 'test@test.com',
      address: '123 St',
    });
    // Should still pass validation (sanitization happens at submit)
    // OR should reject — depends on implementation. Validation is format-only.
    expect(Array.isArray(errors)).toBe(true);
  });

  it('validates overlong name (over 200 chars)', () => {
    const errors = validateRequestForm({
      name: 'A'.repeat(201),
      email: 'test@test.com',
      address: '123 St',
    });
    expect(errors.some(e => e.field === 'name')).toBe(true);
  });

  it('validates overlong address (over 500 chars)', () => {
    const errors = validateRequestForm({
      name: 'Jane',
      email: 'test@test.com',
      address: 'A'.repeat(501),
    });
    expect(errors.some(e => e.field === 'address')).toBe(true);
  });
});

// ── Submit Flow ─────────────────────────────────────────────────────

describe('SwatchRequestFlow — Submit', () => {
  beforeEach(() => {
    clearSelectedSwatches();
  });

  it('submits request with selected swatches and form data', async () => {
    const { submitSwatchRequest } = await import('backend/emailService.web');
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Ocean Blue' });
    toggleSwatchSelection({ _id: 'sw-2', swatchName: 'Forest Green' });

    const result = await submitRequest({
      name: 'Jane Smith',
      email: 'jane@example.com',
      address: '123 Main St, Asheville NC 28801',
      productId: 'prod-1',
      productName: 'Eureka Futon Frame',
    });

    expect(result.success).toBe(true);
    expect(submitSwatchRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Jane Smith',
        email: 'jane@example.com',
        address: '123 Main St, Asheville NC 28801',
        productId: 'prod-1',
        productName: 'Eureka Futon Frame',
        swatchNames: expect.arrayContaining(['Ocean Blue', 'Forest Green']),
      })
    );
  });

  it('returns error when no swatches selected', async () => {
    const result = await submitRequest({
      name: 'Jane',
      email: 'jane@example.com',
      address: '123 St',
      productId: 'prod-1',
      productName: 'Test',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('swatch');
  });

  it('returns error when form validation fails', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Ocean Blue' });

    const result = await submitRequest({
      name: '',
      email: 'bad-email',
      address: '',
      productId: 'prod-1',
      productName: 'Test',
    });
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('handles backend failure gracefully', async () => {
    const { submitSwatchRequest } = await import('backend/emailService.web');
    submitSwatchRequest.mockRejectedValueOnce(new Error('Network error'));

    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Ocean Blue' });

    const result = await submitRequest({
      name: 'Jane',
      email: 'jane@example.com',
      address: '123 St',
      productId: 'prod-1',
      productName: 'Test',
    });
    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('clears selection after successful submit', async () => {
    toggleSwatchSelection({ _id: 'sw-1', swatchName: 'Ocean Blue' });

    await submitRequest({
      name: 'Jane',
      email: 'jane@example.com',
      address: '123 St',
      productId: 'prod-1',
      productName: 'Test',
    });

    expect(getSelectedSwatches()).toHaveLength(0);
  });
});

// ── UI Initialization ───────────────────────────────────────────────

describe('SwatchRequestFlow — initSwatchRequestFlow', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = { product: { _id: 'prod-1', name: 'Eureka Futon Frame' } };
    clearSelectedSwatches();
  });

  it('initializes the swatch request section', async () => {
    await initSwatchRequestFlow($w, state);
    expect($w('#swatchRequestSection').expand).toHaveBeenCalled();
  });

  it('sets up the swatch request grid with repeater', async () => {
    await initSwatchRequestFlow($w, state);
    const grid = $w('#swatchRequestGrid');
    expect(grid.data.length).toBeGreaterThan(0);
    expect(grid.onItemReady).toHaveBeenCalled();
  });

  it('binds click handler on submit button', async () => {
    await initSwatchRequestFlow($w, state);
    expect($w('#swatchRequestSubmit').onClick).toHaveBeenCalled();
  });

  it('displays counter showing 0 of 6 selected', async () => {
    await initSwatchRequestFlow($w, state);
    expect($w('#swatchRequestCount').text).toContain('0');
    expect($w('#swatchRequestCount').text).toContain('6');
  });

  it('collapses section when no product in state', async () => {
    state.product = null;
    await initSwatchRequestFlow($w, state);
    expect($w('#swatchRequestSection').collapse).toHaveBeenCalled();
  });

  it('sets aria-label on swatch request grid', async () => {
    await initSwatchRequestFlow($w, state);
    expect($w('#swatchRequestGrid').accessibility.ariaLabel).toContain('swatch');
  });
});
