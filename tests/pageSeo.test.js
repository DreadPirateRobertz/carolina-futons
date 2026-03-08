/**
 * @file pageSeo.test.js
 * @description Tests for the shared page SEO helper (initPageSeo).
 * Verifies that meta descriptions and OG/Twitter Card tags are set
 * for all page types via wix-seo-frontend.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wix-seo-frontend
const mockHead = {
  setMetaTags: vi.fn(),
  setTitle: vi.fn(),
};

vi.mock('wix-seo-frontend', () => ({
  head: mockHead,
}));

// Mock backend SEO helpers
vi.mock('backend/seoHelpers.web', () => ({
  getPageTitle: vi.fn((pageType, data) => {
    if (pageType === 'home') return 'Carolina Futons — Handcrafted Futons';
    if (pageType === 'faq') return 'FAQ | Carolina Futons';
    if (pageType === 'contact') return 'Contact Us | Carolina Futons';
    if (pageType === 'about') return 'About Us | Carolina Futons';
    if (pageType === 'product') return `${data?.name || 'Product'} | Carolina Futons`;
    if (pageType === 'blogPost') return `${data?.name || 'Blog'} | Carolina Futons`;
    return 'Carolina Futons';
  }),
  getPageMetaDescription: vi.fn((pageType, data) => {
    if (pageType === 'home') return 'Carolina Futons — the largest selection.';
    if (pageType === 'faq') return 'Frequently asked questions about futons.';
    if (pageType === 'product') return `Shop ${data?.name || 'furniture'} at CF.`;
    return 'Quality futon furniture since 1991.';
  }),
  getCanonicalUrl: vi.fn((pageType, slug) => {
    if (pageType === 'home') return 'https://www.carolinafutons.com';
    if (pageType === 'product') return `https://www.carolinafutons.com/product-page/${slug || ''}`;
    if (pageType === 'blogPost') return `https://www.carolinafutons.com/post/${slug || ''}`;
    return 'https://www.carolinafutons.com';
  }),
}));

let initPageSeo;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('../src/public/pageSeo.js');
  initPageSeo = mod.initPageSeo;
});

describe('initPageSeo', () => {
  it('exports initPageSeo function', () => {
    expect(typeof initPageSeo).toBe('function');
  });

  it('sets meta description for a static page type', async () => {
    await initPageSeo('home');

    expect(mockHead.setMetaTags).toHaveBeenCalled();
    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const descTag = allTags.find(t => t.name === 'description');
    expect(descTag).toBeDefined();
    expect(descTag.content).toContain('Carolina Futons');
  });

  it('sets OG tags for a static page', async () => {
    await initPageSeo('home');

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const ogTitle = allTags.find(t => t.property === 'og:title');
    const ogDesc = allTags.find(t => t.property === 'og:description');
    const ogType = allTags.find(t => t.property === 'og:type');
    const ogSite = allTags.find(t => t.property === 'og:site_name');

    expect(ogTitle).toBeDefined();
    expect(ogDesc).toBeDefined();
    expect(ogType).toBeDefined();
    expect(ogSite?.content).toBe('Carolina Futons');
  });

  it('sets Twitter Card tags', async () => {
    await initPageSeo('faq');

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const twitterCard = allTags.find(t => t.name === 'twitter:card');
    const twitterTitle = allTags.find(t => t.name === 'twitter:title');
    const twitterDesc = allTags.find(t => t.name === 'twitter:description');

    expect(twitterCard).toBeDefined();
    expect(twitterCard.content).toBe('summary');
    expect(twitterTitle).toBeDefined();
    expect(twitterDesc).toBeDefined();
  });

  it('sets page title via head.setTitle', async () => {
    await initPageSeo('about');
    expect(mockHead.setTitle).toHaveBeenCalledWith('About Us | Carolina Futons');
  });

  it('passes data through to backend helpers for dynamic pages', async () => {
    const { getPageTitle, getPageMetaDescription } = await import('backend/seoHelpers.web');

    await initPageSeo('product', { name: 'Eureka Futon', slug: 'eureka-futon' });

    expect(getPageTitle).toHaveBeenCalledWith('product', { name: 'Eureka Futon', slug: 'eureka-futon' });
    expect(getPageMetaDescription).toHaveBeenCalledWith('product', { name: 'Eureka Futon', slug: 'eureka-futon' });
  });

  it('uses summary_large_image card for product pages', async () => {
    await initPageSeo('product', { name: 'Test', image: 'https://example.com/img.jpg' });

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const twitterCard = allTags.find(t => t.name === 'twitter:card');
    expect(twitterCard.content).toBe('summary_large_image');
  });

  it('uses summary card for non-product pages', async () => {
    await initPageSeo('faq');

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const twitterCard = allTags.find(t => t.name === 'twitter:card');
    expect(twitterCard.content).toBe('summary');
  });

  it('includes og:image when image data is provided', async () => {
    await initPageSeo('product', { name: 'Test', image: 'https://example.com/img.jpg' });

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const ogImage = allTags.find(t => t.property === 'og:image');
    expect(ogImage?.content).toBe('https://example.com/img.jpg');
  });

  it('handles errors gracefully without throwing', async () => {
    mockHead.setMetaTags.mockImplementationOnce(() => { throw new Error('SEO API error'); });
    await expect(initPageSeo('home')).resolves.not.toThrow();
  });

  it('sets og:type to product for product pages', async () => {
    await initPageSeo('product', { name: 'Test' });

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const ogType = allTags.find(t => t.property === 'og:type');
    expect(ogType.content).toBe('product');
  });

  it('sets og:type to website for non-product pages', async () => {
    await initPageSeo('home');

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const ogType = allTags.find(t => t.property === 'og:type');
    expect(ogType.content).toBe('website');
  });

  it('sets og:url from getCanonicalUrl', async () => {
    await initPageSeo('home');

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const ogUrl = allTags.find(t => t.property === 'og:url');
    expect(ogUrl).toBeDefined();
    expect(ogUrl.content).toBe('https://www.carolinafutons.com');
  });

  it('sets og:url with slug for dynamic pages', async () => {
    await initPageSeo('product', { name: 'Test', slug: 'eureka-futon' });

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const ogUrl = allTags.find(t => t.property === 'og:url');
    expect(ogUrl.content).toBe('https://www.carolinafutons.com/product-page/eureka-futon');
  });

  it('sets twitter:site tag with brand handle', async () => {
    await initPageSeo('home');

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const twitterSite = allTags.find(t => t.name === 'twitter:site');
    expect(twitterSite).toBeDefined();
    expect(twitterSite.content).toBe('@CarolinaFutons');
  });

  it('uses summary_large_image for blog posts with cover image', async () => {
    await initPageSeo('blogPost', { name: 'Test Post', slug: 'test', image: 'https://example.com/cover.jpg' });

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const twitterCard = allTags.find(t => t.name === 'twitter:card');
    expect(twitterCard.content).toBe('summary_large_image');
  });

  it('uses summary for blog posts without cover image', async () => {
    await initPageSeo('blogPost', { name: 'Test Post', slug: 'test' });

    const calls = mockHead.setMetaTags.mock.calls;
    const allTags = calls.flatMap(c => c[0]);
    const twitterCard = allTags.find(t => t.name === 'twitter:card');
    expect(twitterCard.content).toBe('summary');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Source-level: verify all pages import and call initPageSeo
// ═══════════════════════════════════════════════════════════════════════

import { readFileSync } from 'fs';
import { resolve } from 'path';

const PAGES_DIR = resolve(__dirname, '../src/pages');

const PAGES_WITH_SEO = [
  { file: 'Home.js', type: 'home' },
  { file: 'About.js', type: 'about' },
  { file: 'FAQ.js', type: 'faq' },
  { file: 'Style Quiz.js', type: 'styleQuiz' },
  { file: 'Gift Cards.js', type: 'giftCards' },
  { file: 'Financing.js', type: 'financing' },
  { file: 'Assembly Guides.js', type: 'assemblyGuides' },
  { file: 'Room Planner.js', type: 'roomPlanner' },
  { file: 'Compare Page.js', type: 'compareProducts' },
  { file: 'UGC Gallery.js', type: 'ugcGallery' },
  { file: 'Referral Page.js', type: 'referral' },
  { file: 'Returns.js', type: 'returns' },
  { file: 'Price Match Guarantee.js', type: 'priceMatch' },
  { file: 'Privacy Policy.js', type: 'privacyPolicy' },
  { file: 'Refund Policy.js', type: 'refundPolicy' },
  { file: 'Terms & Conditions.js', type: 'termsConditions' },
  { file: 'Shipping Policy.js', type: 'shippingPolicy' },
  { file: 'Accessibility Statement.js', type: 'accessibility' },
  { file: 'Newsletter.js', type: 'newsletter' },
  { file: 'Sustainability.js', type: 'sustainability' },
  { file: 'Cart Page.js', type: 'cart' },
  { file: 'Checkout.js', type: 'checkout' },
  { file: 'Thank You Page.js', type: 'thankYou' },
  { file: 'Member Page.js', type: 'member' },
  { file: 'Order Tracking.js', type: 'orderTracking' },
  { file: 'Search Results.js', type: 'searchResults' },
  { file: 'Blog.js', type: 'blog' },
  { file: 'Contact.js', type: 'contact' },
  { file: 'Store Locator.js', type: 'storeLocator' },
  { file: 'Buying Guides.js', type: 'buyingGuides' },
  { file: 'Buying Guide.js', type: 'buyingGuide' },
  { file: 'Blog Post.js', type: 'blogPost' },
];

describe('source-level: all pages import and call initPageSeo', () => {
  PAGES_WITH_SEO.forEach(({ file, type }) => {
    const src = readFileSync(resolve(PAGES_DIR, file), 'utf8');

    it(`${file} imports initPageSeo`, () => {
      expect(src).toContain("import { initPageSeo } from 'public/pageSeo.js'");
    });

    it(`${file} calls initPageSeo('${type}')`, () => {
      expect(src).toContain(`initPageSeo('${type}'`);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Source-level: backend seoHelpers has all page type descriptions
// ═══════════════════════════════════════════════════════════════════════

describe('source-level: seoHelpers.web.js PAGE_META_DESCRIPTIONS', () => {
  const backendSrc = readFileSync(
    resolve(__dirname, '../src/backend/seoHelpers.web.js'),
    'utf8'
  );

  const ALL_PAGE_TYPES = [
    'home', 'faq', 'contact', 'about', 'blog',
    'styleQuiz', 'giftCards', 'financing', 'storeLocator',
    'assemblyGuides', 'roomPlanner', 'compareProducts', 'ugcGallery',
    'referral', 'returns', 'priceMatch', 'privacyPolicy', 'refundPolicy',
    'termsConditions', 'shippingPolicy', 'accessibility', 'newsletter',
    'sustainability', 'buyingGuides', 'buyingGuide', 'cart', 'checkout', 'thankYou',
    'member', 'orderTracking', 'searchResults',
  ];

  ALL_PAGE_TYPES.forEach(type => {
    it(`has meta description for '${type}'`, () => {
      expect(backendSrc).toContain(`${type}:`);
    });
  });

  ALL_PAGE_TYPES.forEach(type => {
    it(`has getPageTitle case for '${type}'`, () => {
      expect(backendSrc).toContain(`case '${type}':`);
    });
  });
});
