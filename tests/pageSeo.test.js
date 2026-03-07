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
    return 'Carolina Futons';
  }),
  getPageMetaDescription: vi.fn((pageType, data) => {
    if (pageType === 'home') return 'Carolina Futons — the largest selection.';
    if (pageType === 'faq') return 'Frequently asked questions about futons.';
    if (pageType === 'product') return `Shop ${data?.name || 'furniture'} at CF.`;
    return 'Quality futon furniture since 1991.';
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
});
