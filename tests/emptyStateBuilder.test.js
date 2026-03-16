import { describe, it, expect } from 'vitest';

const {
  getEmptyStateKeys,
  isValidEmptyState,
  buildEmptyStateHtml,
  getEmptyStateIllustrationUri,
} = await import('../src/public/emptyStateBuilder.js');

describe('emptyStateBuilder', () => {

  // ── getEmptyStateKeys ────────────────────────────────────────────

  describe('getEmptyStateKeys', () => {
    it('returns exactly 4 keys', () => {
      expect(getEmptyStateKeys()).toHaveLength(4);
    });

    it('includes cart, wishlist, search, error', () => {
      const keys = getEmptyStateKeys();
      expect(keys).toContain('cart');
      expect(keys).toContain('wishlist');
      expect(keys).toContain('search');
      expect(keys).toContain('error');
    });
  });

  // ── isValidEmptyState ────────────────────────────────────────────

  describe('isValidEmptyState', () => {
    it('returns true for valid keys', () => {
      expect(isValidEmptyState('cart')).toBe(true);
      expect(isValidEmptyState('wishlist')).toBe(true);
      expect(isValidEmptyState('search')).toBe(true);
      expect(isValidEmptyState('error')).toBe(true);
    });

    it('returns false for unknown key', () => {
      expect(isValidEmptyState('promo')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isValidEmptyState(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValidEmptyState(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidEmptyState('')).toBe(false);
    });
  });

  // ── buildEmptyStateHtml ──────────────────────────────────────────

  describe('buildEmptyStateHtml', () => {
    it('returns null for invalid key', () => {
      expect(buildEmptyStateHtml('nonexistent')).toBeNull();
    });

    it('returns null for null key', () => {
      expect(buildEmptyStateHtml(null)).toBeNull();
    });

    it('builds cart empty state with default content', () => {
      const html = buildEmptyStateHtml('cart');
      expect(html).toContain('mountain trail at dawn');
      expect(html).toContain('Start Shopping');
      expect(html).toContain('/shop-main');
      expect(html).toContain('<svg');
    });

    it('builds wishlist empty state', () => {
      const html = buildEmptyStateHtml('wishlist');
      expect(html).toContain('mountain collection');
      expect(html).toContain('Explore Products');
    });

    it('builds search empty state', () => {
      const html = buildEmptyStateHtml('search');
      expect(html).toContain('every peak and valley');
      expect(html).toContain('Browse All Products');
    });

    it('builds error empty state', () => {
      const html = buildEmptyStateHtml('error');
      expect(html).toContain('trail washed out');
      expect(html).toContain('Go Home');
      expect(html).toContain('href="/');
    });

    it('overrides heading', () => {
      const html = buildEmptyStateHtml('cart', { heading: 'Custom Title' });
      expect(html).toContain('Custom Title');
      expect(html).not.toContain('mountain trail at dawn');
    });

    it('overrides subtext', () => {
      const html = buildEmptyStateHtml('cart', { subtext: 'Custom message here' });
      expect(html).toContain('Custom message here');
    });

    it('overrides CTA label', () => {
      const html = buildEmptyStateHtml('cart', { ctaLabel: 'Go Shopping' });
      expect(html).toContain('Go Shopping');
    });

    it('overrides CTA href', () => {
      const html = buildEmptyStateHtml('cart', { ctaHref: '/custom-path' });
      expect(html).toContain('/custom-path');
    });

    it('includes role="status" for accessibility', () => {
      const html = buildEmptyStateHtml('cart');
      expect(html).toContain('role="status"');
    });

    it('includes aria-label', () => {
      const html = buildEmptyStateHtml('cart');
      expect(html).toContain('aria-label=');
    });

    it('marks illustration as aria-hidden', () => {
      const html = buildEmptyStateHtml('cart');
      expect(html).toContain('aria-hidden="true"');
    });

    it('escapes HTML in heading', () => {
      const html = buildEmptyStateHtml('cart', { heading: '<script>alert("xss")</script>' });
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes HTML in subtext', () => {
      const html = buildEmptyStateHtml('cart', { subtext: '<img src=x onerror=alert(1)>' });
      expect(html).not.toContain('<img src');
      expect(html).toContain('&lt;img');
    });

    it('escapes quotes in CTA href to prevent attribute injection', () => {
      const html = buildEmptyStateHtml('cart', { ctaHref: '" onclick="alert(1)' });
      // Double quotes are escaped, preventing breakout from href attribute
      expect(html).toContain('&quot;');
      expect(html).not.toContain('href="" onclick=');
    });

    it('uses custom illustration dimensions', () => {
      const html = buildEmptyStateHtml('cart', {
        illustrationWidth: 400,
        illustrationHeight: 300,
      });
      expect(html).toContain('max-width:400px');
    });

    it('uses brand colors', () => {
      const html = buildEmptyStateHtml('cart');
      expect(html).toContain('#3A2518'); // espresso heading
      expect(html).toContain('#1a5276'); // CTA background
      expect(html).toContain('#FAF7F2'); // offWhite container
    });

    it('contains SVG mountain illustration', () => {
      const html = buildEmptyStateHtml('cart');
      expect(html).toContain('<svg');
      expect(html).toContain('</svg>');
    });
  });

  // ── getEmptyStateIllustrationUri ─────────────────────────────────

  describe('getEmptyStateIllustrationUri', () => {
    it('returns data URI for valid key', () => {
      const uri = getEmptyStateIllustrationUri('cart');
      expect(uri).toMatch(/^data:image\/svg\+xml,/);
    });

    it('returns empty string for invalid key', () => {
      expect(getEmptyStateIllustrationUri('unknown')).toBe('');
    });

    it('returns empty string for null', () => {
      expect(getEmptyStateIllustrationUri(null)).toBe('');
    });

    it('URI contains encoded SVG content', () => {
      const uri = getEmptyStateIllustrationUri('search');
      expect(uri.length).toBeGreaterThan(100);
      expect(uri).toContain('%3Csvg');
    });

    it('respects custom dimensions', () => {
      const small = getEmptyStateIllustrationUri('cart', { width: 100, height: 80 });
      const large = getEmptyStateIllustrationUri('cart', { width: 400, height: 300 });
      // Different dims produce different URIs
      expect(small).not.toBe(large);
    });

    it('works for all 4 keys', () => {
      for (const key of getEmptyStateKeys()) {
        const uri = getEmptyStateIllustrationUri(key);
        expect(uri).toMatch(/^data:image\/svg\+xml,/);
      }
    });
  });
});
