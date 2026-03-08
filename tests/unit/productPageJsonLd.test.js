import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame, wallHuggerFrame, futonMattress, murphyBed, platformBed, casegoodsItem, saleProduct, outdoorFrame } from '../fixtures/products.js';

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
const mockProductSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Eureka Futon Frame',
  sku: 'EUR-FRM-001',
  offers: {
    '@type': 'Offer',
    price: 499,
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
  },
  brand: { '@type': 'Brand', name: 'Night & Day Furniture' },
};

const mockBreadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.carolinafutons.com/' },
    { '@type': 'ListItem', position: 2, name: 'Futon Frames', item: 'https://www.carolinafutons.com/futon-frames' },
    { '@type': 'ListItem', position: 3, name: 'Eureka Futon Frame' },
  ],
};

const mockFaqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    { '@type': 'Question', name: 'What is the return policy?', acceptedAnswer: { '@type': 'Answer', text: '30 days.' } },
  ],
};

vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn((p) => p ? JSON.stringify(mockProductSchema) : null),
  getBreadcrumbSchema: vi.fn(() => JSON.stringify(mockBreadcrumbSchema)),
  getProductFaqSchema: vi.fn((p) => p ? JSON.stringify(mockFaqSchema) : null),
  getProductOgTags: vi.fn(() => JSON.stringify({
    'og:type': 'product',
    'og:title': 'Eureka Futon Frame | Carolina Futons',
    'og:description': 'Solid hardwood futon frame.',
    'og:image': 'https://example.com/eureka.jpg',
    'og:url': 'https://www.carolinafutons.com/product-page/eureka-futon-frame',
    'og:site_name': 'Carolina Futons',
    'product:price:amount': '499',
    'product:price:currency': 'USD',
    'product:availability': 'in stock',
    'twitter:card': 'summary_large_image',
    'twitter:title': 'Eureka Futon Frame | Carolina Futons',
    'twitter:description': 'Solid hardwood futon frame.',
    'twitter:image': 'https://example.com/eureka.jpg',
  })),
  getPageTitle: vi.fn(() => 'Eureka Futon Frame | Carolina Futons'),
  getPageMetaDescription: vi.fn(() => 'Solid hardwood futon frame with clean modern lines.'),
  getCanonicalUrl: vi.fn(() => 'https://www.carolinafutons.com/product-page/eureka-futon-frame'),
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getProductPinData: vi.fn(() => ({
    success: true,
    meta: {
      'pinterest:description': 'Shop Eureka Futon Frame at Carolina Futons',
      'pinterest-rich-pin': 'true',
      'product:retailer_item_id': 'EUR-FRM-001',
      'product:category': 'Futon Frame',
      'product:sale_price:amount': null,
      'product:sale_price:currency': null,
    },
  })),
}));

// ── Import module under test ──────────────────────────────────────
const {
  injectProductMeta,
  injectPinterestMeta,
  buildGridAlt,
  detectProductCategory,
  getCategoryFromCollections,
} = await import('../../src/public/product/productSchema.js');

const { detectProductBrand } = await import('../../src/public/productPageUtils.js');

const {
  getProductSchema,
  getBreadcrumbSchema,
  getProductFaqSchema,
  getProductOgTags,
  getPageTitle,
  getPageMetaDescription,
  getCanonicalUrl,
} = await import('backend/seoHelpers.web');

const { getProductPinData } = await import('backend/pinterestRichPins.web');

// ── Tests ─────────────────────────────────────────────────────────

