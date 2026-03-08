import { describe, it, expect, beforeEach } from 'vitest';
import {
  MAX_SWATCHES,
  toggleSwatchSelection,
  getSelectedSwatches,
  clearSelectedSwatches,
  validateRequestForm,
} from '../../src/public/SwatchRequestFlow.js';

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
