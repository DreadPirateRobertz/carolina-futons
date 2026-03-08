/**
 * Tests for validators.js — Frontend input validation utilities
 */
import { describe, it, expect } from 'vitest';
import { validateEmail, validateDimension, sanitizeText } from '../src/public/validators.js';

// ── validateEmail ─────────────────────────────────────────────────────

describe('validateEmail', () => {
  it('accepts valid email addresses', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('first.last@domain.co')).toBe(true);
    expect(validateEmail('user+tag@example.org')).toBe(true);
  });

  it('accepts email with leading/trailing whitespace (trimmed)', () => {
    expect(validateEmail('  user@example.com  ')).toBe(true);
  });

  it('rejects missing @ symbol', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('rejects missing domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('rejects missing local part', () => {
    expect(validateEmail('@example.com')).toBe(false);
  });

  it('rejects missing TLD', () => {
    expect(validateEmail('user@example')).toBe(false);
  });

  it('rejects email with spaces in body', () => {
    expect(validateEmail('user name@example.com')).toBe(false);
  });

  it('rejects angle brackets (XSS vector)', () => {
    expect(validateEmail('<script>@example.com')).toBe(false);
    expect(validateEmail('user@<script>.com')).toBe(false);
  });

  it('rejects domain starting with dot', () => {
    expect(validateEmail('user@.example.com')).toBe(false);
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

  it('rejects multiple @ symbols', () => {
    expect(validateEmail('user@@example.com')).toBe(false);
  });

  it('accepts email with leading dot in local part (RFC simplified)', () => {
    // Simplified RFC 5322 regex allows leading dots — acceptable for frontend validation
    expect(validateEmail('.user@example.com')).toBe(true);
  });
});

// ── validateDimension ─────────────────────────────────────────────────

describe('validateDimension', () => {
  it('accepts values within default range (1-600)', () => {
    expect(validateDimension(1)).toBe(true);
    expect(validateDimension(300)).toBe(true);
    expect(validateDimension(600)).toBe(true);
  });

  it('rejects values below minimum', () => {
    expect(validateDimension(0)).toBe(false);
    expect(validateDimension(-5)).toBe(false);
  });

  it('rejects values above maximum', () => {
    expect(validateDimension(601)).toBe(false);
    expect(validateDimension(9999)).toBe(false);
  });

  it('accepts custom min/max range', () => {
    expect(validateDimension(50, 10, 100)).toBe(true);
    expect(validateDimension(5, 10, 100)).toBe(false);
    expect(validateDimension(150, 10, 100)).toBe(false);
  });

  it('accepts boundary values with custom range', () => {
    expect(validateDimension(10, 10, 100)).toBe(true);
    expect(validateDimension(100, 10, 100)).toBe(true);
  });

  it('rejects NaN', () => {
    expect(validateDimension(NaN)).toBe(false);
  });

  it('rejects non-number types', () => {
    expect(validateDimension('50')).toBe(false);
    expect(validateDimension(null)).toBe(false);
    expect(validateDimension(undefined)).toBe(false);
  });

  it('rejects Infinity', () => {
    expect(validateDimension(Infinity)).toBe(false);
    expect(validateDimension(-Infinity)).toBe(false);
  });
});

// ── sanitizeText ──────────────────────────────────────────────────────

describe('sanitizeText', () => {
  it('passes through plain text unchanged', () => {
    expect(sanitizeText('Hello World')).toBe('Hello World');
  });

  it('strips complete HTML tags', () => {
    expect(sanitizeText('<b>bold</b>')).toBe('bold');
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it('strips unclosed/malformed tags', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)')).toBe('');
  });

  it('strips nested HTML', () => {
    expect(sanitizeText('<div><p>text</p></div>')).toBe('text');
  });

  it('enforces default max length of 1000', () => {
    const long = 'a'.repeat(1500);
    expect(sanitizeText(long).length).toBe(1000);
  });

  it('enforces custom max length', () => {
    expect(sanitizeText('abcdefghij', 5)).toBe('abcde');
  });

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(123)).toBe('');
    expect(sanitizeText({})).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('handles XSS vectors', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('');
    expect(sanitizeText('"><script>alert(1)</script>')).toBe('">alert(1)');
  });

  it('handles HTML entities (preserves them as text)', () => {
    expect(sanitizeText('&lt;b&gt;bold&lt;/b&gt;')).toBe('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('handles zero maxLen by returning empty string', () => {
    expect(sanitizeText('some text', 0)).toBe('');
  });

  it('strips entire string when it starts with unclosed tag (no closing bracket)', () => {
    // The entire input is treated as one malformed tag — all content is removed
    expect(sanitizeText('<img src=x onerror=alert(1) followed by text')).toBe('');
  });
});
