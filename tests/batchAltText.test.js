/**
 * Tests for backend/batchAltText.web.js
 * Covers: brand detection, category detection, alt text generation,
 * batch update with dry-run/force, product preview, error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wix-stores-backend ─────────────────────────────────────────

const mockProducts = [];
const mockUpdateCalls = [];

vi.mock('wix-stores-backend', () => ({
  products: {
    queryProducts: vi.fn(() => ({
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn(async () => ({ items: mockProducts })),
    })),
    updateProductFields: vi.fn(async (id, fields) => {
      mockUpdateCalls.push({ id, fields });
    }),
    getProduct: vi.fn(async (id) => mockProducts.find((p) => p._id === id) || null),
  },
}));

import { products as storeMock } from 'wix-stores-backend';
import {
  runBatchAltTextUpdate,
  previewProductAltText,
} from '../src/backend/batchAltText.web.js';

// ── Test Data ───────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-1',
    name: 'Kingston Futon Frame',
    collections: [{ slug: 'futon-frames' }],
    mediaItems: [
      { src: 'https://example.com/main.jpg', title: '', altText: '' },
      { src: 'https://example.com/side-view.jpg', title: '', altText: '' },
    ],
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('batchAltText — runBatchAltTextUpdate', () => {
  beforeEach(() => {
    mockProducts.length = 0;
    mockUpdateCalls.length = 0;
    vi.clearAllMocks();
  });

  it('updates products with missing alt text', async () => {
    mockProducts.push(makeProduct());
    const result = await runBatchAltTextUpdate();
    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockUpdateCalls.length).toBe(1);
  });

  it('skips products with existing alt text >= 10 chars', async () => {
    mockProducts.push(makeProduct({
      mediaItems: [
        { src: 'img.jpg', title: 'A descriptive alt text here' },
      ],
    }));
    const result = await runBatchAltTextUpdate();
    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
  });

  it('force mode overwrites existing alt text', async () => {
    mockProducts.push(makeProduct({
      mediaItems: [
        { src: 'img.jpg', title: 'Existing alt text value' },
      ],
    }));
    const result = await runBatchAltTextUpdate({ force: true });
    expect(result.updated).toBe(1);
  });

  it('dry run generates previews without writing', async () => {
    mockProducts.push(makeProduct());
    const result = await runBatchAltTextUpdate({ dryRun: true });
    expect(result.updated).toBe(1);
    expect(result.previews.length).toBe(1);
    expect(result.previews[0].name).toBe('Kingston Futon Frame');
    expect(mockUpdateCalls.length).toBe(0);
  });

  it('skips products with no media items', async () => {
    mockProducts.push(makeProduct({ mediaItems: [] }));
    const result = await runBatchAltTextUpdate();
    expect(result.skipped).toBe(1);
  });

  it('handles errors per product gracefully', async () => {
    storeMock.updateProductFields.mockRejectedValueOnce(new Error('API limit'));
    mockProducts.push(makeProduct());

    const result = await runBatchAltTextUpdate();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('API limit');
  });

  it('reports query failure in errors array', async () => {
    storeMock.queryProducts.mockReturnValueOnce({
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      find: vi.fn().mockRejectedValueOnce(new Error('Network timeout')),
    });

    const result = await runBatchAltTextUpdate();
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('Query failed');
    expect(result.errors[0]).toContain('Network timeout');
  });

  it('paginates when first batch returns limit items', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => makeProduct({
      _id: `prod-${i}`,
      name: `Product ${i}`,
    }));
    const page2 = [makeProduct({ _id: 'prod-100', name: 'Product 100' })];

    let callCount = 0;
    // Use two chained mockReturnValueOnce to simulate 2 pages
    storeMock.queryProducts
      .mockReturnValueOnce({
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        find: vi.fn(async () => ({ items: page1 })),
      })
      .mockReturnValueOnce({
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        find: vi.fn(async () => ({ items: page2 })),
      });

    const result = await runBatchAltTextUpdate({ dryRun: true });
    expect(result.updated).toBe(101);
    expect(storeMock.queryProducts).toHaveBeenCalledTimes(2);
  });
});

describe('batchAltText — alt text generation', () => {
  beforeEach(() => {
    mockProducts.length = 0;
    mockUpdateCalls.length = 0;
    vi.clearAllMocks();
  });

  it('includes brand for Night & Day products (default)', async () => {
    mockProducts.push(makeProduct({
      collections: [{ slug: 'some-collection' }],
    }));
    const result = await runBatchAltTextUpdate({ dryRun: true });
    const alts = result.previews[0].alts;
    expect(alts[0]).toContain('Night & Day');
  });

  it('detects KD Frames brand from unfinished collection', async () => {
    mockProducts.push(makeProduct({
      name: 'Nomad Platform Bed',
      collections: [{ slug: 'unfinished-frames' }],
    }));
    const result = await runBatchAltTextUpdate({ dryRun: true });
    expect(result.previews[0].alts[0]).toContain('KD Frames');
  });

  it('detects Otis Bed brand from mattress collection', async () => {
    mockProducts.push(makeProduct({
      name: 'Haley Mattress',
      collections: [{ slug: 'mattress' }],
    }));
    const result = await runBatchAltTextUpdate({ dryRun: true });
    expect(result.previews[0].alts[0]).toContain('Otis Bed');
  });

  it('detects category from collection slugs', async () => {
    mockProducts.push(makeProduct({
      name: 'Montana',
      collections: [{ slug: 'murphy-beds' }],
    }));
    const result = await runBatchAltTextUpdate({ dryRun: true });
    expect(result.previews[0].alts[0]).toContain('Murphy Cabinet Bed');
  });

  it('uses position labels for first 4 images', async () => {
    mockProducts.push(makeProduct({
      mediaItems: [
        { src: 'img1.jpg', title: '' },
        { src: 'img2.jpg', title: '' },
        { src: 'img3.jpg', title: '' },
        { src: 'img4.jpg', title: '' },
      ],
    }));
    const result = await runBatchAltTextUpdate({ dryRun: true });
    const alts = result.previews[0].alts;
    expect(alts[0]).toContain('Main Product Image');
    expect(alts[1]).toContain('Alternate View');
    expect(alts[2]).toContain('Detail View');
    expect(alts[3]).toContain('Additional View');
  });

  it('uses View N for images beyond position 4', async () => {
    mockProducts.push(makeProduct({
      mediaItems: Array.from({ length: 6 }, (_, i) => ({
        src: `img${i}.jpg`, title: '',
      })),
    }));
    const result = await runBatchAltTextUpdate({ dryRun: true });
    expect(result.previews[0].alts[4]).toContain('View 5');
  });

  it('detects image context from URL keywords', async () => {
    mockProducts.push(makeProduct({
      mediaItems: [
        { src: 'lifestyle-room-shot.jpg', title: '' },
        { src: 'detail-closeup.jpg', title: '' },
        { src: 'dimension-spec.jpg', title: '' },
      ],
    }));
    const result = await runBatchAltTextUpdate({ dryRun: true });
    const alts = result.previews[0].alts;
    expect(alts[0]).toContain('Lifestyle Room Setting');
    expect(alts[1]).toContain('Detail Close-up');
    expect(alts[2]).toContain('Dimensions Diagram');
  });

  it('truncates alt text longer than 125 characters', async () => {
    mockProducts.push(makeProduct({
      name: 'The Most Incredibly Long Product Name That Could Possibly Exist In Our Store Featuring The Best Quality Materials',
      collections: [{ slug: 'futon-frames' }],
    }));
    const result = await runBatchAltTextUpdate({ dryRun: true });
    for (const alt of result.previews[0].alts) {
      expect(alt.length).toBeLessThanOrEqual(125);
    }
  });

  it('does not duplicate brand when product name starts with brand', async () => {
    mockProducts.push(makeProduct({
      name: 'Night & Day Furniture Kingston Frame',
      collections: [{ slug: 'futons' }],
    }));
    const result = await runBatchAltTextUpdate({ dryRun: true });
    const alt = result.previews[0].alts[0];
    // Brand is skipped when name starts with it, so only one occurrence
    const count = (alt.match(/Night & Day/g) || []).length;
    expect(count).toBe(1);
  });
});

describe('batchAltText — previewProductAltText', () => {
  beforeEach(() => {
    mockProducts.length = 0;
    vi.clearAllMocks();
  });

  it('returns alt text preview for a product', async () => {
    mockProducts.push(makeProduct());
    const result = await previewProductAltText('prod-1');
    expect(result.name).toBe('Kingston Futon Frame');
    expect(result.brand).toBeTruthy();
    expect(result.category).toBeTruthy();
    expect(result.media.length).toBe(2);
    expect(result.media[0].newAlt.length).toBeGreaterThan(10);
  });

  it('returns error for nonexistent product', async () => {
    const result = await previewProductAltText('nonexistent');
    expect(result.error).toBeTruthy();
  });

  it('shows current vs new alt text', async () => {
    mockProducts.push(makeProduct({
      mediaItems: [{ src: 'img.jpg', title: 'Old alt text' }],
    }));
    const result = await previewProductAltText('prod-1');
    expect(result.media[0].currentAlt).toBe('Old alt text');
    expect(result.media[0].newAlt).not.toBe('Old alt text');
  });

  it('handles product with no media', async () => {
    mockProducts.push(makeProduct({ mediaItems: [] }));
    const result = await previewProductAltText('prod-1');
    expect(result.media.length).toBe(0);
  });
});