describe('Product Page JSON-LD — injectProductMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Structured Data Injection ──────────────────────────────────

  describe('head.setStructuredData', () => {
    it('injects Product, BreadcrumbList, and FAQPage schemas together', async () => {
      await injectProductMeta(futonFrame);

      expect(mockHead.setStructuredData).toHaveBeenCalledTimes(1);
      const schemas = mockHead.setStructuredData.mock.calls[0][0];
      expect(schemas).toHaveLength(3);

      const types = schemas.map(s => s['@type']);
      expect(types).toContain('Product');
      expect(types).toContain('BreadcrumbList');
      expect(types).toContain('FAQPage');
    });

    it('all schemas have @context schema.org', async () => {
      await injectProductMeta(futonFrame);

      const schemas = mockHead.setStructuredData.mock.calls[0][0];
      schemas.forEach(s => {
        expect(s['@context']).toBe('https://schema.org');
      });
    });

    it('still injects remaining schemas when Product schema fails', async () => {
      getProductSchema.mockReturnValueOnce(null);

      await injectProductMeta(futonFrame);

      expect(mockHead.setStructuredData).toHaveBeenCalled();
      const schemas = mockHead.setStructuredData.mock.calls[0][0];
      // Should still have BreadcrumbList and FAQPage
      expect(schemas.length).toBeGreaterThanOrEqual(2);
      expect(schemas.find(s => s['@type'] === 'Product')).toBeUndefined();
    });

    it('still injects remaining schemas when FAQ schema fails', async () => {
      getProductFaqSchema.mockReturnValueOnce(null);

      await injectProductMeta(futonFrame);

      const schemas = mockHead.setStructuredData.mock.calls[0][0];
      expect(schemas.find(s => s['@type'] === 'FAQPage')).toBeUndefined();
      expect(schemas.find(s => s['@type'] === 'Product')).toBeDefined();
    });

    it('still injects remaining schemas when Breadcrumb schema fails', async () => {
      getBreadcrumbSchema.mockReturnValueOnce(null);

      await injectProductMeta(futonFrame);

      const schemas = mockHead.setStructuredData.mock.calls[0][0];
      expect(schemas.find(s => s['@type'] === 'BreadcrumbList')).toBeUndefined();
      expect(schemas.find(s => s['@type'] === 'Product')).toBeDefined();
    });

    it('does not call setStructuredData when all schemas fail', async () => {
      getProductSchema.mockReturnValueOnce(null);
      getBreadcrumbSchema.mockReturnValueOnce(null);
      getProductFaqSchema.mockReturnValueOnce(null);

      await injectProductMeta(futonFrame);

      expect(mockHead.setStructuredData).not.toHaveBeenCalled();
    });

    it('handles backend throwing errors gracefully', async () => {
      getProductSchema.mockImplementationOnce(() => { throw new Error('Backend error'); });

      await expect(injectProductMeta(futonFrame)).resolves.not.toThrow();
      // Should still set title/description
      expect(mockHead.setTitle).toHaveBeenCalled();
    });

    it('handles invalid JSON from backend gracefully', async () => {
      getProductSchema.mockReturnValueOnce('not-valid-json{{{');

      await expect(injectProductMeta(futonFrame)).resolves.not.toThrow();
    });
  });

  // ── Title, Description, Canonical ─────────────────────────────

  describe('meta tags', () => {
    it('sets page title via head.setTitle', async () => {
      await injectProductMeta(futonFrame);

      expect(mockHead.setTitle).toHaveBeenCalledWith('Eureka Futon Frame | Carolina Futons');
      expect(getPageTitle).toHaveBeenCalledWith('product', { name: futonFrame.name });
    });

    it('sets meta description via head.setMetaTag', async () => {
      await injectProductMeta(futonFrame);

      expect(mockHead.setMetaTag).toHaveBeenCalledWith(
        'description',
        'Solid hardwood futon frame with clean modern lines.'
      );
    });

    it('sets canonical URL via head.setLinks', async () => {
      await injectProductMeta(futonFrame);

      expect(mockHead.setLinks).toHaveBeenCalledWith([
        { rel: 'canonical', href: 'https://www.carolinafutons.com/product-page/eureka-futon-frame' },
      ]);
    });

    it('does not set title when getPageTitle returns null', async () => {
      getPageTitle.mockReturnValueOnce(null);

      await injectProductMeta(futonFrame);

      expect(mockHead.setTitle).not.toHaveBeenCalled();
    });

    it('does not set description when getPageMetaDescription returns null', async () => {
      getPageMetaDescription.mockReturnValueOnce(null);

      await injectProductMeta(futonFrame);

      const descCalls = mockHead.setMetaTag.mock.calls.filter(c => c[0] === 'description');
      expect(descCalls).toHaveLength(0);
    });

    it('does not set canonical when getCanonicalUrl returns null', async () => {
      getCanonicalUrl.mockReturnValueOnce(null);

      await injectProductMeta(futonFrame);

      expect(mockHead.setLinks).not.toHaveBeenCalled();
    });
  });

  // ── OG / Twitter Meta Tags ─────────────────────────────────────

  describe('Open Graph and Twitter meta', () => {
    it('sets og: prefixed meta tags', async () => {
      await injectProductMeta(futonFrame);

      expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:type', 'product');
      expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:title', 'Eureka Futon Frame | Carolina Futons');
      expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:image', 'https://example.com/eureka.jpg');
      expect(mockHead.setMetaTag).toHaveBeenCalledWith('og:site_name', 'Carolina Futons');
    });

    it('sets product: prefixed meta tags', async () => {
      await injectProductMeta(futonFrame);

      expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:price:amount', '499');
      expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:price:currency', 'USD');
      expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:availability', 'in stock');
    });

    it('sets twitter: prefixed meta tags', async () => {
      await injectProductMeta(futonFrame);

      expect(mockHead.setMetaTag).toHaveBeenCalledWith('twitter:card', 'summary_large_image');
      expect(mockHead.setMetaTag).toHaveBeenCalledWith('twitter:title', 'Eureka Futon Frame | Carolina Futons');
    });

    it('does not set OG tags when getProductOgTags returns empty', async () => {
      getProductOgTags.mockReturnValueOnce('');

      await injectProductMeta(futonFrame);

      // Should still have description and title meta, but not og: tags
      const ogCalls = mockHead.setMetaTag.mock.calls.filter(c => c[0].startsWith('og:'));
      expect(ogCalls).toHaveLength(0);
    });

    it('still injects structured data when OG tags return malformed JSON', async () => {
      getProductOgTags.mockReturnValueOnce('not-valid-json{{{');

      await injectProductMeta(futonFrame);

      // Structured data should still be injected despite OG parse failure
      expect(mockHead.setStructuredData).toHaveBeenCalled();
      const schemas = mockHead.setStructuredData.mock.calls[0][0];
      expect(schemas.find(s => s['@type'] === 'Product')).toBeDefined();
    });
  });

  // ── Robots Meta ───────────────────────────────────────────────

  describe('robots meta', () => {
    it('sets noindex for out-of-stock products', async () => {
      const outOfStock = { ...futonFrame, inStock: false };
      await injectProductMeta(outOfStock);

      expect(mockHead.setMetaTag).toHaveBeenCalledWith('robots', 'noindex, follow');
    });

    it('does not set noindex for in-stock products', async () => {
      await injectProductMeta(futonFrame);

      const robotsCalls = mockHead.setMetaTag.mock.calls.filter(c => c[0] === 'robots');
      expect(robotsCalls).toHaveLength(0);
    });

    it('does not set noindex when inStock is undefined (truthy default)', async () => {
      const noStockField = { ...futonFrame };
      delete noStockField.inStock;
      await injectProductMeta(noStockField);

      const robotsCalls = mockHead.setMetaTag.mock.calls.filter(c => c[0] === 'robots');
      expect(robotsCalls).toHaveLength(0);
    });
  });

  // ── Null/Invalid Product ───────────────────────────────────────

  describe('null and invalid products', () => {
    it('does nothing for null product', async () => {
      await injectProductMeta(null);

      expect(mockHead.setStructuredData).not.toHaveBeenCalled();
      expect(mockHead.setTitle).not.toHaveBeenCalled();
      expect(mockHead.setMetaTag).not.toHaveBeenCalled();
      expect(mockHead.setLinks).not.toHaveBeenCalled();
    });

    it('does nothing for undefined product', async () => {
      await injectProductMeta(undefined);

      expect(mockHead.setStructuredData).not.toHaveBeenCalled();
    });
  });

  // ── Product Type Variations ────────────────────────────────────

  describe('works across product types', () => {
    it('handles wall hugger frame', async () => {
      await injectProductMeta(wallHuggerFrame);

      expect(getProductSchema).toHaveBeenCalledWith(wallHuggerFrame);
      expect(mockHead.setStructuredData).toHaveBeenCalled();
    });

    it('handles futon mattress with discounted price', async () => {
      await injectProductMeta(futonMattress);

      expect(getProductSchema).toHaveBeenCalledWith(futonMattress);
      expect(mockHead.setStructuredData).toHaveBeenCalled();
    });

    it('handles murphy bed (qualifies for free shipping)', async () => {
      await injectProductMeta(murphyBed);

      expect(getProductSchema).toHaveBeenCalledWith(murphyBed);
      expect(mockHead.setTitle).toHaveBeenCalled();
    });

    it('handles out-of-stock product', async () => {
      await injectProductMeta(outdoorFrame);

      expect(getProductSchema).toHaveBeenCalledWith(outdoorFrame);
    });

    it('handles product without collections', async () => {
      const noCollections = { ...futonFrame, collections: undefined };
      await expect(injectProductMeta(noCollections)).resolves.not.toThrow();
    });

    it('handles product without slug', async () => {
      const noSlug = { ...futonFrame, slug: undefined };
      await expect(injectProductMeta(noSlug)).resolves.not.toThrow();
    });
  });

  // ── Pinterest Integration ─────────────────────────────────────

  describe('Pinterest meta injection via injectProductMeta', () => {
    it('calls injectPinterestMeta as part of injectProductMeta', async () => {
      await injectProductMeta(futonFrame);

      expect(getProductPinData).toHaveBeenCalled();
    });

    it('sets Pinterest-specific meta tags', async () => {
      await injectProductMeta(futonFrame);

      expect(mockHead.setMetaTag).toHaveBeenCalledWith(
        'pinterest:description',
        'Shop Eureka Futon Frame at Carolina Futons'
      );
      expect(mockHead.setMetaTag).toHaveBeenCalledWith('pinterest-rich-pin', 'true');
      expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:retailer_item_id', 'EUR-FRM-001');
      expect(mockHead.setMetaTag).toHaveBeenCalledWith('product:category', 'Futon Frame');
    });

    it('skips null Pinterest meta values', async () => {
      await injectProductMeta(futonFrame);

      // sale_price:amount is null in mock — should not be set
      const salePriceCalls = mockHead.setMetaTag.mock.calls.filter(
        c => c[0] === 'product:sale_price:amount'
      );
      expect(salePriceCalls).toHaveLength(0);
    });

    it('handles Pinterest API failure gracefully', async () => {
      getProductPinData.mockRejectedValueOnce(new Error('Pinterest API down'));

      await expect(injectProductMeta(futonFrame)).resolves.not.toThrow();
      // Title/description should still be set
      expect(mockHead.setTitle).toHaveBeenCalled();
    });

    it('handles Pinterest returning success:false', async () => {
      getProductPinData.mockReturnValueOnce({ success: false, meta: null });

      await expect(injectProductMeta(futonFrame)).resolves.not.toThrow();
    });
  });
});

