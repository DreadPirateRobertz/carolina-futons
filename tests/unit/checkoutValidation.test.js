import { describe, it, expect } from 'vitest';
import { validateField, validateAddressField, getFieldValidationState } from '../../src/public/checkoutValidation.js';
import { validateEmail, validateDimension, sanitizeText } from '../../src/public/validators.js';

// ── sanitizeText ──────────────────────────────────────────────────────────

describe('sanitizeText', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(42)).toBe('');
    expect(sanitizeText({})).toBe('');
  });

  it('strips HTML tags', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold');
    expect(sanitizeText('<script>alert(1)</script>')).toBe('alert(1)');
  });

  it('strips unclosed tags (XSS vector)', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)')).toBe('');
  });

  it('enforces max length', () => {
    const long = 'a'.repeat(2000);
    expect(sanitizeText(long, 100).length).toBe(100);
  });

  it('uses default max length of 1000', () => {
    const long = 'a'.repeat(1500);
    expect(sanitizeText(long).length).toBe(1000);
  });

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('passes through clean text unchanged', () => {
    expect(sanitizeText('Hello World')).toBe('Hello World');
  });

  it('handles nested tags', () => {
    expect(sanitizeText('<div><span>text</span></div>')).toBe('text');
  });

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('');
  });
});

// ── validateEmail ─────────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('user+tag@example.co.uk')).toBe(true);
    expect(validateEmail('first.last@domain.org')).toBe(true);
  });

  it('rejects missing @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('rejects missing TLD', () => {
    expect(validateEmail('user@domain')).toBe(false);
  });

  it('rejects spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
    expect(validateEmail('user@ example.com')).toBe(false);
  });

  it('rejects angle brackets (injection)', () => {
    expect(validateEmail('<script>@evil.com')).toBe(false);
    expect(validateEmail('user@evil.com>')).toBe(false);
  });

  it('trims leading/trailing whitespace before validation', () => {
    expect(validateEmail('  user@example.com  ')).toBe(true);
  });

  it('returns false for non-string input', () => {
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
    expect(validateEmail(123)).toBe(false);
    expect(validateEmail({})).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
});

// ── validateDimension ─────────────────────────────────────────────────────

describe('validateDimension', () => {
  it('accepts values within default range', () => {
    expect(validateDimension(1)).toBe(true);
    expect(validateDimension(100)).toBe(true);
    expect(validateDimension(600)).toBe(true);
  });

  it('rejects values below min', () => {
    expect(validateDimension(0)).toBe(false);
    expect(validateDimension(-1)).toBe(false);
  });

  it('rejects values above max', () => {
    expect(validateDimension(601)).toBe(false);
    expect(validateDimension(10000)).toBe(false);
  });

  it('accepts custom min/max', () => {
    expect(validateDimension(5, 5, 10)).toBe(true);
    expect(validateDimension(10, 5, 10)).toBe(true);
    expect(validateDimension(4, 5, 10)).toBe(false);
    expect(validateDimension(11, 5, 10)).toBe(false);
  });

  it('rejects NaN', () => {
    expect(validateDimension(NaN)).toBe(false);
  });

  it('rejects non-number types', () => {
    expect(validateDimension('50')).toBe(false);
    expect(validateDimension(null)).toBe(false);
    expect(validateDimension(undefined)).toBe(false);
  });

  it('accepts boundary values (inclusive)', () => {
    expect(validateDimension(1)).toBe(true);
    expect(validateDimension(600)).toBe(true);
  });
});

// ── validateField ─────────────────────────────────────────────────────────

