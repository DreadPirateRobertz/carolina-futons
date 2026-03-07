import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame, murphyBed, wallHuggerFrame } from './fixtures/products.js';

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

const {
  injectProductMeta,
  injectPinterestMeta,
  buildGridAlt,
  detectProductBrand,
  detectProductCategory,
  getCategoryFromCollections,
} = await import('../src/public/product/productSchema.js');

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

  it('calls injectPinterestMeta internally', async () => {
    const { getProductPinData } = await import('backend/pinterestRichPins.web');
    getProductPinData.mockClear();

    await injectProductMeta(futonFrame);

    // injectProductMeta handles Pinterest meta as part of the SSR injection
    expect(getProductPinData).toHaveBeenCalled();
  });
});

// ── injectPinterestMeta ──────────────────────────────────────────

describe('injectPinterestMeta — Pinterest Rich Pin injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing for null product', async () => {
    await expect(injectPinterestMeta(null)).resolves.not.toThrow();
    expect(mockHead.setMetaTag).not.toHaveBeenCalled();
  });

  it('sets Pinterest meta tags when pin data succeeds', async () => {
    const { getProductPinData } = await import('backend/pinterestRichPins.web');
    getProductPinData.mockReturnValueOnce({
      success: true,
      meta: {
        'pinterest:description': 'Test pin description',
        'pinterest-rich-pin': 'true',
        'product:retailer_item_id': 'EUR-FRM-001',
        'product:category': 'Furniture > Futon Frames',
      },
    });

    await injectPinterestMeta(futonFrame);

    expect(mockHead.setMetaTag).toHaveBeenCalledWith('pinterest:description', 'Test pin description');
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('pinterest-rich-pin', 'true');
    expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:retailer_item_id', 'EUR-FRM-001');
  });

  it('does nothing when pin data returns failure', async () => {
    const { getProductPinData } = await import('backend/pinterestRichPins.web');
    getProductPinData.mockReturnValueOnce({ success: false, meta: null });

    await injectPinterestMeta(futonFrame);

    expect(mockHead.setMetaTag).not.toHaveBeenCalled();
  });
});

// ── buildGridAlt ─────────────────────────────────────────────────

describe('buildGridAlt', () => {
  it('builds alt text with name, brand, category, and store', () => {
    const alt = buildGridAlt(futonFrame);
    expect(alt).toContain('Eureka Futon Frame');
    expect(alt).toContain('Night & Day Furniture');
    expect(alt).toContain('Futon Frame');
    expect(alt).toContain('Carolina Futons');
  });

  it('truncates to 125 characters', () => {
    const longName = { ...futonFrame, name: 'A'.repeat(200) };
    const alt = buildGridAlt(longName);
    expect(alt.length).toBeLessThanOrEqual(125);
    expect(alt).toMatch(/\.\.\.$/);
  });

  it('detects wall hugger brand', () => {
    const alt = buildGridAlt(wallHuggerFrame);
    expect(alt).toContain('Strata Furniture');
  });
});

// ── detectProductBrand / detectProductCategory ───────────────────

describe('detectProductBrand', () => {
  it('returns Strata Furniture for wall-hugger', () => {
    expect(detectProductBrand(wallHuggerFrame)).toBe('Strata Furniture');
  });

  it('returns Night & Day Furniture as default', () => {
    expect(detectProductBrand(futonFrame)).toBe('Night & Day Furniture');
  });

  it('returns empty string for no collections', () => {
    expect(detectProductBrand({ name: 'Test' })).toBe('');
  });
});

describe('detectProductCategory', () => {
  it('returns Murphy Cabinet Bed for murphy collection', () => {
    expect(detectProductCategory(murphyBed)).toBe('Murphy Cabinet Bed');
  });

  it('returns Futon Frame for futon collection', () => {
    expect(detectProductCategory(futonFrame)).toBe('Futon Frame');
  });

  it('returns empty string for no collections', () => {
    expect(detectProductCategory({ name: 'Test' })).toBe('');
  });
});

// ── getCategoryFromCollections ───────────────────────────────────

describe('getCategoryFromCollections', () => {
  it('returns Murphy category for murphy collection', () => {
    const cat = getCategoryFromCollections(['murphy-cabinet-beds']);
    expect(cat.label).toBe('Murphy Cabinet Beds');
    expect(cat.path).toBe('/murphy-cabinet-beds');
  });

  it('returns Shop fallback for null', () => {
    const cat = getCategoryFromCollections(null);
    expect(cat.label).toBe('Shop');
    expect(cat.path).toBe('/shop-main');
  });

  it('handles non-array collection value', () => {
    const cat = getCategoryFromCollections('platform-beds');
    expect(cat.label).toBe('Platform Beds');
  });
});
