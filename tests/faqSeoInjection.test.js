import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wix-seo-frontend ─────────────────────────────────────────
const mockHead = {
  setTitle: vi.fn(),
  setMetaTag: vi.fn(),
  setLinks: vi.fn(),
  setStructuredData: vi.fn(),
};

vi.mock('wix-seo-frontend', () => ({
  head: mockHead,
}));

// ── Mock backend SEO helpers ──────────────────────────────────────
const mockFaqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is a futon?',
      acceptedAnswer: { '@type': 'Answer', text: 'A versatile piece of furniture.' },
    },
  ],
};

vi.mock('backend/seoHelpers.web', () => ({
  getFaqSchema: vi.fn((faqs) => {
    if (!faqs || faqs.length === 0) return null;
    return JSON.stringify(mockFaqSchema);
  }),
  getPageTitle: vi.fn(() => 'FAQ | Carolina Futons'),
  getPageMetaDescription: vi.fn(() => 'Frequently asked questions about futons, shipping, returns, and more.'),
  getCanonicalUrl: vi.fn(() => 'https://www.carolinafutons.com/faq'),
}));

// ── Mock faqHelpers ───────────────────────────────────────────────
const mockFaqData = [
  { _id: 'p1', category: 'products', question: 'What is a futon?', answer: 'A versatile piece of furniture.' },
  { _id: 's1', category: 'shipping', question: 'What is your shipping policy?', answer: 'We ship across the US.' },
];

vi.mock('public/faqHelpers.js', () => ({
  getFaqData: vi.fn(() => mockFaqData),
  buildFaqSchemaData: vi.fn((faqs) => {
    if (!faqs || !Array.isArray(faqs)) return [];
    return faqs.map(f => ({ question: f.question, answer: f.answer }));
  }),
}));

const { injectFaqSeo } = await import('../src/public/faqSeo.js');

// ── Tests ─────────────────────────────────────────────────────────