// ── injectPinterestMeta (standalone) ─────────────────────────────

describe('injectPinterestMeta — standalone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing for null product', async () => {
    await injectPinterestMeta(null);

    expect(getProductPinData).not.toHaveBeenCalled();
  });

  it('passes correct product data to getProductPinData', async () => {
    await injectPinterestMeta(futonFrame);

    expect(getProductPinData).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Eureka Futon Frame',
      slug: 'eureka-futon-frame',
      price: 499,
      inStock: true,
      sku: 'EUR-FRM-001',
    }));
  });

  it('uses _id as SKU fallback', async () => {
    const noSku = { ...futonFrame, sku: '' };
    await injectPinterestMeta(noSku);

    expect(getProductPinData).toHaveBeenCalledWith(expect.objectContaining({
      sku: 'prod-frame-001',
    }));
  });

  it('passes sale price when product has discount', async () => {
    await injectPinterestMeta(futonMattress);

    expect(getProductPinData).toHaveBeenCalledWith(expect.objectContaining({
      salePrice: 299,
    }));
  });

  it('omits sale price when no discount', async () => {
    await injectPinterestMeta(futonFrame);

    expect(getProductPinData).toHaveBeenCalledWith(expect.objectContaining({
      salePrice: undefined,
    }));
  });
});

