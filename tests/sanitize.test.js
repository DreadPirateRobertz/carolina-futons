import { describe, it, expect } from 'vitest';
import { sanitize, validateEmail, validateId, validateSlug } from '../src/backend/utils/sanitize.js';

// ── sanitize ────────────────────────────────────────────────────────

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
    expect(sanitize('<p>Paragraph</p>')).toBe('Paragraph');
    expect(sanitize('<b>Bold</b> text')).toBe('Bold text');
  });

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  it('truncates to maxLen', () => {
    expect(sanitize('abcdefghij', 5)).toBe('abcde');
  });

  it('uses default maxLen of 1000', () => {
    const long = 'x'.repeat(2000);
    expect(sanitize(long).length).toBe(1000);
  });

  it('returns empty string for non-string input', () => {
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
    expect(sanitize(42)).toBe('');
    expect(sanitize({})).toBe('');
  });

  it('handles empty string', () => {
    expect(sanitize('')).toBe('');
  });

  it('handles nested HTML tags', () => {
    expect(sanitize('<div><span>text</span></div>')).toBe('text');
  });
});

// ── validateEmail ───────────────────────────────────────────────────

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('name@sub.domain.org')).toBe(true);
    expect(validateEmail('user+tag@gmail.com')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('not-an-email')).toBe(false);
    expect(validateEmail('@missing.com')).toBe(false);
    expect(validateEmail('missing@')).toBe(false);
    expect(validateEmail('has spaces@test.com')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
    expect(validateEmail(42)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('handles whitespace-padded emails', () => {
    expect(validateEmail(' user@example.com ')).toBe(true);
  });
});

// ── validateId ──────────────────────────────────────────────────────

describe('validateId', () => {
  it('accepts valid Wix-style IDs', () => {
    expect(validateId('abc-123')).toBe('abc-123');
    expect(validateId('item_456')).toBe('item_456');
    expect(validateId('ABC789')).toBe('ABC789');
  });

  it('rejects IDs with special characters', () => {
    expect(validateId('has spaces')).toBe('');
    expect(validateId('<script>')).toBe('');
    expect(validateId('id;DROP TABLE')).toBe('');
  });

  it('truncates to 50 characters', () => {
    const long = 'a'.repeat(100);
    expect(validateId(long).length).toBe(50);
  });

  it('returns empty string for non-string input', () => {
    expect(validateId(null)).toBe('');
    expect(validateId(undefined)).toBe('');
    expect(validateId(42)).toBe('');
  });

  it('trims whitespace before validating', () => {
    expect(validateId(' valid-id ')).toBe('valid-id');
  });
});

// ── validateSlug ────────────────────────────────────────────────────

describe('validateSlug', () => {
  it('accepts valid URL slugs', () => {
    expect(validateSlug('futon-frames')).toBe('futon-frames');
    expect(validateSlug('murphy-cabinet-beds')).toBe('murphy-cabinet-beds');
  });

  it('lowercases input', () => {
    expect(validateSlug('UPPER-CASE')).toBe('upper-case');
  });

  it('rejects slugs with invalid characters', () => {
    expect(validateSlug('has spaces')).toBe('');
    expect(validateSlug('special@chars')).toBe('');
    expect(validateSlug('under_scores')).toBe('');
  });

  it('truncates to 100 characters', () => {
    const long = 'a'.repeat(150);
    expect(validateSlug(long).length).toBe(100);
  });

  it('returns empty string for non-string input', () => {
    expect(validateSlug(null)).toBe('');
    expect(validateSlug(undefined)).toBe('');
  });
});
