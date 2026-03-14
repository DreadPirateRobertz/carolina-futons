/**
 * Tests for public/faqSeo.js — FAQ page SSR SEO injection.
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
  getFaqSchema: vi.fn(),
  getPageTitle: vi.fn(),
  getPageMetaDescription: vi.fn(),
  getCanonicalUrl: vi.fn(),
}));

vi.mock('public/faqHelpers.js', () => ({
  getFaqData: vi.fn(() => [{ question: 'Q1?', answer: 'A1' }]),
  buildFaqSchemaData: vi.fn((data) => data),
}));

import { injectFaqSeo } from '../src/public/faqSeo.js';
import { getFaqSchema, getPageTitle, getPageMetaDescription, getCanonicalUrl } from 'backend/seoHelpers.web';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('injectFaqSeo', () => {
  it('sets structured data when schema is available', async () => {
    const schema = { '@type': 'FAQPage' };
    getFaqSchema.mockResolvedValue(JSON.stringify(schema));
    getPageTitle.mockResolvedValue(null);
    getPageMetaDescription.mockResolvedValue(null);
    getCanonicalUrl.mockResolvedValue(null);

    await injectFaqSeo();
    expect(mockHead.setStructuredData).toHaveBeenCalledWith([schema]);
  });

  it('sets page title when available', async () => {
    getFaqSchema.mockResolvedValue(null);
    getPageTitle.mockResolvedValue('FAQ - Carolina Futons');
    getPageMetaDescription.mockResolvedValue(null);
    getCanonicalUrl.mockResolvedValue(null);

    await injectFaqSeo();
    expect(mockHead.setTitle).toHaveBeenCalledWith('FAQ - Carolina Futons');
  });

  it('sets meta description when available', async () => {
    getFaqSchema.mockResolvedValue(null);
    getPageTitle.mockResolvedValue(null);
    getPageMetaDescription.mockResolvedValue('Common questions about futons');
    getCanonicalUrl.mockResolvedValue(null);

    await injectFaqSeo();
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('description', 'Common questions about futons');
  });

  it('sets canonical URL when available', async () => {
    getFaqSchema.mockResolvedValue(null);
    getPageTitle.mockResolvedValue(null);
    getPageMetaDescription.mockResolvedValue(null);
    getCanonicalUrl.mockResolvedValue('https://www.carolinafutons.com/faq');

    await injectFaqSeo();
    expect(mockHead.setLinks).toHaveBeenCalledWith([{
      rel: 'canonical',
      href: 'https://www.carolinafutons.com/faq',
    }]);
  });

  it('does not call setTitle when title is null', async () => {
    getFaqSchema.mockResolvedValue(null);
    getPageTitle.mockResolvedValue(null);
    getPageMetaDescription.mockResolvedValue(null);
    getCanonicalUrl.mockResolvedValue(null);

    await injectFaqSeo();
    expect(mockHead.setTitle).not.toHaveBeenCalled();
  });

  it('survives schema parse failure gracefully', async () => {
    getFaqSchema.mockRejectedValue(new Error('DB error'));
    getPageTitle.mockResolvedValue('FAQ');
    getPageMetaDescription.mockResolvedValue(null);
    getCanonicalUrl.mockResolvedValue(null);

    await injectFaqSeo();
    // Title should still be set despite schema failure
    expect(mockHead.setTitle).toHaveBeenCalledWith('FAQ');
  });

  it('does not throw when all backend calls fail', async () => {
    getFaqSchema.mockRejectedValue(new Error('fail'));
    getPageTitle.mockRejectedValue(new Error('fail'));
    getPageMetaDescription.mockRejectedValue(new Error('fail'));
    getCanonicalUrl.mockRejectedValue(new Error('fail'));

    await expect(injectFaqSeo()).resolves.not.toThrow();
  });
});