// ── buildGridAlt ─────────────────────────────────────────────────

describe('buildGridAlt', () => {
  it('builds alt text with name, brand, category, and site name', () => {
    const alt = buildGridAlt(futonFrame);
    expect(alt).toContain('Eureka Futon Frame');
    expect(alt).toContain('Night & Day Furniture');
    expect(alt).toContain('Futon Frame');
    expect(alt).toContain('Carolina Futons');
  });

  it('detects Strata Furniture for wall hugger', () => {
    const alt = buildGridAlt(wallHuggerFrame);
    expect(alt).toContain('Strata Furniture');
  });

  it('detects Otis Bed for mattress', () => {
    const alt = buildGridAlt(futonMattress);
    expect(alt).toContain('Otis Bed');
    expect(alt).toContain('Futon Mattress');
  });

  it('detects Murphy Cabinet Bed category', () => {
    const alt = buildGridAlt(murphyBed);
    expect(alt).toContain('Murphy Cabinet Bed');
  });

  it('truncates to 125 characters max', () => {
    const longName = { ...futonFrame, name: 'A'.repeat(150) };
    const alt = buildGridAlt(longName);
    expect(alt.length).toBeLessThanOrEqual(125);
    expect(alt).toMatch(/\.\.\.$/);
  });

  it('handles product with no collections', () => {
    const noCollections = { ...futonFrame, collections: undefined };
    const alt = buildGridAlt(noCollections);
    expect(alt).toContain('Eureka Futon Frame');
    expect(alt).toContain('Carolina Futons');
  });

  it('handles null product gracefully', () => {
    const alt = buildGridAlt(null);
    expect(alt).toContain('Carolina Futons');
  });
});

