import { describe, it, expect } from 'vitest';

const {
  getDefaultPromos,
  isValidPromoItem,
  buildPromoBannerHtml,
  buildCarouselHtml,
  getAutoRotateMs,
} = await import('../src/public/promoBannerCarousel.js');

describe('promoBannerCarousel', () => {

  // ── getDefaultPromos ─────────────────────────────────────────────

  describe('getDefaultPromos', () => {
    it('returns 3 default promo items', () => {
      expect(getDefaultPromos()).toHaveLength(3);
    });

    it('includes free shipping, CF+, and spring collection', () => {
      const promos = getDefaultPromos();
      const ids = promos.map(p => p.id);
      expect(ids).toContain('promo-free-shipping');
      expect(ids).toContain('promo-cf-plus');
      expect(ids).toContain('promo-new-collection');
    });

    it('returns defensive copies', () => {
      const a = getDefaultPromos();
      const b = getDefaultPromos();
      expect(a).not.toBe(b);
      a[0].title = 'MUTATED';
      expect(getDefaultPromos()[0].title).toBe('Free Shipping');
    });

    it('every item has required fields', () => {
      for (const item of getDefaultPromos()) {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('subtitle');
        expect(item).toHaveProperty('ctaText');
        expect(item).toHaveProperty('ctaHref');
        expect(item).toHaveProperty('emoji');
        expect(item).toHaveProperty('accentColor');
      }
    });

    it('all ctaHref values start with /', () => {
      for (const item of getDefaultPromos()) {
        expect(item.ctaHref).toMatch(/^\//);
      }
    });
  });

  // ── isValidPromoItem ─────────────────────────────────────────────

  describe('isValidPromoItem', () => {
    const validItem = {
      id: 'test-1',
      title: 'Test',
      ctaText: 'Click',
      ctaHref: '/test',
    };

    it('returns true for valid item', () => {
      expect(isValidPromoItem(validItem)).toBe(true);
    });

    it('returns true for default promo items', () => {
      for (const item of getDefaultPromos()) {
        expect(isValidPromoItem(item)).toBe(true);
      }
    });

    it('returns false for null', () => {
      expect(isValidPromoItem(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isValidPromoItem(undefined)).toBe(false);
    });

    it('returns false for non-object', () => {
      expect(isValidPromoItem('string')).toBe(false);
      expect(isValidPromoItem(42)).toBe(false);
    });

    it('returns false for empty id', () => {
      expect(isValidPromoItem({ ...validItem, id: '' })).toBe(false);
    });

    it('returns false for empty title', () => {
      expect(isValidPromoItem({ ...validItem, title: '' })).toBe(false);
    });

    it('returns false for empty ctaText', () => {
      expect(isValidPromoItem({ ...validItem, ctaText: '' })).toBe(false);
    });

    it('returns false for empty ctaHref', () => {
      expect(isValidPromoItem({ ...validItem, ctaHref: '' })).toBe(false);
    });

    it('returns false for missing id', () => {
      const { id, ...rest } = validItem;
      expect(isValidPromoItem(rest)).toBe(false);
    });

    it('returns false for numeric id', () => {
      expect(isValidPromoItem({ ...validItem, id: 123 })).toBe(false);
    });
  });

  // ── buildPromoBannerHtml ─────────────────────────────────────────

  describe('buildPromoBannerHtml', () => {
    const item = getDefaultPromos()[0]; // Free Shipping

    it('returns empty string for invalid item', () => {
      expect(buildPromoBannerHtml(null)).toBe('');
      expect(buildPromoBannerHtml({})).toBe('');
    });

    it('builds HTML with title', () => {
      const html = buildPromoBannerHtml(item);
      expect(html).toContain('Free Shipping');
    });

    it('builds HTML with subtitle', () => {
      const html = buildPromoBannerHtml(item);
      expect(html).toContain('no code needed');
    });

    it('builds HTML with CTA text', () => {
      const html = buildPromoBannerHtml(item);
      expect(html).toContain('Shop Now');
    });

    it('builds HTML with CTA href', () => {
      const html = buildPromoBannerHtml(item);
      expect(html).toContain('/shop-main');
    });

    it('includes accent color for icon background', () => {
      const html = buildPromoBannerHtml(item);
      expect(html).toContain(item.accentColor);
    });

    it('includes emoji', () => {
      const html = buildPromoBannerHtml(item);
      expect(html).toContain('\u{1F69A}');
    });

    it('includes role="region" for accessibility', () => {
      const html = buildPromoBannerHtml(item);
      expect(html).toContain('role="region"');
    });

    it('includes aria-label with title', () => {
      const html = buildPromoBannerHtml(item);
      expect(html).toContain('aria-label="Free Shipping"');
    });

    it('marks emoji icon as aria-hidden', () => {
      const html = buildPromoBannerHtml(item);
      expect(html).toContain('aria-hidden="true"');
    });

    it('escapes HTML in title', () => {
      const malicious = { ...item, title: '<script>alert(1)</script>' };
      const html = buildPromoBannerHtml(malicious);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes HTML in subtitle', () => {
      const malicious = { ...item, subtitle: '<img src=x onerror=alert(1)>' };
      const html = buildPromoBannerHtml(malicious);
      expect(html).not.toContain('<img src');
    });

    it('escapes quotes in ctaHref to prevent attribute injection', () => {
      const malicious = { ...item, ctaHref: '" onclick="alert(1)' };
      const html = buildPromoBannerHtml(malicious);
      expect(html).toContain('&quot;');
      expect(html).not.toContain('href="" onclick=');
    });

    it('handles missing optional fields gracefully', () => {
      const minimal = { id: 'x', title: 'T', ctaText: 'C', ctaHref: '/p' };
      const html = buildPromoBannerHtml(minimal);
      expect(html).toContain('T');
      expect(html).toContain('C');
    });

    it('builds HTML for all 3 default promos', () => {
      for (const promo of getDefaultPromos()) {
        const html = buildPromoBannerHtml(promo);
        expect(html.length).toBeGreaterThan(100);
        expect(html).toContain(promo.title);
      }
    });
  });

  // ── buildCarouselHtml ────────────────────────────────────────────

  describe('buildCarouselHtml', () => {
    it('returns empty string for empty array', () => {
      expect(buildCarouselHtml([])).toBe('');
    });

    it('returns empty string for array of invalid items', () => {
      expect(buildCarouselHtml([null, {}, 'bad'])).toBe('');
    });

    it('uses default promos when called with no args', () => {
      const html = buildCarouselHtml();
      expect(html).toContain('Free Shipping');
      expect(html).toContain('CF+ Free');
      expect(html).toContain('Spring Collection');
    });

    it('uses default promos for non-array input', () => {
      const html = buildCarouselHtml(null);
      expect(html).toContain('Free Shipping');
    });

    it('includes carousel ARIA attributes', () => {
      const html = buildCarouselHtml();
      expect(html).toContain('aria-roledescription="carousel"');
      expect(html).toContain('aria-label="Promotional banners"');
    });

    it('includes dot indicators for multiple items', () => {
      const html = buildCarouselHtml();
      expect(html).toContain('promo-dot');
    });

    it('first slide is visible, others are hidden', () => {
      const html = buildCarouselHtml();
      expect(html).toContain('data-index="0" style="display:flex');
      expect(html).toContain('data-index="1" style="display:none');
    });

    it('includes auto-rotation script for multiple items', () => {
      const html = buildCarouselHtml();
      expect(html).toContain('<script>');
      expect(html).toContain('setInterval');
    });

    it('no dots or script for single item', () => {
      const single = [getDefaultPromos()[0]];
      const html = buildCarouselHtml(single);
      expect(html).not.toContain('promo-dot');
      expect(html).not.toContain('<script>');
    });

    it('respects custom rotateMs option', () => {
      const html = buildCarouselHtml(undefined, { rotateMs: 8000 });
      expect(html).toContain('8000');
    });

    it('clamps rotateMs to minimum 1000', () => {
      const html = buildCarouselHtml(undefined, { rotateMs: 100 });
      expect(html).toContain('1000');
      expect(html).not.toContain(',100)');
    });

    it('filters out invalid items from custom list', () => {
      const items = [
        getDefaultPromos()[0],
        null,
        { id: '', title: '', ctaText: '', ctaHref: '' },
      ];
      const html = buildCarouselHtml(items);
      expect(html).toContain('Free Shipping');
      // Only 1 valid item, so no dots
      expect(html).not.toContain('promo-dot');
    });

    it('handles custom items correctly', () => {
      const custom = [
        { id: 'a', title: 'Custom A', subtitle: 'Sub A', ctaText: 'Go A', ctaHref: '/a', emoji: '🎯', accentColor: '#FF0000' },
        { id: 'b', title: 'Custom B', subtitle: 'Sub B', ctaText: 'Go B', ctaHref: '/b', emoji: '🎯', accentColor: '#00FF00' },
      ];
      const html = buildCarouselHtml(custom);
      expect(html).toContain('Custom A');
      expect(html).toContain('Custom B');
      expect(html).toContain('promo-dot');
    });

    it('dot click handler pauses auto-rotation', () => {
      const html = buildCarouselHtml();
      expect(html).toContain('paused=true');
    });
  });

  // ── getAutoRotateMs ──────────────────────────────────────────────

  describe('getAutoRotateMs', () => {
    it('returns 5000', () => {
      expect(getAutoRotateMs()).toBe(5000);
    });

    it('returns a number', () => {
      expect(typeof getAutoRotateMs()).toBe('number');
    });
  });
});
