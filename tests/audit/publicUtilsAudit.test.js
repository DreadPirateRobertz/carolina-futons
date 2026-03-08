import { describe, it, expect, beforeEach } from 'vitest';
import {
  addToCompare,
  getCompareList,
  formatDescription,
} from '../../src/public/galleryHelpers.js';
import {
  cacheProduct,
  getCachedProduct,
} from '../../src/public/productCache.js';
import {
  trackEvent,
  flushEvents,
} from '../../src/public/engagementTracker.js';
import {
  validateEmail,
  validateDimension,
} from '../../src/public/validators.js';

// ═══════════════════════════════════════════════════════════════════
// 1. XSS: Compare URL — product IDs must be encoded
// ═══════════════════════════════════════════════════════════════════

describe('galleryHelpers: compare list input validation', () => {
  it('rejects product with _id containing special characters', () => {
    const malicious = {
      _id: '<script>alert(1)</script>',
      name: 'Evil Product',
      slug: 'evil',
      formattedPrice: '$0',
      mainMedia: '',
    };
    const added = addToCompare(malicious);
    // Should reject IDs with special characters
    expect(added).toBe(false);
  });

  it('accepts product with valid alphanumeric _id', () => {
    const good = {
      _id: 'prod-abc-123',
      name: 'Good Product',
      slug: 'good',
      formattedPrice: '$100',
      mainMedia: '',
    };
    const added = addToCompare(good);
    expect(added).toBe(true);
    expect(getCompareList()).toHaveLength(1);
  });

  it('rejects product with null _id', () => {
    expect(addToCompare({ _id: null, name: 'Bad' })).toBe(false);
  });

  it('rejects product with _id containing URL-breaking chars', () => {
    expect(addToCompare({ _id: 'id&param=evil', name: 'Hack' })).toBe(false);
    expect(addToCompare({ _id: 'id?q=evil', name: 'Hack' })).toBe(false);
    expect(addToCompare({ _id: 'id/../../etc', name: 'Hack' })).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. XSS: formatDescription — handles malicious HTML
// ═══════════════════════════════════════════════════════════════════

describe('galleryHelpers: formatDescription XSS', () => {
  it('strips script tags', () => {
    const result = formatDescription('<script>alert("XSS")</script>Hello');
    expect(result).not.toContain('<script>');
    expect(result).toContain('Hello');
  });

  it('strips event handler attributes', () => {
    const result = formatDescription('<img onerror="alert(1)" src=x>Content');
    expect(result).not.toContain('onerror');
    expect(result).toContain('Content');
  });

  it('handles nested tags', () => {
    const result = formatDescription('<div><b>Bold</b> text</div>');
    expect(result).toBe('Bold text');
  });

  it('handles null/undefined input', () => {
    expect(formatDescription(null)).toBe('');
    expect(formatDescription(undefined)).toBe('');
    expect(formatDescription('')).toBe('');
  });

  it('truncates long text and adds ellipsis', () => {
    const long = 'A'.repeat(300);
    const result = formatDescription(long, 200);
    expect(result.length).toBeLessThanOrEqual(204); // 200 + '...'
    expect(result).toContain('...');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Input validation: productCache slug validation
// ═══════════════════════════════════════════════════════════════════

describe('productCache: slug validation', () => {
  it('caches product with valid slug', () => {
    cacheProduct({ _id: 'p1', slug: 'futon-frame-oak', name: 'Futon', price: 500 });
    const cached = getCachedProduct('futon-frame-oak');
    expect(cached).not.toBeNull();
    expect(cached.name).toBe('Futon');
  });

  it('rejects product with empty slug', () => {
    cacheProduct({ _id: 'p1', slug: '', name: 'Futon', price: 500 });
    expect(getCachedProduct('')).toBeNull();
  });

  it('rejects product with slug containing special characters', () => {
    cacheProduct({ _id: 'p1', slug: '../../../etc/passwd', name: 'Evil', price: 0 });
    expect(getCachedProduct('../../../etc/passwd')).toBeNull();
  });

  it('rejects product with slug starting with hyphen', () => {
    cacheProduct({ _id: 'p2', slug: '-invalid-start', name: 'Bad', price: 100 });
    expect(getCachedProduct('-invalid-start')).toBeNull();
  });

  it('rejects product with uppercase slug', () => {
    cacheProduct({ _id: 'p3', slug: 'Invalid-Slug', name: 'Bad', price: 100 });
    expect(getCachedProduct('Invalid-Slug')).toBeNull();
  });

  it('rejects null/undefined product', () => {
    cacheProduct(null);
    cacheProduct(undefined);
    cacheProduct({ _id: 'p4' }); // no slug
    // Should not throw
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Input validation: engagementTracker event type validation
// ═══════════════════════════════════════════════════════════════════

describe('engagementTracker: event type validation', () => {
  beforeEach(() => {
    // Clear event queue by flushing
    flushEvents();
  });

  it('accepts known event types', () => {
    // Should not throw
    expect(() => trackEvent('product_view', { productId: 'p1' })).not.toThrow();
    expect(() => trackEvent('add_to_cart', { productId: 'p1' })).not.toThrow();
  });

  it('rejects event type with special characters', () => {
    // Should silently ignore or sanitize
    trackEvent('<script>alert(1)</script>', { bad: true });
    // The event type should be sanitized or rejected
    // Verify by flushing — no crash
    expect(() => flushEvents()).not.toThrow();
  });

  it('rejects empty event type', () => {
    expect(() => trackEvent('', {})).not.toThrow();
    expect(() => trackEvent(null, {})).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. validators.js edge cases
// ═══════════════════════════════════════════════════════════════════

describe('validators: validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true);
    expect(validateEmail('name.last@domain.co.uk')).toBe(true);
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('notanemail')).toBe(false);
    expect(validateEmail('@domain.com')).toBe(false);
    expect(validateEmail('user@')).toBe(false);
    expect(validateEmail('user@domain')).toBe(false);
  });

  it('rejects emails with XSS vectors', () => {
    expect(validateEmail('<script>@evil.com')).toBe(false);
    expect(validateEmail('user@<script>.com')).toBe(false);
    expect(validateEmail('"><img src=x onerror=alert(1)>@evil.com')).toBe(false);
  });

  it('rejects non-string inputs', () => {
    expect(validateEmail(null)).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
    expect(validateEmail(123)).toBe(false);
    expect(validateEmail({})).toBe(false);
  });

  it('trims whitespace', () => {
    expect(validateEmail('  user@example.com  ')).toBe(true);
  });
});

describe('validators: validateDimension', () => {
  it('accepts valid dimensions', () => {
    expect(validateDimension(1)).toBe(true);
    expect(validateDimension(72)).toBe(true);
    expect(validateDimension(600)).toBe(true);
  });

  it('rejects out-of-range values', () => {
    expect(validateDimension(0)).toBe(false);
    expect(validateDimension(-1)).toBe(false);
    expect(validateDimension(601)).toBe(false);
  });

  it('rejects non-numeric inputs', () => {
    expect(validateDimension(NaN)).toBe(false);
    expect(validateDimension(Infinity)).toBe(false);
    expect(validateDimension('72')).toBe(false);
    expect(validateDimension(null)).toBe(false);
  });

  it('respects custom min/max bounds', () => {
    expect(validateDimension(5, 1, 10)).toBe(true);
    expect(validateDimension(11, 1, 10)).toBe(false);
    expect(validateDimension(0, 1, 10)).toBe(false);
  });
});