// ── detectProductBrand ──────────────────────────────────────────

describe('detectProductBrand', () => {
  it('returns Night & Day Furniture as default', () => {
    expect(detectProductBrand(futonFrame)).toBe('Night & Day Furniture');
  });

  it('returns Strata Furniture for wall-hugger collections', () => {
    expect(detectProductBrand(wallHuggerFrame)).toBe('Strata Furniture');
  });

  it('returns Otis Bed for mattress collections', () => {
    expect(detectProductBrand(futonMattress)).toBe('Otis Bed');
  });

  it('returns KD Frames for unfinished collections', () => {
    const unfinished = { ...futonFrame, collections: ['unfinished-wood'] };
    expect(detectProductBrand(unfinished)).toBe('KD Frames');
  });

  it('returns empty string for null product', () => {
    expect(detectProductBrand(null)).toBe('');
  });

  it('returns empty string for product without collections', () => {
    expect(detectProductBrand({ ...futonFrame, collections: undefined })).toBe('');
  });

  it('handles string collections (non-array)', () => {
    const stringColl = { ...futonFrame, collections: 'wall-huggers' };
    expect(detectProductBrand(stringColl)).toBe('Strata Furniture');
  });
});

// ── detectProductCategory ───────────────────────────────────────

describe('detectProductCategory', () => {
  it('returns Futon Frame for futon-frames collection', () => {
    expect(detectProductCategory(futonFrame)).toBe('Futon Frame');
  });

  it('returns Wall Hugger Futon Frame for wall-hugger collection', () => {
    expect(detectProductCategory(wallHuggerFrame)).toBe('Wall Hugger Futon Frame');
  });

  it('returns Futon Mattress for mattress collection', () => {
    expect(detectProductCategory(futonMattress)).toBe('Futon Mattress');
  });

  it('returns Murphy Cabinet Bed for murphy collection', () => {
    expect(detectProductCategory(murphyBed)).toBe('Murphy Cabinet Bed');
  });

  it('returns Platform Bed for platform-beds collection', () => {
    expect(detectProductCategory(platformBed)).toBe('Platform Bed');
  });

  it('returns Bedroom Furniture for casegoods collection', () => {
    expect(detectProductCategory(casegoodsItem)).toBe('Bedroom Furniture');
  });

  it('returns Furniture as default for unknown collection', () => {
    const unknown = { ...futonFrame, collections: ['seasonal-specials'] };
    expect(detectProductCategory(unknown)).toBe('Furniture');
  });

  it('returns empty string for null product', () => {
    expect(detectProductCategory(null)).toBe('');
  });

  it('returns empty string for product without collections', () => {
    expect(detectProductCategory({ ...futonFrame, collections: undefined })).toBe('');
  });
});

