/**
 * Tests for public/localBusinessSeo.js — Contact + Store Locator SSR SEO injection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockHead = {
  setStructuredData: vi.fn(),
  setTitle: vi.fn(),
  setMetaTag: vi.fn(),
  setLinks: vi.fn(),
};

vi.mock('wix-seo-frontend', () => ({ head: mockHead }));

vi.mock('backend/seoHelpers.web', () => ({
  getBusinessSchema: vi.fn(),
  getPageTitle: vi.fn(),
  getPageMetaDescription: vi.fn(),
  getCanonicalUrl: vi.fn(),
}));

vi.mock('backend/storeLocatorService.web', () => ({
  getStoreLocatorSchema: vi.fn(),
}));

import { injectContactSeoSsr, injectStoreLocatorSeoSsr } from '../src/public/localBusinessSeo.js';
import { getBusinessSchema, getPageTitle, getPageMetaDescription, getCanonicalUrl } from 'backend/seoHelpers.web';
import { getStoreLocatorSchema } from 'backend/storeLocatorService.web';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── injectContactSeoSsr ────────────────────────────────────────────────

describe('injectContactSeoSsr', () => {
  it('sets title, description, and canonical via Promise.all', async () => {
    getPageTitle.mockResolvedValue('Contact Us');
    getPageMetaDescription.mockResolvedValue('Get in touch with Carolina Futons');
    getCanonicalUrl.mockResolvedValue('https://www.carolinafutons.com/contact');
    getBusinessSchema.mockResolvedValue(null);

    await injectContactSeoSsr();

    expect(mockHead.setTitle).toHaveBeenCalledWith('Contact Us');
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('description', 'Get in touch with Carolina Futons');
    expect(mockHead.setLinks).toHaveBeenCalledWith([{
      rel: 'canonical',
      href: 'https://www.carolinafutons.com/contact',
    }]);
  });

  it('sets LocalBusiness structured data when available', async () => {
    const schema = { '@type': 'FurnitureStore', name: 'Carolina Futons' };
    getPageTitle.mockResolvedValue(null);
    getPageMetaDescription.mockResolvedValue(null);
    getCanonicalUrl.mockResolvedValue(null);
    getBusinessSchema.mockResolvedValue(JSON.stringify(schema));

    await injectContactSeoSsr();
    expect(mockHead.setStructuredData).toHaveBeenCalledWith([schema]);
  });

  it('skips structured data when schema is null', async () => {
    getPageTitle.mockResolvedValue(null);
    getPageMetaDescription.mockResolvedValue(null);
    getCanonicalUrl.mockResolvedValue(null);
    getBusinessSchema.mockResolvedValue(null);

    await injectContactSeoSsr();
    expect(mockHead.setStructuredData).not.toHaveBeenCalled();
  });

  it('survives schema failure and still sets meta tags', async () => {
    getPageTitle.mockResolvedValue('Contact');
    getPageMetaDescription.mockResolvedValue(null);
    getCanonicalUrl.mockResolvedValue(null);
    getBusinessSchema.mockRejectedValue(new Error('schema error'));

    await injectContactSeoSsr();
    expect(mockHead.setTitle).toHaveBeenCalledWith('Contact');
  });

  it('does not throw when all calls fail', async () => {
    getPageTitle.mockRejectedValue(new Error('fail'));
    getPageMetaDescription.mockRejectedValue(new Error('fail'));
    getCanonicalUrl.mockRejectedValue(new Error('fail'));
    getBusinessSchema.mockRejectedValue(new Error('fail'));

    await expect(injectContactSeoSsr()).resolves.not.toThrow();
  });
});

// ── injectStoreLocatorSeoSsr ───────────────────────────────────────────

describe('injectStoreLocatorSeoSsr', () => {
  it('uses store-locator variant for title', async () => {
    getPageTitle.mockResolvedValue('Store Locator');
    getPageMetaDescription.mockResolvedValue('Find our showroom');
    getCanonicalUrl.mockResolvedValue('https://www.carolinafutons.com/contact/store-locator');
    getStoreLocatorSchema.mockResolvedValue(null);

    await injectStoreLocatorSeoSsr();

    expect(getPageTitle).toHaveBeenCalledWith('contact', { variant: 'store-locator' });
    expect(mockHead.setTitle).toHaveBeenCalledWith('Store Locator');
  });

  it('sets store locator structured data', async () => {
    const schema = { '@type': 'FurnitureStore', name: 'Carolina Futons Showroom' };
    getPageTitle.mockResolvedValue(null);
    getPageMetaDescription.mockResolvedValue(null);
    getCanonicalUrl.mockResolvedValue(null);
    getStoreLocatorSchema.mockResolvedValue(JSON.stringify(schema));

    await injectStoreLocatorSeoSsr();
    expect(mockHead.setStructuredData).toHaveBeenCalledWith([schema]);
  });

  it('does not throw on complete failure', async () => {
    getPageTitle.mockRejectedValue(new Error('fail'));
    getPageMetaDescription.mockRejectedValue(new Error('fail'));
    getCanonicalUrl.mockRejectedValue(new Error('fail'));
    getStoreLocatorSchema.mockRejectedValue(new Error('fail'));

    await expect(injectStoreLocatorSeoSsr()).resolves.not.toThrow();
  });
});
