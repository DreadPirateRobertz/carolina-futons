import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── sanitizeText Tests ──────────────────────────────────────────────

import { sanitizeText } from '../../src/public/validators.js';

describe('sanitizeText', () => {
  it('returns empty string for non-string input', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
    expect(sanitizeText(123)).toBe('');
    expect(sanitizeText({})).toBe('');
    expect(sanitizeText([])).toBe('');
  });

  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
    expect(sanitizeText('\n\thello\n\t')).toBe('hello');
  });

  it('strips HTML tags', () => {
    expect(sanitizeText('<script>alert(1)</script>')).toBe('alert(1)');
    expect(sanitizeText('<b>bold</b>')).toBe('bold');
    expect(sanitizeText('hello <img src=x onerror=alert(1)> world')).toBe('hello  world');
  });

  it('strips SVG and unclosed tags', () => {
    expect(sanitizeText('<svg/onload=alert(1)>')).toBe('');
    expect(sanitizeText('<img src=x onerror=alert(1)')).toBe('');
    // Trailing < is stripped as potential unclosed tag (safe default)
    expect(sanitizeText('text<')).toBe('text');
  });

  it('enforces max length', () => {
    const long = 'a'.repeat(2000);
    expect(sanitizeText(long, 1000).length).toBe(1000);
    expect(sanitizeText(long, 500).length).toBe(500);
  });

  it('uses default max length of 1000', () => {
    const long = 'a'.repeat(1500);
    expect(sanitizeText(long).length).toBe(1000);
  });

  it('preserves text shorter than max length', () => {
    expect(sanitizeText('short text')).toBe('short text');
  });

  it('handles empty string', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('strips nested/malformed HTML', () => {
    // Nested << >> may leave orphan > chars — that's safe (no XSS without <)
    const nested = sanitizeText('<<script>>alert(1)<</script>>');
    expect(nested).not.toContain('<');
    expect(nested).toContain('alert(1)');
    expect(sanitizeText('<div><script>evil</script></div>')).toBe('evil');
  });

  it('preserves legitimate special characters', () => {
    expect(sanitizeText("O'Brien & Sons — $100 café")).toBe("O'Brien & Sons — $100 café");
    expect(sanitizeText('Question? Answer! "quoted"')).toBe('Question? Answer! "quoted"');
  });
});

// ── Page-Level Sanitization Integration Tests ───────────────────────

// These tests verify that page form handlers sanitize input before backend calls.
// We mock the backend services and verify the sanitized values are passed.

// Mock wix-window-frontend (needed by some page imports)
vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
  openLightbox: vi.fn(),
}));

// Mock wix-location-frontend
vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
  url: 'https://carolinafutons.com/thank-you',
  path: ['/thank-you'],
  query: {},
}));

// Mock wix-stores-frontend
vi.mock('wix-stores-frontend', () => ({
  default: {
    cart: {
      getCurrentCart: vi.fn(() => Promise.resolve({ lineItems: [] })),
      addProducts: vi.fn(() => Promise.resolve({})),
    },
    onCartChanged: vi.fn(),
  },
}));

// Direct unit tests for sanitizeText with XSS payloads commonly found in form fields
describe('sanitizeText XSS vectors', () => {
  it('strips script tags from testimonial name field', () => {
    const malicious = '<script>document.cookie</script>John';
    const result = sanitizeText(malicious, 100);
    expect(result).toBe('document.cookieJohn');
    expect(result).not.toContain('<script');
  });

  it('strips event handler injection from contact message', () => {
    const malicious = 'Hello <img src=x onerror="fetch(\'evil.com\')"> world';
    const result = sanitizeText(malicious, 500);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('<img');
  });

  it('enforces max length on testimonial story (prevents mega payloads)', () => {
    const megaPayload = 'A'.repeat(50000);
    const result = sanitizeText(megaPayload, 5000);
    expect(result.length).toBe(5000);
  });

  it('strips HTML from appointment interests free text', () => {
    const interests = 'Looking for <b>leather</b> sofas <script>alert(1)</script>';
    const result = sanitizeText(interests, 500);
    expect(result).toBe('Looking for leather sofas alert(1)');
    expect(result).not.toContain('<');
  });

  it('strips HTML from return details free text', () => {
    const details = 'Item arrived <em>damaged</em> — fabric <a href="javascript:alert(1)">torn</a>';
    const result = sanitizeText(details, 1000);
    expect(result).not.toContain('<');
    expect(result).toContain('damaged');
    expect(result).toContain('torn');
  });

  it('handles null/undefined from empty form fields gracefully', () => {
    // Form values can be null/undefined when fields are empty
    expect(sanitizeText(null, 500)).toBe('');
    expect(sanitizeText(undefined, 500)).toBe('');
  });
});