// ── getCategoryFromCollections ───────────────────────────────────

describe('getCategoryFromCollections', () => {
  it('returns Shop default for null/undefined collections', () => {
    expect(getCategoryFromCollections(null)).toEqual({ label: 'Shop', path: '/shop-main' });
    expect(getCategoryFromCollections(undefined)).toEqual({ label: 'Shop', path: '/shop-main' });
  });

  it('maps futon-frames to Futon Frames', () => {
    const result = getCategoryFromCollections(['futon-frames']);
    expect(result.label).toBe('Futon Frames');
    expect(result.path).toBe('/futon-frames');
  });

  it('maps murphy collection to Murphy Cabinet Beds', () => {
    const result = getCategoryFromCollections(['murphy-cabinet-beds']);
    expect(result.label).toBe('Murphy Cabinet Beds');
    expect(result.path).toBe('/murphy-cabinet-beds');
  });

  it('maps platform-beds collection', () => {
    const result = getCategoryFromCollections(['platform-beds']);
    expect(result.label).toBe('Platform Beds');
    expect(result.path).toBe('/platform-beds');
  });

  it('maps mattresses collection', () => {
    const result = getCategoryFromCollections(['mattresses']);
    expect(result.label).toBe('Mattresses');
    expect(result.path).toBe('/mattresses');
  });

  it('maps wall-huggers collection', () => {
    const result = getCategoryFromCollections(['wall-huggers']);
    expect(result.label).toBe('Wall Hugger Frames');
    expect(result.path).toBe('/wall-huggers');
  });

  it('maps unfinished-wood collection', () => {
    const result = getCategoryFromCollections(['unfinished-wood']);
    expect(result.label).toBe('Unfinished Wood');
    expect(result.path).toBe('/unfinished-wood');
  });

  it('maps casegoods-accessories collection', () => {
    const result = getCategoryFromCollections(['casegoods-accessories']);
    expect(result.label).toBe('Casegoods & Accessories');
    expect(result.path).toBe('/casegoods-accessories');
  });

  it('handles string collections (non-array)', () => {
    const result = getCategoryFromCollections('mattresses');
    expect(result.label).toBe('Mattresses');
  });

  it('returns Shop for unknown collection', () => {
    const result = getCategoryFromCollections(['custom-collection']);
    expect(result).toEqual({ label: 'Shop', path: '/shop-main' });
  });

  it('prioritizes first matching collection (murphy over futon)', () => {
    const result = getCategoryFromCollections(['murphy-cabinet-beds', 'futon-frames']);
    expect(result.label).toBe('Murphy Cabinet Beds');
  });
});
