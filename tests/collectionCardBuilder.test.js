import { describe, it, expect } from 'vitest';

const {
  getCollections,
  getFeaturedCollections,
  getCollectionBySlug,
  isValidCollection,
  buildCollectionCardHtml,
  buildCollectionGridHtml,
} = await import('../src/public/collectionCardBuilder.js');

describe('collectionCardBuilder', () => {

  // ── getCollections ───────────────────────────────────────────────

  describe('getCollections', () => {
    it('returns 6 collections', () => {
      expect(getCollections()).toHaveLength(6);
    });

    it('returns defensive copies', () => {
      const a = getCollections();
      const b = getCollections();
      expect(a).not.toBe(b);
      a[0].title = 'MUTATED';
      expect(getCollections()[0].title).toBe('Mountain Lodge Living');
    });

    it('deep copies heroImage', () => {
      const a = getCollections();
      a[0].heroImage.uri = 'MUTATED';
      expect(getCollections()[0].heroImage.uri).toContain('placeholder');
    });

    it('deep copies mood array', () => {
      const a = getCollections();
      a[0].mood.push('MUTATED');
      expect(getCollections()[0].mood).not.toContain('MUTATED');
    });

    it('deep copies productIds array', () => {
      const a = getCollections();
      a[0].productIds.push('FAKE');
      expect(getCollections()[0].productIds).not.toContain('FAKE');
    });

    it('every collection has required fields', () => {
      for (const c of getCollections()) {
        expect(c.id).toBeTruthy();
        expect(c.slug).toBeTruthy();
        expect(c.title).toBeTruthy();
        expect(c.heroImage).toBeTruthy();
        expect(c.heroImage.uri).toBeTruthy();
        expect(Array.isArray(c.mood)).toBe(true);
        expect(Array.isArray(c.productIds)).toBe(true);
      }
    });
  });

  // ── getFeaturedCollections ────────────────────────────────────────

  describe('getFeaturedCollections', () => {
    it('returns only featured collections', () => {
      const featured = getFeaturedCollections();
      expect(featured.length).toBeGreaterThan(0);
      expect(featured.length).toBeLessThan(getCollections().length);
      for (const c of featured) {
        expect(c.featured).toBe(true);
      }
    });

    it('includes Mountain Lodge and Guest Room', () => {
      const titles = getFeaturedCollections().map(c => c.title);
      expect(titles).toContain('Mountain Lodge Living');
      expect(titles).toContain('Guest Room Ready');
    });
  });

  // ── getCollectionBySlug ──────────────────────────────────────────

  describe('getCollectionBySlug', () => {
    it('finds collection by slug', () => {
      const c = getCollectionBySlug('mountain-lodge-living');
      expect(c).not.toBeNull();
      expect(c.title).toBe('Mountain Lodge Living');
    });

    it('returns null for unknown slug', () => {
      expect(getCollectionBySlug('nonexistent')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(getCollectionBySlug('')).toBeNull();
    });

    it('returns null for null', () => {
      expect(getCollectionBySlug(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(getCollectionBySlug(undefined)).toBeNull();
    });

    it('returns null for numeric input', () => {
      expect(getCollectionBySlug(42)).toBeNull();
    });

    it('returns a defensive copy', () => {
      const a = getCollectionBySlug('modern-minimalist');
      a.title = 'MUTATED';
      expect(getCollectionBySlug('modern-minimalist').title).toBe('Modern Minimalist');
    });
  });

  // ── isValidCollection ────────────────────────────────────────────

  describe('isValidCollection', () => {
    const valid = getCollections()[0];

    it('returns true for valid collection', () => {
      expect(isValidCollection(valid)).toBe(true);
    });

    it('returns true for all default collections', () => {
      for (const c of getCollections()) {
        expect(isValidCollection(c)).toBe(true);
      }
    });

    it('returns false for null', () => {
      expect(isValidCollection(null)).toBe(false);
    });

    it('returns false for missing id', () => {
      expect(isValidCollection({ ...valid, id: '' })).toBe(false);
    });

    it('returns false for missing slug', () => {
      expect(isValidCollection({ ...valid, slug: '' })).toBe(false);
    });

    it('returns false for missing title', () => {
      expect(isValidCollection({ ...valid, title: '' })).toBe(false);
    });

    it('returns false for missing heroImage', () => {
      expect(isValidCollection({ ...valid, heroImage: null })).toBe(false);
    });

    it('returns false for empty heroImage uri', () => {
      expect(isValidCollection({ ...valid, heroImage: { uri: '', alt: '' } })).toBe(false);
    });

    it('returns false for non-array mood', () => {
      expect(isValidCollection({ ...valid, mood: 'cozy' })).toBe(false);
    });

    it('returns false for non-array productIds', () => {
      expect(isValidCollection({ ...valid, productIds: 'id' })).toBe(false);
    });
  });

  // ── buildCollectionCardHtml ──────────────────────────────────────

  describe('buildCollectionCardHtml', () => {
    const collection = getCollections()[0]; // Mountain Lodge

    it('returns empty string for invalid collection', () => {
      expect(buildCollectionCardHtml(null)).toBe('');
      expect(buildCollectionCardHtml({})).toBe('');
    });

    it('builds HTML with title', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain('Mountain Lodge Living');
    });

    it('builds HTML with subtitle in featured variant', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain('Warm tones');
    });

    it('hides subtitle div in compact variant', () => {
      const html = buildCollectionCardHtml(collection, { variant: 'compact' });
      // Subtitle text still appears in aria-label but NOT as a visible div
      expect(html).not.toContain(`font-size:14px;margin-top:4px`);
    });

    it('includes mood tags', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain('cozy');
      expect(html).toContain('rustic');
      expect(html).toContain('warm');
    });

    it('limits mood tags to 3', () => {
      const manyMoods = { ...collection, mood: ['a', 'b', 'c', 'd', 'e'] };
      const html = buildCollectionCardHtml(manyMoods);
      expect(html).toContain('a');
      expect(html).toContain('c');
      expect(html).not.toContain('>d<');
    });

    it('includes item count', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain(`${collection.productIds.length} items`);
    });

    it('uses singular "item" for 1 product', () => {
      const single = { ...collection, productIds: ['one'] };
      const html = buildCollectionCardHtml(single);
      expect(html).toContain('1 item');
      expect(html).not.toContain('1 items');
    });

    it('includes hero image', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain('<img');
      expect(html).toContain('object-fit:cover');
    });

    it('includes image alt text', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain('alt="');
    });

    it('uses lazy loading for images', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain('loading="lazy"');
    });

    it('links to collection page using slug', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain(`/collections/${collection.slug}`);
    });

    it('uses default 220px height for featured variant', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain('height:220px');
    });

    it('uses default 140px height for compact variant', () => {
      const html = buildCollectionCardHtml(collection, { variant: 'compact' });
      expect(html).toContain('height:140px');
    });

    it('uses custom height', () => {
      const html = buildCollectionCardHtml(collection, { height: 300 });
      expect(html).toContain('height:300px');
    });

    it('includes aria-label for accessibility', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain('aria-label="Mountain Lodge Living');
    });

    it('includes gradient overlay', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).toContain('linear-gradient');
    });

    it('shows CF+ Early Access badge when earlyAccess is true', () => {
      const earlyAccess = getCollections().find(c => c.earlyAccess);
      const html = buildCollectionCardHtml(earlyAccess);
      expect(html).toContain('CF+ Early Access');
    });

    it('does not show Early Access badge when earlyAccess is falsy', () => {
      const html = buildCollectionCardHtml(collection);
      expect(html).not.toContain('Early Access');
    });

    it('escapes HTML in title', () => {
      const malicious = { ...collection, title: '<script>alert(1)</script>' };
      const html = buildCollectionCardHtml(malicious);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('escapes HTML in mood tags', () => {
      const malicious = { ...collection, mood: ['<b>bold</b>'] };
      const html = buildCollectionCardHtml(malicious);
      expect(html).not.toContain('<b>');
    });

    it('builds HTML for all 6 collections', () => {
      for (const c of getCollections()) {
        const html = buildCollectionCardHtml(c);
        expect(html.length).toBeGreaterThan(100);
        expect(html).toContain(c.title);
      }
    });
  });

  // ── buildCollectionGridHtml ──────────────────────────────────────

  describe('buildCollectionGridHtml', () => {
    it('returns empty string for empty array', () => {
      expect(buildCollectionGridHtml([])).toBe('');
    });

    it('uses featured collections by default', () => {
      const html = buildCollectionGridHtml();
      expect(html).toContain('Mountain Lodge Living');
      expect(html).toContain('Guest Room Ready');
    });

    it('includes grid layout', () => {
      const html = buildCollectionGridHtml();
      expect(html).toContain('display:grid');
    });

    it('defaults to 2 columns', () => {
      const html = buildCollectionGridHtml();
      expect(html).toContain('repeat(2,1fr)');
    });

    it('accepts custom column count', () => {
      const html = buildCollectionGridHtml(undefined, { columns: 3 });
      expect(html).toContain('repeat(3,1fr)');
    });

    it('clamps columns to 1-4 range', () => {
      const tooMany = buildCollectionGridHtml(undefined, { columns: 10 });
      expect(tooMany).toContain('repeat(4,1fr)');
      const tooFew = buildCollectionGridHtml(undefined, { columns: 0 });
      expect(tooFew).toContain('repeat(1,1fr)');
    });

    it('includes aria list role', () => {
      const html = buildCollectionGridHtml();
      expect(html).toContain('role="list"');
    });

    it('filters out invalid items', () => {
      const items = [getCollections()[0], null, {}];
      const html = buildCollectionGridHtml(items);
      expect(html).toContain('Mountain Lodge');
      // Only 1 valid item should render
      expect(html.split('<a href=').length).toBe(2); // 1 card + 1 from split
    });

    it('accepts custom variant', () => {
      const html = buildCollectionGridHtml(undefined, { variant: 'compact' });
      expect(html).toContain('height:140px');
    });
  });
});
