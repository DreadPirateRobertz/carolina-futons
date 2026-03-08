import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── XML Escaping Tests ──────────────────────────────────────────────

describe('XML escaping for sitemap', () => {
  function escapeXml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  it('escapes ampersands', () => {
    expect(escapeXml('foo&bar')).toBe('foo&amp;bar');
  });

  it('escapes angle brackets', () => {
    expect(escapeXml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes quotes', () => {
    expect(escapeXml('He said "hello"')).toBe('He said &quot;hello&quot;');
  });

  it('handles clean strings unchanged', () => {
    expect(escapeXml('carolina-futon-classic')).toBe('carolina-futon-classic');
  });

  it('handles empty string', () => {
    expect(escapeXml('')).toBe('');
  });

  it('handles non-string input', () => {
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
    expect(escapeXml(123)).toBe('');
  });

  it('escapes multiple special chars in same string', () => {
    expect(escapeXml('a&b<c>d"e')).toBe('a&amp;b&lt;c&gt;d&quot;e');
  });
});

// ── Cron Auth Validation Tests ──────────────────────────────────────

describe('Cron endpoint auth validation', () => {
  function isValidCronAuth(requestKey, cronKey) {
    if (typeof requestKey !== 'string' || !requestKey) return false;
    if (!cronKey) return false;
    return requestKey === cronKey;
  }

  it('rejects when requestKey is undefined', () => {
    expect(isValidCronAuth(undefined, 'secret123')).toBe(false);
  });

  it('rejects when requestKey is null', () => {
    expect(isValidCronAuth(null, 'secret123')).toBe(false);
  });

  it('rejects when requestKey is empty string', () => {
    expect(isValidCronAuth('', 'secret123')).toBe(false);
  });

  it('rejects when cronKey is null (secret not set)', () => {
    expect(isValidCronAuth('somekey', null)).toBe(false);
  });

  it('rejects when cronKey is empty string', () => {
    expect(isValidCronAuth('somekey', '')).toBe(false);
  });

  it('rejects when both are undefined (potential bypass)', () => {
    expect(isValidCronAuth(undefined, undefined)).toBe(false);
  });

  it('rejects wrong key', () => {
    expect(isValidCronAuth('wrong', 'secret123')).toBe(false);
  });

  it('accepts matching keys', () => {
    expect(isValidCronAuth('secret123', 'secret123')).toBe(true);
  });

  it('rejects when requestKey is array (query param manipulation)', () => {
    expect(isValidCronAuth(['key1', 'key2'], 'key1')).toBe(false);
  });

  it('rejects when requestKey is number', () => {
    expect(isValidCronAuth(123, '123')).toBe(false);
  });
});

// ── seoHelpers JSON-LD Safety Tests ─────────────────────────────────

describe('JSON-LD product data safety', () => {
  function sanitizeForJsonLd(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
  }

  it('escapes HTML tags in product names', () => {
    const result = sanitizeForJsonLd('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('\\u003c');
  });

  it('leaves clean product names unchanged', () => {
    expect(sanitizeForJsonLd('Carolina Classic Futon Frame')).toBe('Carolina Classic Futon Frame');
  });

  it('handles empty string', () => {
    expect(sanitizeForJsonLd('')).toBe('');
  });

  it('handles null/undefined', () => {
    expect(sanitizeForJsonLd(null)).toBe('');
    expect(sanitizeForJsonLd(undefined)).toBe('');
  });

  it('escapes ampersands in descriptions', () => {
    const result = sanitizeForJsonLd('Solid & sturdy construction');
    expect(result).toContain('\\u0026');
  });
});

// ── stripHtml robustness Tests ──────────────────────────────────────

describe('stripHtml robustness', () => {
  function stripHtml(html) {
    if (typeof html !== 'string') return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  it('strips basic HTML tags', () => {
    expect(stripHtml('<p>Hello</p>')).toBe('Hello');
  });

  it('strips nested tags', () => {
    expect(stripHtml('<div><p><strong>Bold</strong> text</p></div>')).toBe('Bold text');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });

  it('handles non-string input', () => {
    expect(stripHtml(null)).toBe('');
    expect(stripHtml(undefined)).toBe('');
    expect(stripHtml(123)).toBe('');
  });

  it('handles string with no HTML', () => {
    expect(stripHtml('Plain text')).toBe('Plain text');
  });

  it('strips self-closing tags', () => {
    expect(stripHtml('Hello<br/>World')).toBe('HelloWorld');
  });

  it('handles malformed tags', () => {
    expect(stripHtml('Hello<b>World')).toBe('HelloWorld');
  });
});

// ── Input Sanitization Consistency Tests ────────────────────────────

describe('Input sanitization patterns', () => {
  // These test the patterns that should be used consistently

  it('sanitize rejects HTML in strings', () => {
    const dirty = '<script>alert("xss")</script>';
    const clean = dirty.replace(/<[^>]*>/g, '').trim();
    expect(clean).toBe('alert("xss")');
    expect(clean).not.toContain('<');
  });

  it('sanitize handles null input gracefully', () => {
    const sanitize = (v) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim() : '';
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
  });

  it('validateId rejects non-string IDs', () => {
    const validateId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
    expect(validateId(null)).toBe(false);
    expect(validateId(123)).toBe(false);
    expect(validateId('')).toBe(false);
    expect(validateId('valid-id-123')).toBe(true);
  });

  it('validateId rejects injection attempts', () => {
    const validateId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id);
    expect(validateId("'; DROP TABLE users;--")).toBe(false);
    expect(validateId('<script>')).toBe(false);
    expect(validateId('../../../etc/passwd')).toBe(false);
  });
});

// ── Rate Limiting Pattern Tests ─────────────────────────────────────

describe('Rate limiting patterns', () => {
  it('time-based rate limiter blocks within window', () => {
    const submissions = new Map();
    const RATE_LIMIT_MS = 60_000;

    function isRateLimited(email) {
      const lastSubmit = submissions.get(email);
      if (lastSubmit && (Date.now() - lastSubmit) < RATE_LIMIT_MS) return true;
      submissions.set(email, Date.now());
      return false;
    }

    expect(isRateLimited('user@example.com')).toBe(false); // first request
    expect(isRateLimited('user@example.com')).toBe(true);  // within window
    expect(isRateLimited('other@example.com')).toBe(false); // different email
  });
});

// ── Returns Service Item Validation Tests ───────────────────────────

describe('Returns service item validation', () => {
  function validateReturnItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (typeof item.lineItemId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.lineItemId)) return false;
    if (typeof item.quantity !== 'number' || item.quantity < 1 || !Number.isInteger(item.quantity)) return false;
    return true;
  }

  it('accepts valid return item', () => {
    expect(validateReturnItem({ lineItemId: 'item-123', quantity: 2 })).toBe(true);
  });

  it('rejects null item', () => {
    expect(validateReturnItem(null)).toBe(false);
  });

  it('rejects item with missing lineItemId', () => {
    expect(validateReturnItem({ quantity: 1 })).toBe(false);
  });

  it('rejects item with non-string lineItemId', () => {
    expect(validateReturnItem({ lineItemId: 123, quantity: 1 })).toBe(false);
  });

  it('rejects item with injection in lineItemId', () => {
    expect(validateReturnItem({ lineItemId: "'; DROP TABLE;--", quantity: 1 })).toBe(false);
  });

  it('rejects item with zero quantity', () => {
    expect(validateReturnItem({ lineItemId: 'item-1', quantity: 0 })).toBe(false);
  });

  it('rejects item with negative quantity', () => {
    expect(validateReturnItem({ lineItemId: 'item-1', quantity: -1 })).toBe(false);
  });

  it('rejects item with fractional quantity', () => {
    expect(validateReturnItem({ lineItemId: 'item-1', quantity: 1.5 })).toBe(false);
  });
});
