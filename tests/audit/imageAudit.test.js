import { describe, it, expect } from 'vitest';
import {
  auditCatalogImages,
  getImagePipelineStatus,
} from '../../src/backend/imageAudit.web.js';

function makeProduct(overrides = {}) {
  return {
    name: 'Monterey Futon Frame',
    slug: 'monterey',
    sku: 'CF-FRAME-MONTEREY',
    category: 'futon-frames',
    price: 549,
    images: [
      'https://static.wixstatic.com/media/e04e89_cf15142c61714ecfad7852522e0a98e4~mv2.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg',
      'https://static.wixstatic.com/media/e04e89_d88fa0b2e50b4bbc80a9cbc9b9c09a69~mv2.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg',
      'https://static.wixstatic.com/media/e04e89_abc123~mv2.jpg/v1/fit/w_2000,h_2000,q_90/file.jpg',
    ],
    ...overrides,
  };
}

// ── auditCatalogImages ──────────────────────────────────────────────

describe('auditCatalogImages', () => {
  it('returns error for non-array input', () => {
    const result = auditCatalogImages('not an array');
    expect(result.success).toBe(false);
    expect(result.error).toContain('array');
  });

  it('handles empty product array', () => {
    const result = auditCatalogImages([]);
    expect(result.success).toBe(true);
    expect(result.totalProducts).toBe(0);
    expect(result.totalImages).toBe(0);
  });

  it('counts total images correctly', () => {
    const products = [
      makeProduct({ images: ['https://static.wixstatic.com/media/a.jpg', 'https://static.wixstatic.com/media/b.jpg'] }),
      makeProduct({ slug: 'sunrise', images: ['https://static.wixstatic.com/media/c.jpg'] }),
    ];
    const result = auditCatalogImages(products);
    expect(result.totalImages).toBe(3);
    expect(result.totalProducts).toBe(2);
  });

  it('flags products with no images', () => {
    const products = [makeProduct({ slug: 'no-img', images: [] })];
    const result = auditCatalogImages(products);
    expect(result.coverage.noImages).toBe(1);
    expect(result.flaggedProducts).toHaveLength(1);
    expect(result.flaggedProducts[0].issue).toBe('NO_IMAGES');
  });

  it('flags products with only 1 image', () => {
    const products = [makeProduct({ slug: 'one-img', images: ['https://static.wixstatic.com/media/a.jpg'] })];
    const result = auditCatalogImages(products);
    expect(result.coverage.oneImage).toBe(1);
    expect(result.flaggedProducts).toHaveLength(1);
    expect(result.flaggedProducts[0].issue).toBe('SINGLE_IMAGE');
  });

  it('flags products below minimum (2 images)', () => {
    const products = [makeProduct({ slug: 'two-img', images: [
      'https://static.wixstatic.com/media/a.jpg',
      'https://static.wixstatic.com/media/b.jpg',
    ] })];
    const result = auditCatalogImages(products);
    expect(result.coverage.belowMinimum).toBe(1);
    expect(result.flaggedProducts[0].issue).toBe('BELOW_MINIMUM');
  });

  it('classifies adequate products (3-4 images)', () => {
    const products = [makeProduct()]; // 3 images
    const result = auditCatalogImages(products);
    expect(result.coverage.adequate).toBe(1);
    expect(result.flaggedProducts).toHaveLength(0);
  });

  it('classifies ideal products (5+ images)', () => {
    const products = [makeProduct({ images: [
      'https://static.wixstatic.com/media/a.jpg',
      'https://static.wixstatic.com/media/b.jpg',
      'https://static.wixstatic.com/media/c.jpg',
      'https://static.wixstatic.com/media/d.jpg',
      'https://static.wixstatic.com/media/e.jpg',
    ] })];
    const result = auditCatalogImages(products);
    expect(result.coverage.ideal).toBe(1);
  });

  it('classifies URL types correctly', () => {
    const products = [makeProduct({ images: [
      'https://static.wixstatic.com/media/e04e89_abc~mv2.jpg',
      'wix:image://v1/abc123/file.jpg',
      'https://example.com/image.jpg',
    ] })];
    const result = auditCatalogImages(products);
    expect(result.urlTypes.wixstatic).toBe(1);
    expect(result.urlTypes['wix-image']).toBe(1);
    expect(result.urlTypes.external).toBe(1);
  });

  it('detects duplicate image URLs', () => {
    const url = 'https://static.wixstatic.com/media/e04e89_abc~mv2.jpg';
    const products = [
      makeProduct({ slug: 'p1', images: [url] }),
      makeProduct({ slug: 'p2', images: [url] }),
    ];
    const result = auditCatalogImages(products);
    expect(result.duplicateUrls.length).toBeGreaterThan(0);
  });

  it('computes category breakdown', () => {
    const products = [
      makeProduct({ category: 'futon-frames', images: ['https://static.wixstatic.com/media/a.jpg'] }),
      makeProduct({ slug: 's', category: 'futon-frames', images: ['https://static.wixstatic.com/media/b.jpg', 'https://static.wixstatic.com/media/c.jpg'] }),
      makeProduct({ slug: 'm', category: 'mattresses', images: ['https://static.wixstatic.com/media/d.jpg'] }),
    ];
    const result = auditCatalogImages(products);
    expect(result.categoryBreakdown['futon-frames'].products).toBe(2);
    expect(result.categoryBreakdown['futon-frames'].totalImages).toBe(3);
    expect(result.categoryBreakdown['futon-frames'].avgImages).toBe(1.5);
    expect(result.categoryBreakdown['mattresses'].products).toBe(1);
  });

  it('computes average images per product', () => {
    const products = [
      makeProduct({ images: ['https://static.wixstatic.com/media/a.jpg', 'https://static.wixstatic.com/media/b.jpg'] }),
      makeProduct({ slug: 's', images: ['https://static.wixstatic.com/media/c.jpg', 'https://static.wixstatic.com/media/d.jpg', 'https://static.wixstatic.com/media/e.jpg', 'https://static.wixstatic.com/media/f.jpg'] }),
    ];
    const result = auditCatalogImages(products);
    expect(result.avgImagesPerProduct).toBe(3);
  });

  it('handles products with missing images field', () => {
    const products = [{ name: 'No images field', slug: 'no-field', category: 'futon-frames' }];
    const result = auditCatalogImages(products);
    expect(result.coverage.noImages).toBe(1);
    expect(result.totalImages).toBe(0);
  });
});

