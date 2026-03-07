import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame, murphyBed } from './fixtures/products.js';

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

// ── Mock backend modules ──────────────────────────────────────────
const mockProductSchema = { '@context': 'https://schema.org', '@type': 'Product', name: 'Test' };
const mockBreadcrumbSchema = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] };
const mockFaqSchema = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] };

vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn((p) => p ? JSON.stringify(mockProductSchema) : null),
  getBreadcrumbSchema: vi.fn(() => JSON.stringify(mockBreadcrumbSchema)),
  getProductFaqSchema: vi.fn((p) => p ? JSON.stringify(mockFaqSchema) : null),
  getProductOgTags: vi.fn(() => JSON.stringify({
    'og:type': 'product',
    'og:title': 'Test | Carolina Futons',
    'twitter:card': 'summary_large_image',
  })),
  getPageTitle: vi.fn(() => 'Test | Carolina Futons'),
  getPageMetaDescription: vi.fn(() => 'Test description'),
  getCanonicalUrl: vi.fn(() => 'https://www.carolinafutons.com/product-page/test'),
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getProductPinData: vi.fn(() => ({ success: false, meta: null })),
}));

const { injectProductMeta } = await import('../src/public/product/productSchema.js');

// ── Tests ─────────────────────────────────────────────────────────

describe('injectProductMeta — structured data injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls head.setStructuredData with Product schema', async () => {
    await injectProductMeta(futonFrame);

    expect(mockHead.setStructuredData).toHaveBeenCalled();
    const calls = mockHead.setStructuredData.mock.calls;
    const allSchemas = calls.flatMap(c => c[0]);
    const productSchema = allSchemas.find(s => s['@type'] === 'Product');
    expect(productSchema).toBeDefined();
    expect(productSchema['@context']).toBe('https://schema.org');
  });

  it('calls head.setStructuredData with BreadcrumbList schema', async () => {
    await injectProductMeta(futonFrame);

    const calls = mockHead.setStructuredData.mock.calls;
    const allSchemas = calls.flatMap(c => c[0]);
    const breadcrumbSchema = allSchemas.find(s => s['@type'] === 'BreadcrumbList');
    expect(breadcrumbSchema).toBeDefined();
  });

  it('calls head.setStructuredData with FAQPage schema', async () => {
    await injectProductMeta(futonFrame);

    const calls = mockHead.setStructuredData.mock.calls;
    const allSchemas = calls.flatMap(c => c[0]);
    const faqSchema = allSchemas.find(s => s['@type'] === 'FAQPage');
    expect(faqSchema).toBeDefined();
  });

  it('still sets title, description, and canonical', async () => {
    await injectProductMeta(futonFrame);

    expect(mockHead.setTitle).toHaveBeenCalledWith('Test | Carolina Futons');
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('description', 'Test description');
    expect(mockHead.setLinks).toHaveBeenCalledWith([
      { rel: 'canonical', href: 'https://www.carolinafutons.com/product-page/test' },
    ]);
  });

  it('sets OG and Twitter meta tags via head.setMetaTag', async () => {
    await injectProductMeta(futonFrame);

    expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:type', 'product');
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('twitter:card', 'summary_large_image');
  });

  it('does nothing for null product', async () => {
    await injectProductMeta(null);

    expect(mockHead.setStructuredData).not.toHaveBeenCalled();
    expect(mockHead.setTitle).not.toHaveBeenCalled();
  });

  it('sets robots noindex for out-of-stock products', async () => {
    const outOfStock = { ...futonFrame, inStock: false };
    await injectProductMeta(outOfStock);

    expect(mockHead.setMetaTag).toHaveBeenCalledWith('robots', 'noindex, follow');
  });

  it('does not set robots noindex for in-stock products', async () => {
    await injectProductMeta(futonFrame);

    const robotsCalls = mockHead.setMetaTag.mock.calls.filter(c => c[0] === 'robots');
    expect(robotsCalls).toHaveLength(0);
  });

  it('handles backend schema returning null gracefully', async () => {
    const { getProductSchema } = await import('backend/seoHelpers.web');
    getProductSchema.mockReturnValueOnce(null);

    await expect(injectProductMeta(futonFrame)).resolves.not.toThrow();
    // Should still set title/description even if schema fails
    expect(mockHead.setTitle).toHaveBeenCalled();
  });
});
