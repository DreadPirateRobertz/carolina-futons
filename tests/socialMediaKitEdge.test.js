/**
 * socialMediaKitEdge.test.js
 *
 * Edge-case coverage for socialMediaKit.web.js:
 *   - getShareUrls: special characters in URL/title, encoding, missing fields
 *   - getProductShareUrls: edge cases for price, name, missing data
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/socialMediaKit.web.js');
});

// ── getShareUrls — special characters ───────────────────────────────

describe('getShareUrls — special characters and encoding', () => {
  it('encodes ampersand in URL', async () => {
    const urls = await mod.getShareUrls({
      url: 'https://example.com/page?a=1&b=2',
      title: 'Test',
    });
    // The encoded URL should appear in facebook share link
    expect(urls.facebook).toContain(encodeURIComponent('https://example.com/page?a=1&b=2'));
  });

  it('encodes ampersand in title', async () => {
    const urls = await mod.getShareUrls({
      url: 'https://example.com',
      title: 'Beds & Frames',
    });
    expect(urls.twitter).toContain(encodeURIComponent('Beds & Frames'));
  });

  it('encodes double quotes in title', async () => {
    const urls = await mod.getShareUrls({
      url: 'https://example.com',
      title: 'The "Best" Futon',
    });
    expect(urls.twitter).toContain(encodeURIComponent('The "Best" Futon'));
  });

  it('encodes hashtag character in title', async () => {
    const urls = await mod.getShareUrls({
      url: 'https://example.com',
      title: '#1 Futon Frame',
    });
    expect(urls.twitter).not.toContain('#+1+Futon+Frame'); // should use %23
    expect(decodeURIComponent(urls.twitter)).toContain('#1 Futon Frame');
  });

  it('generates valid URLs when title is empty string', async () => {
    const urls = await mod.getShareUrls({
      url: 'https://example.com',
      title: '',
    });
    expect(urls.facebook).toContain('facebook.com/sharer');
    expect(urls.twitter).toContain('twitter.com/intent/tweet');
  });

  it('returns empty object when url is undefined', async () => {
    const urls = await mod.getShareUrls({ url: undefined, title: 'Test' });
    expect(urls).toEqual({});
  });

  it('includes description in email body when provided', async () => {
    const urls = await mod.getShareUrls({
      url: 'https://example.com',
      title: 'Futon Frame',
      description: 'Check out this great futon',
    });
    const decoded = decodeURIComponent(urls.email);
    expect(decoded).toContain('Check out this great futon');
  });

  it('encodes description with special chars for email', async () => {
    const urls = await mod.getShareUrls({
      url: 'https://example.com',
      title: 'Test',
      description: 'Price: $499 & free shipping!',
    });
    // email body should be encoded
    expect(urls.email).toContain('body=');
  });

  it('Pinterest URL includes media param when image has special chars', async () => {
    const urls = await mod.getShareUrls({
      url: 'https://example.com',
      title: 'Frame',
      image: 'https://cdn.example.com/img with spaces.jpg',
    });
    expect(urls.pinterest).toContain('media=');
    expect(urls.pinterest).toContain(encodeURIComponent('https://cdn.example.com/img with spaces.jpg'));
  });

  it('linkedin URL properly encodes page URL with query params', async () => {
    const pageUrl = 'https://carolinafutons.com/product?id=123&ref=sale';
    const urls = await mod.getShareUrls({ url: pageUrl, title: 'Test' });
    expect(urls.linkedin).toContain(encodeURIComponent(pageUrl));
  });
});

// ── getProductShareUrls — edge cases ────────────────────────────────

describe('getProductShareUrls — edge cases', () => {
  it('formats price as $0.00 when price is 0', async () => {
    const urls = await mod.getProductShareUrls({
      slug: 'free-sample',
      name: 'Free Sample',
      price: 0,
    });
    expect(urls.twitter).toContain(encodeURIComponent('$0.00'));
  });

  it('uses discountedPrice over price when both present', async () => {
    // getProductShareUrls uses formattedPrice || `$${price.toFixed(2)}`
    // formattedPrice can encode the sale price
    const urls = await mod.getProductShareUrls({
      slug: 'sale-frame',
      name: 'Sale Frame',
      price: 599,
      formattedPrice: '$449.00', // represents the discount
    });
    expect(urls.twitter).toContain(encodeURIComponent('$449.00'));
  });

  it('handles product name with HTML entities', async () => {
    // sanitize strips HTML tags
    const urls = await mod.getProductShareUrls({
      slug: 'clean-frame',
      name: '<b>Bold</b> Frame & More',
      price: 299,
    });
    expect(urls.twitter).not.toContain('<b>');
  });

  it('product URL includes the slug', async () => {
    const urls = await mod.getProductShareUrls({
      slug: 'my-special-futon',
      name: 'My Special Futon',
      price: 399,
    });
    expect(urls.productUrl).toContain('my-special-futon');
    expect(urls.productUrl).toContain('carolinafutons.com');
  });

  it('email subject includes product name and site name', async () => {
    const urls = await mod.getProductShareUrls({
      slug: 'test-frame',
      name: 'Test Frame',
      price: 299,
    });
    const decoded = decodeURIComponent(urls.email);
    expect(decoded).toContain('Test Frame');
    expect(decoded).toContain('Carolina Futons');
  });
});