describe('injectFaqSeo — FAQ structured data SSR injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Structured Data ───────────────────────────────────────────

  it('calls head.setStructuredData with FAQPage schema', async () => {
    await injectFaqSeo();

    expect(mockHead.setStructuredData).toHaveBeenCalledTimes(1);
    const schemas = mockHead.setStructuredData.mock.calls[0][0];
    const faqSchema = schemas.find(s => s['@type'] === 'FAQPage');
    expect(faqSchema).toBeDefined();
    expect(faqSchema['@context']).toBe('https://schema.org');
    expect(faqSchema.mainEntity).toHaveLength(1);
  });

  it('passes buildFaqSchemaData output to getFaqSchema', async () => {
    const { getFaqSchema } = await import('backend/seoHelpers.web');
    const { buildFaqSchemaData, getFaqData } = await import('public/faqHelpers.js');

    await injectFaqSeo();

    expect(getFaqData).toHaveBeenCalled();
    expect(buildFaqSchemaData).toHaveBeenCalledWith(mockFaqData);
    expect(getFaqSchema).toHaveBeenCalledWith([
      { question: 'What is a futon?', answer: 'A versatile piece of furniture.' },
      { question: 'What is your shipping policy?', answer: 'We ship across the US.' },
    ]);
  });

  // ── Meta Tags ─────────────────────────────────────────────────

  it('sets page title via head.setTitle', async () => {
    await injectFaqSeo();
    expect(mockHead.setTitle).toHaveBeenCalledWith('FAQ | Carolina Futons');
  });

  it('sets meta description via head.setMetaTag', async () => {
    await injectFaqSeo();
    expect(mockHead.setMetaTag).toHaveBeenCalledWith(
      'description',
      'Frequently asked questions about futons, shipping, returns, and more.'
    );
  });

  it('sets canonical link via head.setLinks', async () => {
    await injectFaqSeo();
    expect(mockHead.setLinks).toHaveBeenCalledWith([
      { rel: 'canonical', href: 'https://www.carolinafutons.com/faq' },
    ]);
  });

  it('calls backend helpers with correct page type', async () => {
    const { getPageTitle, getPageMetaDescription, getCanonicalUrl } = await import('backend/seoHelpers.web');

    await injectFaqSeo();

    expect(getPageTitle).toHaveBeenCalledWith('faq');
    expect(getPageMetaDescription).toHaveBeenCalledWith('faq');
    expect(getCanonicalUrl).toHaveBeenCalledWith('faq');
  });

  // ── Error Handling ────────────────────────────────────────────

  it('does not throw when getFaqSchema returns null', async () => {
    const { getFaqSchema } = await import('backend/seoHelpers.web');
    getFaqSchema.mockReturnValueOnce(null);

    await expect(injectFaqSeo()).resolves.not.toThrow();
    // Should still set title/description even if schema fails
    expect(mockHead.setTitle).toHaveBeenCalled();
    expect(mockHead.setStructuredData).not.toHaveBeenCalled();
  });

  it('does not throw when getPageTitle returns null', async () => {
    const { getPageTitle } = await import('backend/seoHelpers.web');
    getPageTitle.mockReturnValueOnce(null);

    await expect(injectFaqSeo()).resolves.not.toThrow();
    expect(mockHead.setTitle).not.toHaveBeenCalled();
    // Other meta should still be set
    expect(mockHead.setMetaTag).toHaveBeenCalled();
  });

  it('does not throw when getPageMetaDescription returns null', async () => {
    const { getPageMetaDescription } = await import('backend/seoHelpers.web');
    getPageMetaDescription.mockReturnValueOnce(null);

    await expect(injectFaqSeo()).resolves.not.toThrow();
    expect(mockHead.setMetaTag).not.toHaveBeenCalledWith('description', expect.anything());
    expect(mockHead.setTitle).toHaveBeenCalled();
  });

  it('does not throw when getCanonicalUrl returns null', async () => {
    const { getCanonicalUrl } = await import('backend/seoHelpers.web');
    getCanonicalUrl.mockReturnValueOnce(null);

    await expect(injectFaqSeo()).resolves.not.toThrow();
    expect(mockHead.setLinks).not.toHaveBeenCalled();
    expect(mockHead.setTitle).toHaveBeenCalled();
  });

  it('does not throw when getFaqSchema returns invalid JSON', async () => {
    const { getFaqSchema } = await import('backend/seoHelpers.web');
    getFaqSchema.mockReturnValueOnce('not-valid-json{{{');

    await expect(injectFaqSeo()).resolves.not.toThrow();
    expect(mockHead.setStructuredData).not.toHaveBeenCalled();
    // Meta tags should still be set
    expect(mockHead.setTitle).toHaveBeenCalled();
  });

  it('does not throw when all backend calls reject', async () => {
    const seo = await import('backend/seoHelpers.web');
    seo.getFaqSchema.mockRejectedValueOnce(new Error('network'));
    seo.getPageTitle.mockRejectedValueOnce(new Error('network'));
    seo.getPageMetaDescription.mockRejectedValueOnce(new Error('network'));
    seo.getCanonicalUrl.mockRejectedValueOnce(new Error('network'));

    await expect(injectFaqSeo()).resolves.not.toThrow();
  });

  it('still sets meta tags even if schema injection fails', async () => {
    const { getFaqSchema } = await import('backend/seoHelpers.web');
    getFaqSchema.mockRejectedValueOnce(new Error('schema error'));

    await injectFaqSeo();

    expect(mockHead.setTitle).toHaveBeenCalled();
    expect(mockHead.setMetaTag).toHaveBeenCalled();
    expect(mockHead.setLinks).toHaveBeenCalled();
  });

  it('still sets structured data even if meta tag injection fails', async () => {
    const seo = await import('backend/seoHelpers.web');
    seo.getPageTitle.mockRejectedValueOnce(new Error('fail'));
    seo.getPageMetaDescription.mockRejectedValueOnce(new Error('fail'));
    seo.getCanonicalUrl.mockRejectedValueOnce(new Error('fail'));

    await injectFaqSeo();

    expect(mockHead.setStructuredData).toHaveBeenCalled();
  });
});
