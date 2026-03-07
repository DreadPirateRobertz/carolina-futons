import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame, futonMattress, outdoorFrame } from './fixtures/products.js';

// Tests for Product Page Open Graph + Twitter Card meta tag injection via SSR.
// Validates that og:title, og:image, og:price, product:*, and twitter:* tags
// are set via wix-seo-frontend head.setMetaTag for social sharing preview.

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

const fullOgResponse = {
  'og:type': 'product',
  'og:title': 'Eureka Futon Frame | Carolina Futons',
  'og:description': 'Solid hardwood futon frame with clean modern lines.',
  'og:image': 'https://example.com/eureka.jpg',
  'og:url': 'https://www.carolinafutons.com/product-page/eureka-futon-frame',
  'og:site_name': 'Carolina Futons',
  'og:locale': 'en_US',
  'product:price:amount': '499',
  'product:price:currency': 'USD',
  'product:availability': 'in stock',
  'product:brand': 'Night & Day Furniture',
  'product:condition': 'new',
  'twitter:card': 'summary_large_image',
  'twitter:title': 'Eureka Futon Frame | Carolina Futons',
  'twitter:description': 'Solid hardwood futon frame with clean modern lines.',
  'twitter:image': 'https://example.com/eureka.jpg',
};

const {
  mockGetProductOgTags,
  mockGetProductSchema,
  mockGetBreadcrumbSchema,
  mockGetProductFaqSchema,
  mockGetPageTitle,
  mockGetPageMetaDescription,
  mockGetCanonicalUrl,
} = vi.hoisted(() => ({
  mockGetProductOgTags: vi.fn(),
  mockGetProductSchema: vi.fn(),
  mockGetBreadcrumbSchema: vi.fn(),
  mockGetProductFaqSchema: vi.fn(),
  mockGetPageTitle: vi.fn(),
  mockGetPageMetaDescription: vi.fn(),
  mockGetCanonicalUrl: vi.fn(),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getProductOgTags: mockGetProductOgTags,
  getProductSchema: mockGetProductSchema,
  getBreadcrumbSchema: mockGetBreadcrumbSchema,
  getProductFaqSchema: mockGetProductFaqSchema,
  getPageTitle: mockGetPageTitle,
  getPageMetaDescription: mockGetPageMetaDescription,
  getCanonicalUrl: mockGetCanonicalUrl,
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getProductPinData: vi.fn(() => ({ success: false, meta: null })),
}));

import { injectProductMeta } from '../src/public/product/productSchema.js';

// ── Tests ─────────────────────────────────────────────────────────

