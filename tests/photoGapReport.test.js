/**
 * @file photoGapReport.test.js
 * @description Tests for the photo gap report module (cf-taha).
 *
 * Covers:
 *  - Report generation with per-category image averages
 *  - Threshold flagging (categories below threshold)
 *  - Under-photographed product identification
 *  - Edge cases: empty products, no images, single category
 *  - AuditLog integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';
import { generatePhotoGapReport } from '../src/backend/photoGapReport.web.js';

beforeEach(() => {
  __reset();
});

// ── Test fixtures ─────────────────────────────────────────────────────

const WELL_PHOTOGRAPHED = [
  { name: 'Eureka Frame', sku: 'EUR-001', category: 'futon-frames', images: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg'] },
  { name: 'Monterey Frame', sku: 'MON-001', category: 'futon-frames', images: ['a.jpg', 'b.jpg', 'c.jpg'] },
  { name: 'Murphy Express', sku: 'MUR-001', category: 'murphy-cabinet-beds', images: ['a.jpg', 'b.jpg', 'c.jpg', 'd.jpg', 'e.jpg', 'f.jpg'] },
];

const UNDER_PHOTOGRAPHED = [
  { name: 'Mesa 1000', sku: 'MES-001', category: 'mattresses', images: ['a.jpg'] },
  { name: 'Mesa 3000', sku: 'MES-003', category: 'mattresses', images: ['a.jpg'] },
  { name: 'Pulsar', sku: 'PUL-001', category: 'mattresses', images: ['a.jpg', 'b.jpg'] },
];

const MIXED_PRODUCTS = [...WELL_PHOTOGRAPHED, ...UNDER_PHOTOGRAPHED];

// ── Report generation ────────────────────────────────────────────────

describe('generatePhotoGapReport', () => {
  it('generates a report with per-category breakdown', async () => {
    const result = await generatePhotoGapReport({ products: MIXED_PRODUCTS });
    expect(result.success).toBe(true);
    expect(result.report.totalProducts).toBe(6);
    expect(result.report.categories).toHaveLength(3);
  });

  it('computes correct image averages per category', async () => {
    const result = await generatePhotoGapReport({ products: MIXED_PRODUCTS });
    const categories = result.report.categories;

    const mattresses = categories.find(c => c.category === 'mattresses');
    expect(mattresses.products).toBe(3);
    expect(mattresses.images).toBe(4);
    expect(mattresses.avg).toBe(1.3);

    const futons = categories.find(c => c.category === 'futon-frames');
    expect(futons.products).toBe(2);
    expect(futons.images).toBe(7);
    expect(futons.avg).toBe(3.5);

    const murphy = categories.find(c => c.category === 'murphy-cabinet-beds');
    expect(murphy.products).toBe(1);
    expect(murphy.images).toBe(6);
    expect(murphy.avg).toBe(6);
  });

  it('flags categories below threshold', async () => {
    const result = await generatePhotoGapReport({ products: MIXED_PRODUCTS, threshold: 3.0 });
    const flagged = result.report.flaggedCategories;
    expect(flagged).toHaveLength(1);
    expect(flagged[0].category).toBe('mattresses');
  });

  it('uses default threshold of 3.0', async () => {
    const result = await generatePhotoGapReport({ products: MIXED_PRODUCTS });
    expect(result.report.threshold).toBe(3.0);
  });

  it('custom threshold flags more categories', async () => {
    const result = await generatePhotoGapReport({ products: MIXED_PRODUCTS, threshold: 5.0 });
    const flagged = result.report.flaggedCategories;
    // All three categories are below 5.0 avg: mattresses (1.3), futons (3.5), murphy is 6.0 so passes
    expect(flagged).toHaveLength(2);
    expect(flagged.map(c => c.category)).toContain('mattresses');
    expect(flagged.map(c => c.category)).toContain('futon-frames');
  });

  it('sorts categories by avg ascending (worst first)', async () => {
    const result = await generatePhotoGapReport({ products: MIXED_PRODUCTS });
    const avgs = result.report.categories.map(c => c.avg);
    for (let i = 1; i < avgs.length; i++) {
      expect(avgs[i]).toBeGreaterThanOrEqual(avgs[i - 1]);
    }
  });

  it('computes overall average', async () => {
    const result = await generatePhotoGapReport({ products: MIXED_PRODUCTS });
    // Total: 4+3+6+1+1+2 = 17 images, 6 products => 2.8
    expect(result.report.overallAvg).toBe(2.8);
  });

  it('identifies under-photographed products within flagged categories', async () => {
    const result = await generatePhotoGapReport({ products: MIXED_PRODUCTS, threshold: 3.0 });
    const mattresses = result.report.flaggedCategories[0];
    expect(mattresses.underPhotographed).toHaveLength(3);
    expect(mattresses.underPhotographed[0].name).toBe('Mesa 1000');
    expect(mattresses.underPhotographed[0].deficit).toBe(2); // needs 3, has 1
  });

  it('includes generatedAt timestamp', async () => {
    const result = await generatePhotoGapReport({ products: WELL_PHOTOGRAPHED });
    expect(result.report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('logs to AuditLog', async () => {
    await generatePhotoGapReport({ products: MIXED_PRODUCTS });
    const audits = __getInserted('AuditLog');
    expect(audits).toHaveLength(1);
    expect(audits[0].collection).toBe('PhotoGapReport');
    expect(audits[0].action).toBe('generate');
  });
});

// ── Edge cases ───────────────────────────────────────────────────────

describe('generatePhotoGapReport edge cases', () => {
  it('returns error for empty products array', async () => {
    const result = await generatePhotoGapReport({ products: [] });
    expect(result.success).toBe(false);
  });

  it('handles products with no images array', async () => {
    const noImages = [
      { name: 'No Images', sku: 'NI-001', category: 'test', images: undefined },
      { name: 'Empty Images', sku: 'EI-001', category: 'test', images: [] },
    ];
    const result = await generatePhotoGapReport({ products: noImages });
    expect(result.success).toBe(true);
    expect(result.report.categories[0].images).toBe(0);
    expect(result.report.categories[0].avg).toBe(0);
  });

  it('handles products with no category', async () => {
    const noCat = [
      { name: 'Orphan', sku: 'ORP-001', images: ['a.jpg'] },
    ];
    const result = await generatePhotoGapReport({ products: noCat });
    expect(result.success).toBe(true);
    expect(result.report.categories[0].category).toBe('uncategorized');
  });

  it('all categories pass when all have good coverage', async () => {
    const result = await generatePhotoGapReport({ products: WELL_PHOTOGRAPHED });
    expect(result.report.flaggedCategories).toHaveLength(0);
  });

  it('single product single category', async () => {
    const single = [{ name: 'Solo', sku: 'S-001', category: 'covers', images: ['a.jpg', 'b.jpg'] }];
    const result = await generatePhotoGapReport({ products: single, threshold: 3.0 });
    expect(result.success).toBe(true);
    expect(result.report.totalProducts).toBe(1);
    expect(result.report.flaggedCategories).toHaveLength(1);
    expect(result.report.flaggedCategories[0].avg).toBe(2);
  });
});