// ── getImagePipelineStatus ──────────────────────────────────────────

describe('getImagePipelineStatus', () => {
  it('returns error for non-array input', () => {
    const result = getImagePipelineStatus(null);
    expect(result.success).toBe(false);
  });

  it('reports all products with images on Wix CDN', () => {
    const products = [
      makeProduct(),
      makeProduct({ slug: 's', images: ['https://static.wixstatic.com/media/x.jpg'] }),
    ];
    const result = getImagePipelineStatus(products);
    expect(result.success).toBe(true);
    expect(result.productsWithImages).toBe(2);
    expect(result.productsWithoutImages).toBe(0);
    expect(result.allImagesOnWixCdn).toBe(true);
    expect(result.readyForImport).toBe(true);
  });

  it('detects non-CDN images', () => {
    const products = [
      makeProduct({ images: ['https://example.com/image.jpg'] }),
    ];
    const result = getImagePipelineStatus(products);
    expect(result.allImagesOnWixCdn).toBe(false);
    expect(result.readyForImport).toBe(false);
  });

  it('detects missing images', () => {
    const products = [
      makeProduct(),
      makeProduct({ slug: 'empty', images: [] }),
    ];
    const result = getImagePipelineStatus(products);
    expect(result.productsWithImages).toBe(1);
    expect(result.productsWithoutImages).toBe(1);
    expect(result.readyForImport).toBe(false);
  });

  it('computes correct totals', () => {
    const products = [
      makeProduct({ images: ['https://static.wixstatic.com/media/a.jpg', 'https://static.wixstatic.com/media/b.jpg'] }),
      makeProduct({ slug: 's', images: ['https://static.wixstatic.com/media/c.jpg'] }),
    ];
    const result = getImagePipelineStatus(products);
    expect(result.totalProducts).toBe(2);
    expect(result.totalImageUrls).toBe(3);
    expect(result.avgImagesPerProduct).toBe(1.5);
  });
});
