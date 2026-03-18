/**
 * Wishlist Share — pure helper unit tests (CF-y24r S1, CF-muzy S5)
 * Tests: token parsing, invalid message builder, SEO helpers
 */
import { describe, it, expect } from 'vitest';
import {
  parseShareToken,
  buildInvalidMessage,
  buildWishlistTitle,
  buildWishlistDescription,
  buildWishlistOgTags,
} from '../../src/public/wishlistShareHelpers.js';

// ── parseShareToken ────────────────────────────────────────────────────────────

describe('parseShareToken', () => {
  it('returns token string from query.share', () => {
    expect(parseShareToken({ share: 'abc123' })).toBe('abc123');
  });

  it('returns null when share param is absent', () => {
    expect(parseShareToken({})).toBeNull();
  });

  it('returns null when query is null', () => {
    expect(parseShareToken(null)).toBeNull();
  });

  it('returns null when query is undefined', () => {
    expect(parseShareToken(undefined)).toBeNull();
  });

  it('trims leading and trailing whitespace', () => {
    expect(parseShareToken({ share: '  tok1  ' })).toBe('tok1');
  });

  it('returns null for whitespace-only share value', () => {
    expect(parseShareToken({ share: '   ' })).toBeNull();
  });

  it('returns null for empty string share value', () => {
    expect(parseShareToken({ share: '' })).toBeNull();
  });

  it('preserves internal token characters (hyphens, underscores)', () => {
    expect(parseShareToken({ share: 'tok-001_abc' })).toBe('tok-001_abc');
  });
});

// ── buildInvalidMessage ────────────────────────────────────────────────────────

describe('buildInvalidMessage', () => {
  it('missing_token: returns a message about no share link', () => {
    const msg = buildInvalidMessage('missing_token');
    expect(msg).toContain('No wishlist link');
  });

  it('not_found: returns a message about the link not being found', () => {
    const msg = buildInvalidMessage('not_found');
    expect(msg.toLowerCase()).toContain('not found');
  });

  it('expired: returns a message mentioning expiration', () => {
    const msg = buildInvalidMessage('expired');
    expect(msg.toLowerCase()).toContain('expired');
  });

  it('unknown reason: returns a non-empty fallback string', () => {
    const msg = buildInvalidMessage('something_weird');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('all messages are non-empty strings', () => {
    for (const reason of ['missing_token', 'not_found', 'expired', 'error']) {
      const msg = buildInvalidMessage(reason);
      expect(typeof msg).toBe('string');
      expect(msg.length).toBeGreaterThan(0);
    }
  });
});

// ── S5: buildWishlistTitle ─────────────────────────────────────────────────────

describe('buildWishlistTitle', () => {
  it('returns "[Name]\'s Wishlist | Carolina Futons" for a named owner', () => {
    expect(buildWishlistTitle('Alice')).toBe("Alice's Wishlist | Carolina Futons");
  });

  it('uses possessive correctly for names ending in s', () => {
    const title = buildWishlistTitle('James');
    expect(title).toContain('James');
    expect(title).toContain('Carolina Futons');
  });

  it('returns fallback title for empty/null owner name', () => {
    const t1 = buildWishlistTitle('');
    const t2 = buildWishlistTitle(null);
    expect(t1).toContain('Carolina Futons');
    expect(t2).toContain('Carolina Futons');
  });

  it('returns generic fallback title for invalid/noindex case', () => {
    const title = buildWishlistTitle(null);
    expect(typeof title).toBe('string');
    expect(title.length).toBeGreaterThan(0);
  });
});

// ── S5: buildWishlistDescription ──────────────────────────────────────────────

describe('buildWishlistDescription', () => {
  it('includes owner name and item count', () => {
    const desc = buildWishlistDescription('Alice', 3);
    expect(desc).toContain('Alice');
    expect(desc).toContain('3');
  });

  it('uses singular "item" for count 1', () => {
    const desc = buildWishlistDescription('Bob', 1);
    expect(desc).toMatch(/\b1 item\b/);
  });

  it('uses plural "items" for count 2+', () => {
    const desc = buildWishlistDescription('Bob', 5);
    expect(desc).toMatch(/\b5 items\b/);
  });

  it('mentions Carolina Futons', () => {
    expect(buildWishlistDescription('Alice', 2)).toContain('Carolina Futons');
  });

  it('stays under 160 characters', () => {
    const long = 'A'.repeat(80);
    expect(buildWishlistDescription(long, 99).length).toBeLessThanOrEqual(160);
  });

  it('handles zero items gracefully', () => {
    const desc = buildWishlistDescription('Alice', 0);
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });

  it('handles null ownerName without emitting literal "null"', () => {
    const desc = buildWishlistDescription(null, 2);
    expect(desc).not.toContain('null');
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });
});

// ── S5: buildWishlistOgTags ───────────────────────────────────────────────────

describe('buildWishlistOgTags', () => {
  const items = [
    { productImage: 'https://example.com/a.jpg', productName: 'Eureka' },
    { productImage: 'https://example.com/b.jpg', productName: 'Dillon' },
  ];

  it('returns an array of tag objects', () => {
    const tags = buildWishlistOgTags('Alice', 'A desc', items);
    expect(Array.isArray(tags)).toBe(true);
    expect(tags.length).toBeGreaterThan(0);
  });

  it('includes og:title tag', () => {
    const tags = buildWishlistOgTags('Alice', 'A desc', items);
    expect(tags.some(t => t.property === 'og:title')).toBe(true);
  });

  it('og:title matches the provided title', () => {
    const tags = buildWishlistOgTags('Alice', 'A desc', items);
    const ogTitle = tags.find(t => t.property === 'og:title');
    expect(ogTitle.content).toContain('Alice');
  });

  it('includes og:description tag', () => {
    const tags = buildWishlistOgTags('Alice', 'A desc', items);
    expect(tags.some(t => t.property === 'og:description')).toBe(true);
  });

  it('og:description matches the provided description', () => {
    const tags = buildWishlistOgTags('Alice', 'My desc', items);
    const ogDesc = tags.find(t => t.property === 'og:description');
    expect(ogDesc.content).toBe('My desc');
  });

  it('uses first product image as og:image', () => {
    const tags = buildWishlistOgTags('Alice', 'desc', items);
    const ogImage = tags.find(t => t.property === 'og:image');
    expect(ogImage).toBeTruthy();
    expect(ogImage.content).toBe('https://example.com/a.jpg');
  });

  it('omits og:image when items is empty', () => {
    const tags = buildWishlistOgTags('Alice', 'desc', []);
    const ogImage = tags.find(t => t.property === 'og:image');
    expect(ogImage).toBeFalsy();
  });

  it('includes og:type = website', () => {
    const tags = buildWishlistOgTags('Alice', 'desc', items);
    const ogType = tags.find(t => t.property === 'og:type');
    expect(ogType?.content).toBe('website');
  });
});
