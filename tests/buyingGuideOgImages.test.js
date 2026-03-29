/**
 * @file buyingGuideOgImages.test.js
 * @description Tests for cf-jdgq: OG image support for all 8 buying guides.
 *
 * Covers:
 *  - All 8 buying guides have ogImage fields defined
 *  - getBuyingGuide returns ogImage in the result
 *  - initPageSeo('buyingGuide') sets og:type=article, summary_large_image, og:image:width/height
 *  - initPageSeo sets article:section when category is provided
 *  - ogImage URL is distinct from heroImage (dedicated social dimensions)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset } from 'wix-data';
import { getBuyingGuide, getBuyingGuideSlugs } from '../src/backend/buyingGuides.web.js';

// ---------------------------------------------------------------------------
// wix-seo-frontend mock for pageSeo tests
// ---------------------------------------------------------------------------

const mockHead = {
  setMetaTags: vi.fn(),
  setTitle: vi.fn(),
};

vi.mock('wix-seo-frontend', () => ({ head: mockHead }));

vi.mock('backend/seoHelpers.web', () => ({
  getPageTitle: vi.fn((pageType, data) => `${data?.name || pageType} | Carolina Futons`),
  getPageMetaDescription: vi.fn(() => 'Quality futon furniture since 1991.'),
  getCanonicalUrl: vi.fn((_, slug) => `https://www.carolinafutons.com/buying-guides/${slug || ''}`),
}));

// Import pageSeo after mocks
import { initPageSeo } from '../src/public/pageSeo.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMetaTags() {
  return mockHead.setMetaTags.mock.calls.flatMap(c => c[0]);
}

function findTag(key, value) {
  // Find by property= or name= key
  return getMetaTags().find(t => t[key] === value);
}

const GUIDE_SLUGS = [
  'futon-frames',
  'mattresses',
  'covers',
  'pillows',
  'storage',
  'outdoor',
  'accessories',
  'bundle-deals',
];

// ---------------------------------------------------------------------------
// ogImage present in all 8 guides
// ---------------------------------------------------------------------------

describe('buyingGuides — ogImage field', () => {
  beforeEach(() => {
    __reset();
  });

  it('getBuyingGuideSlugs returns exactly 8 slugs', async () => {
    const result = await getBuyingGuideSlugs();
    expect(result.success).toBe(true);
    expect(result.slugs).toHaveLength(8);
  });

  it.each(GUIDE_SLUGS)('guide "%s" returns ogImage in result', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.success).toBe(true);
    expect(result.guide.ogImage).toBeTruthy();
    expect(typeof result.guide.ogImage).toBe('string');
  });

  it.each(GUIDE_SLUGS)('guide "%s" ogImage is a full URL', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.guide.ogImage).toMatch(/^https:\/\//);
  });

  it.each(GUIDE_SLUGS)('guide "%s" ogImage is different from heroImage', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.guide.ogImage).not.toBe(result.guide.heroImage);
  });

  it.each(GUIDE_SLUGS)('guide "%s" ogImage path uses slug-social.jpg pattern', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.guide.ogImage).toContain(slug);
    expect(result.guide.ogImage).toContain('social');
  });
});

// ---------------------------------------------------------------------------
// initPageSeo('buyingGuide') — OG meta tags
// ---------------------------------------------------------------------------

describe('initPageSeo — buyingGuide type', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets og:type to "article" for buyingGuide pages', async () => {
    await initPageSeo('buyingGuide', { name: 'Futon Frames Guide', slug: 'futon-frames' });
    const ogType = findTag('property', 'og:type');
    expect(ogType?.content).toBe('article');
  });

  it('sets twitter:card to "summary_large_image" for buyingGuide', async () => {
    await initPageSeo('buyingGuide', { name: 'Futon Frames Guide', slug: 'futon-frames' });
    const twitterCard = findTag('name', 'twitter:card');
    expect(twitterCard?.content).toBe('summary_large_image');
  });

  it('sets og:image:width to "1200"', async () => {
    await initPageSeo('buyingGuide', {
      name: 'Futon Frames Guide',
      slug: 'futon-frames',
      image: 'https://www.carolinafutons.com/og-images/buying-guides/futon-frames-social.jpg',
    });
    const widthTag = findTag('property', 'og:image:width');
    expect(widthTag?.content).toBe('1200');
  });

  it('sets og:image:height to "630"', async () => {
    await initPageSeo('buyingGuide', {
      name: 'Futon Frames Guide',
      slug: 'futon-frames',
      image: 'https://www.carolinafutons.com/og-images/buying-guides/futon-frames-social.jpg',
    });
    const heightTag = findTag('property', 'og:image:height');
    expect(heightTag?.content).toBe('630');
  });

  it('sets og:image to the provided image URL', async () => {
    const ogImageUrl = 'https://www.carolinafutons.com/og-images/buying-guides/futon-frames-social.jpg';
    await initPageSeo('buyingGuide', { name: 'Futon Frames Guide', slug: 'futon-frames', image: ogImageUrl });
    const ogImage = findTag('property', 'og:image');
    expect(ogImage?.content).toBe(ogImageUrl);
  });

  it('falls back to DEFAULT_IMAGE when no image provided', async () => {
    await initPageSeo('buyingGuide', { name: 'Test Guide', slug: 'test' });
    const ogImage = findTag('property', 'og:image');
    expect(ogImage?.content).toMatch(/carolinafutons\.com/);
    expect(ogImage?.content).toBeTruthy();
  });

  it('sets article:section when category is provided', async () => {
    await initPageSeo('buyingGuide', {
      name: 'Futon Frames Guide',
      slug: 'futon-frames',
      category: 'Futon Frames',
    });
    const articleSection = findTag('property', 'article:section');
    expect(articleSection?.content).toBe('Futon Frames');
  });

  it('does not set article:section when no category', async () => {
    await initPageSeo('buyingGuide', { name: 'Test Guide', slug: 'test' });
    const articleSection = findTag('property', 'article:section');
    expect(articleSection).toBeUndefined();
  });

  it('sets og:title and og:description', async () => {
    await initPageSeo('buyingGuide', { name: 'Futon Frames Guide', slug: 'futon-frames' });
    const ogTitle = findTag('property', 'og:title');
    const ogDesc = findTag('property', 'og:description');
    expect(ogTitle?.content).toContain('Futon Frames Guide');
    expect(ogDesc?.content).toBeTruthy();
  });

  it('website type still uses "website" og:type', async () => {
    await initPageSeo('home', {});
    const ogType = findTag('property', 'og:type');
    expect(ogType?.content).toBe('website');
  });

  it('blogPost type still uses "article" og:type', async () => {
    await initPageSeo('blogPost', { name: 'Test Post', slug: 'test', image: 'img.jpg' });
    const ogType = findTag('property', 'og:type');
    expect(ogType?.content).toBe('article');
  });

  it('sets article:section for blogPost when category is provided', async () => {
    await initPageSeo('blogPost', { name: 'Test Post', slug: 'test', category: 'News' });
    const articleSection = findTag('property', 'article:section');
    expect(articleSection?.content).toBe('News');
  });

  it('product type still uses "product" og:type', async () => {
    await initPageSeo('product', { name: 'Test Product', slug: 'test' });
    const ogType = findTag('property', 'og:type');
    expect(ogType?.content).toBe('product');
  });
});