describe('Product Page OG meta tags — social sharing preview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProductOgTags.mockImplementation(() => JSON.stringify(fullOgResponse));
    mockGetProductSchema.mockImplementation(() => null);
    mockGetBreadcrumbSchema.mockImplementation(() => null);
    mockGetProductFaqSchema.mockImplementation(() => null);
    mockGetPageTitle.mockImplementation(() => 'Eureka Futon Frame | Carolina Futons');
    mockGetPageMetaDescription.mockImplementation(() => 'Test description');
    mockGetCanonicalUrl.mockImplementation(() => 'https://www.carolinafutons.com/product-page/eureka-futon-frame');
  });

  // ── Core OG tags ────────────────────────────────────────────────

  it('sets og:type to "product"', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:type', 'product');
  });

  it('sets og:title with product name and site', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:title', 'Eureka Futon Frame | Carolina Futons');
  });

  it('sets og:description from product description', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:description', 'Solid hardwood futon frame with clean modern lines.');
  });

  it('sets og:image from product main media', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:image', 'https://example.com/eureka.jpg');
  });

  it('sets og:url with full product page URL', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:url', 'https://www.carolinafutons.com/product-page/eureka-futon-frame');
  });

  it('sets og:site_name to "Carolina Futons"', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:site_name', 'Carolina Futons');
  });

  it('sets og:locale to "en_US"', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:locale', 'en_US');
  });

  // ── Product-specific OG tags ────────────────────────────────────

  it('sets product:price:amount as string', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:price:amount', '499');
  });

  it('sets product:price:currency to USD', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:price:currency', 'USD');
  });

  it('sets product:availability to "in stock" for available products', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:availability', 'in stock');
  });

  it('sets product:availability to "out of stock" for unavailable products', async () => {
    const outOfStockOg = { ...fullOgResponse, 'product:availability': 'out of stock' };
    mockGetProductOgTags.mockReturnValueOnce(JSON.stringify(outOfStockOg));
    await injectProductMeta(outdoorFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:availability', 'out of stock');
  });

  it('sets product:brand', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:brand', 'Night & Day Furniture');
  });

  it('sets product:condition to "new"', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:condition', 'new');
  });

  // ── Twitter Card tags ───────────────────────────────────────────

  it('sets twitter:card to summary_large_image', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('twitter:card', 'summary_large_image');
  });

  it('sets twitter:title', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('twitter:title', 'Eureka Futon Frame | Carolina Futons');
  });

  it('sets twitter:description', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('twitter:description', 'Solid hardwood futon frame with clean modern lines.');
  });

  it('sets twitter:image', async () => {
    await injectProductMeta(futonFrame);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('twitter:image', 'https://example.com/eureka.jpg');
  });

  // ── Sale/discounted product ─────────────────────────────────────

  it('sets sale product price in OG tags', async () => {
    const saleOg = { ...fullOgResponse, 'product:price:amount': '299' };
    mockGetProductOgTags.mockReturnValueOnce(JSON.stringify(saleOg));
    await injectProductMeta(futonMattress);
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:price:amount', '299');
  });

  // ── Error handling ──────────────────────────────────────────────

  it('does not set OG tags when getProductOgTags returns null', async () => {
    mockGetProductOgTags.mockReturnValueOnce(null);
    await injectProductMeta(futonFrame);
    // Should not have any og: calls (only description from setMetaTag for page meta)
    const ogCalls = mockHead.setMetaTag.mock.calls.filter(c => c[0].startsWith('og:'));
    expect(ogCalls).toHaveLength(0);
  });

  it('does not set OG tags when getProductOgTags returns empty string', async () => {
    mockGetProductOgTags.mockReturnValueOnce('');
    await injectProductMeta(futonFrame);
    const ogCalls = mockHead.setMetaTag.mock.calls.filter(c => c[0].startsWith('og:'));
    expect(ogCalls).toHaveLength(0);
  });

  it('handles getProductOgTags throwing without crashing', async () => {
    mockGetProductOgTags.mockRejectedValueOnce(new Error('network error'));
    await expect(injectProductMeta(futonFrame)).resolves.not.toThrow();
    // Title/description/canonical should still be set
    expect(mockHead.setTitle).toHaveBeenCalled();
  });

  it('handles malformed JSON from getProductOgTags', async () => {
    mockGetProductOgTags.mockReturnValueOnce('not valid json {{{');
    await expect(injectProductMeta(futonFrame)).resolves.not.toThrow();
    const ogCalls = mockHead.setMetaTag.mock.calls.filter(c => c[0].startsWith('og:'));
    expect(ogCalls).toHaveLength(0);
    // Title should still be set
    expect(mockHead.setTitle).toHaveBeenCalled();
  });

  it('does not set OG tags for null product', async () => {
    await injectProductMeta(null);
    expect(mockGetProductOgTags).not.toHaveBeenCalled();
    expect(mockHead.setMetaTag).not.toHaveBeenCalled();
  });

  it('still sets structured data when OG tag fetch fails', async () => {
    const mockSchema = { '@type': 'Product', name: 'Test' };
    mockGetProductSchema.mockReturnValueOnce(JSON.stringify(mockSchema));
    mockGetProductOgTags.mockRejectedValueOnce(new Error('timeout'));
    await injectProductMeta(futonFrame);
    expect(mockHead.setStructuredData).toHaveBeenCalled();
  });

  // ── Tag count validation ────────────────────────────────────────

  it('sets all 16 OG/product/twitter meta tags from full response', async () => {
    await injectProductMeta(futonFrame);
    const metaCalls = mockHead.setMetaTag.mock.calls;
    const ogCalls = metaCalls.filter(c => c[0].startsWith('og:'));
    const productCalls = metaCalls.filter(c => c[0].startsWith('product:'));
    const twitterCalls = metaCalls.filter(c => c[0].startsWith('twitter:'));
    expect(ogCalls).toHaveLength(7); // type, title, description, image, url, site_name, locale
    expect(productCalls).toHaveLength(5); // price:amount, price:currency, availability, brand, condition
    expect(twitterCalls).toHaveLength(4); // card, title, description, image
  });
});
