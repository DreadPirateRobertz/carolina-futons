import { describe, it, expect, beforeEach, vi } from 'vitest';
import { validateEmail, validateDimension } from '../src/public/validators.js';
import { formatDescription } from '../src/public/galleryHelpers.js';
import { sanitize, validateId } from '../src/backend/utils/sanitize.js';

// ── validators.js — Client-Side Validation ─────────────────────────────

describe('validators.js', () => {
  describe('validateEmail', () => {
    it('accepts valid email', () => {
      expect(validateEmail('user@example.com')).toBe(true);
    });

    it('accepts email with subdomain', () => {
      expect(validateEmail('user@mail.example.com')).toBe(true);
    });

    it('rejects missing @', () => {
      expect(validateEmail('userexample.com')).toBe(false);
    });

    it('rejects missing domain', () => {
      expect(validateEmail('user@')).toBe(false);
    });

    it('rejects missing TLD', () => {
      expect(validateEmail('user@example')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(validateEmail('')).toBe(false);
    });

    it('rejects null', () => {
      expect(validateEmail(null)).toBe(false);
    });

    it('rejects undefined', () => {
      expect(validateEmail(undefined)).toBe(false);
    });

    it('rejects number', () => {
      expect(validateEmail(12345)).toBe(false);
    });

    it('rejects email with spaces', () => {
      expect(validateEmail('user @example.com')).toBe(false);
    });

    it('rejects email with angle brackets (XSS vector)', () => {
      expect(validateEmail('<script>@evil.com')).toBe(false);
    });

    it('trims whitespace before validation', () => {
      expect(validateEmail('  user@example.com  ')).toBe(true);
    });
  });

  describe('validateDimension', () => {
    it('accepts valid dimension', () => {
      expect(validateDimension(72)).toBe(true);
    });

    it('rejects zero', () => {
      expect(validateDimension(0)).toBe(false);
    });

    it('rejects negative', () => {
      expect(validateDimension(-10)).toBe(false);
    });

    it('rejects NaN', () => {
      expect(validateDimension(NaN)).toBe(false);
    });

    it('rejects Infinity', () => {
      expect(validateDimension(Infinity)).toBe(false);
    });

    it('rejects string', () => {
      expect(validateDimension('72')).toBe(false);
    });

    it('rejects value above max', () => {
      expect(validateDimension(601)).toBe(false);
    });

    it('accepts custom min/max', () => {
      expect(validateDimension(5, 1, 10)).toBe(true);
      expect(validateDimension(11, 1, 10)).toBe(false);
    });

    it('accepts boundary values', () => {
      expect(validateDimension(1)).toBe(true);
      expect(validateDimension(600)).toBe(true);
    });
  });
});

// ── sanitize.js — Backend Sanitization ──────────────────────────────────

describe('sanitize', () => {
  it('strips HTML tags but preserves text content between them', () => {
    // sanitize strips tags only, text content remains (safe for .text assignment)
    expect(sanitize('<script>alert(1)</script>hello')).toBe('alert(1)hello');
    expect(sanitize('<b>bold</b> text')).toBe('bold text');
  });

  it('strips nested HTML', () => {
    expect(sanitize('<div><p>text</p></div>')).toBe('text');
  });

  it('strips img onerror XSS vector', () => {
    expect(sanitize('<img onerror="alert(1)">text')).toBe('text');
  });

  it('handles non-string input', () => {
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
    expect(sanitize(123)).toBe('');
  });

  it('respects maxLen', () => {
    const long = 'a'.repeat(2000);
    expect(sanitize(long, 100).length).toBe(100);
  });

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  it('returns empty for empty string', () => {
    expect(sanitize('')).toBe('');
  });
});

describe('validateId', () => {
  it('accepts valid alphanumeric ID', () => {
    expect(validateId('abc-123_def')).toBe('abc-123_def');
  });

  it('rejects HTML in ID', () => {
    expect(validateId('<script>alert(1)</script>')).toBe('');
  });

  it('rejects spaces', () => {
    expect(validateId('abc def')).toBe('');
  });

  it('rejects special characters', () => {
    expect(validateId('abc;DROP TABLE')).toBe('');
  });

  it('truncates long IDs', () => {
    const long = 'a'.repeat(100);
    expect(validateId(long).length).toBe(50);
  });

  it('handles non-string input', () => {
    expect(validateId(null)).toBe('');
    expect(validateId(undefined)).toBe('');
    expect(validateId(123)).toBe('');
  });
});

// ── formatDescription — XSS via HTML stripping ─────────────────────────

describe('formatDescription XSS edge cases', () => {
  it('strips script tags', () => {
    const result = formatDescription('<script>alert("xss")</script>text');
    expect(result).not.toContain('<script>');
    expect(result).toContain('text');
  });

  it('strips event handler attributes', () => {
    const result = formatDescription('<img onerror="alert(1)">text');
    expect(result).not.toContain('onerror');
    expect(result).toContain('text');
  });

  it('strips nested malicious tags', () => {
    const result = formatDescription('<div onmouseover="steal()"><a href="javascript:void">click</a></div>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('click');
  });

  it('handles unclosed tags', () => {
    const result = formatDescription('<p>text<br');
    // After fix: unclosed tags like <br should be stripped
    expect(result).not.toContain('<');
    expect(result).toContain('text');
  });

  it('handles empty tags', () => {
    const result = formatDescription('<><>text');
    expect(result).toBe('text');
  });
});

// ── Compare URL ID Validation ───────────────────────────────────────────

describe('Compare URL product ID safety', () => {
  it('validateId rejects injection in product IDs', () => {
    // Product IDs passed in compare URLs should be safe
    expect(validateId('valid-product-123')).toBe('valid-product-123');
    expect(validateId('"><script>alert(1)</script>')).toBe('');
    expect(validateId("'; DROP TABLE products; --")).toBe('');
  });

  it('validateId handles comma-separated IDs individually', () => {
    // Compare URL uses IDs joined by commas — each should be validated
    const ids = 'prod-1,prod-2,<script>alert(1)</script>';
    const validated = ids.split(',').map(id => validateId(id.trim())).filter(Boolean);
    expect(validated).toEqual(['prod-1', 'prod-2']);
    expect(validated).not.toContain('');
  });
});

// ── LiveChat Input Validation ───────────────────────────────────────────

describe('LiveChat email validation strength', () => {
  it('basic includes("@") is insufficient — validateEmail is needed', () => {
    // The weak check `email.includes('@')` accepts these invalid emails:
    expect('@'.includes('@')).toBe(true); // No user or domain
    expect('user@'.includes('@')).toBe(true); // No domain
    expect('@domain'.includes('@')).toBe(true); // No user

    // But validateEmail correctly rejects them:
    expect(validateEmail('@')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('@domain')).toBe(false);
  });

  it('validateEmail rejects XSS in email field', () => {
    expect(validateEmail('<script>@evil.com</script>')).toBe(false);
    expect(validateEmail('"><img onerror=alert(1)>@x.com')).toBe(false);
  });
});

// ── Chat Message Sanitization ───────────────────────────────────────────

describe('Chat message content safety', () => {
  it('sanitize strips XSS from user messages before storage', () => {
    const malicious = '<script>document.cookie</script>How much is shipping?';
    const clean = sanitize(malicious);
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('How much is shipping?');
  });

  it('sanitize strips HTML from chat names', () => {
    const malicious = '<img onerror=alert(1)>John';
    const clean = sanitize(malicious);
    expect(clean).not.toContain('<img');
    expect(clean).toContain('John');
  });

  it('sanitize handles extremely long messages', () => {
    const spam = 'x'.repeat(10000);
    const clean = sanitize(spam, 500);
    expect(clean.length).toBe(500);
  });
});