describe('validateField', () => {
  it('passes with no rules', () => {
    const result = validateField('hello');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('hello');
  });

  it('fails required field when empty', () => {
    const result = validateField('', { required: true });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('fails required field when null', () => {
    const result = validateField(null, { required: true });
    expect(result.valid).toBe(false);
  });

  it('fails required field when undefined', () => {
    const result = validateField(undefined, { required: true });
    expect(result.valid).toBe(false);
  });

  it('passes optional empty field', () => {
    const result = validateField('', { required: false });
    expect(result.valid).toBe(true);
  });

  it('fails minLength check', () => {
    const result = validateField('a', { required: true, minLength: 3 });
    expect(result.valid).toBe(false);
  });

  it('passes minLength at boundary', () => {
    const result = validateField('abc', { required: true, minLength: 3 });
    expect(result.valid).toBe(true);
  });

  it('fails pattern check', () => {
    const result = validateField('ABC', { pattern: /^\d+$/ });
    expect(result.valid).toBe(false);
  });

  it('passes pattern check', () => {
    const result = validateField('123', { pattern: /^\d+$/ });
    expect(result.valid).toBe(true);
  });

  it('uses custom error message', () => {
    const result = validateField('', { required: true, errorMessage: 'Custom error' });
    expect(result.error).toBe('Custom error');
  });

  it('uses default error for required without custom message', () => {
    const result = validateField('', { required: true });
    expect(result.error).toBe('This field is required.');
  });

  it('sanitizes HTML from input', () => {
    const result = validateField('<b>name</b>', { required: true });
    expect(result.sanitized).toBe('name');
    expect(result.valid).toBe(true);
  });

  it('coerces numbers to string', () => {
    const result = validateField(12345, { required: true });
    expect(result.sanitized).toBe('12345');
    expect(result.valid).toBe(true);
  });

  it('trims whitespace before validation', () => {
    const result = validateField('  hi  ', { required: true, minLength: 2 });
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('hi');
  });

  it('whitespace-only fails required', () => {
    const result = validateField('   ', { required: true });
    expect(result.valid).toBe(false);
  });
});

// ── validateAddressField ──────────────────────────────────────────────────

describe('validateAddressField', () => {
  it('validates fullName — valid', () => {
    const result = validateAddressField('fullName', 'John Doe');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('John Doe');
  });

  it('validates fullName — too short', () => {
    const result = validateAddressField('fullName', 'J');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Full name');
  });

  it('validates fullName — empty', () => {
    const result = validateAddressField('fullName', '');
    expect(result.valid).toBe(false);
  });

  it('validates addressLine1 — valid', () => {
    const result = validateAddressField('addressLine1', '123 Main St');
    expect(result.valid).toBe(true);
  });

  it('validates addressLine1 — too short', () => {
    const result = validateAddressField('addressLine1', 'AB');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Street address');
  });

  it('validates city — valid', () => {
    const result = validateAddressField('city', 'Asheville');
    expect(result.valid).toBe(true);
  });

  it('validates city — empty', () => {
    const result = validateAddressField('city', '');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('City');
  });

  it('validates state — valid 2-letter code', () => {
    expect(validateAddressField('state', 'NC').valid).toBe(true);
    expect(validateAddressField('state', 'nc').valid).toBe(true);
  });

  it('validates state — rejects 3-letter', () => {
    expect(validateAddressField('state', 'NCC').valid).toBe(false);
  });

  it('validates state — rejects numbers', () => {
    expect(validateAddressField('state', '12').valid).toBe(false);
  });

  it('validates state — empty', () => {
    expect(validateAddressField('state', '').valid).toBe(false);
  });

  it('validates zip — 5-digit', () => {
    expect(validateAddressField('zip', '28792').valid).toBe(true);
  });

  it('validates zip — 5+4 format', () => {
    expect(validateAddressField('zip', '28792-1234').valid).toBe(true);
  });

  it('validates zip — rejects letters', () => {
    expect(validateAddressField('zip', 'ABCDE').valid).toBe(false);
  });

  it('validates zip — rejects too short', () => {
    expect(validateAddressField('zip', '2879').valid).toBe(false);
  });

  it('validates zip — rejects too long', () => {
    expect(validateAddressField('zip', '287921').valid).toBe(false);
  });

  it('passes through unknown field with sanitization', () => {
    const result = validateAddressField('unknownField', '<b>test</b>');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('test');
  });

  it('handles null value for unknown field', () => {
    const result = validateAddressField('unknownField', null);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('');
  });

  it('strips XSS from address fields', () => {
    const result = validateAddressField('fullName', '<script>alert(1)</script>John');
    expect(result.sanitized).not.toContain('<script>');
    expect(result.sanitized).toContain('John');
  });
});

// ── getFieldValidationState ───────────────────────────────────────────────

describe('getFieldValidationState', () => {
  it('returns idle when not touched', () => {
    expect(getFieldValidationState('abc', false, { valid: false })).toBe('idle');
  });

  it('returns idle when no validation result', () => {
    expect(getFieldValidationState('abc', true, null)).toBe('idle');
    expect(getFieldValidationState('abc', true, undefined)).toBe('idle');
  });

  it('returns valid when touched and valid', () => {
    expect(getFieldValidationState('abc', true, { valid: true })).toBe('valid');
  });

  it('returns error when touched and invalid', () => {
    expect(getFieldValidationState('abc', true, { valid: false })).toBe('error');
  });

  it('returns idle for empty untouched field', () => {
    expect(getFieldValidationState('', false, { valid: false })).toBe('idle');
  });
});
