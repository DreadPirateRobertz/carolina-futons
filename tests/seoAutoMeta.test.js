/**
 * @file seoAutoMeta.test.js
 * @description Tests for seoAutoMeta.web.js — CF-z5jm
 * Covers: generateMetaDescription (pure function), getProductMetaDescription,
 * and backfillProductMetaDescriptions.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';

import {
  generateMetaDescription,
  getProductMetaDescription,
  backfillProductMetaDescriptions,
} from '../src/backend/seoAutoMeta.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-1',
    name: 'Monterey Futon Frame',
    slug: 'monterey-futon-frame',
    collections: ['futon-frames'],
    price: 549,
    discountedPrice: null,
    visible: true,
    ...overrides,
  };
}

beforeEach(() => {
  __reset();
  __seed('ProductMetaDescriptions', []);
  __seed('Stores/Products', []);
});

// ── generateMetaDescription — pure function ───────────────────────────────────

describe('generateMetaDescription', () => {
  it('includes the product name in the description', () => {
    const desc = generateMetaDescription(makeProduct({ name: 'Monterey Futon Frame' }));
    expect(desc).toContain('Monterey Futon Frame');
  });

  it('includes the brand', () => {
    const desc = generateMetaDescription(makeProduct({ collections: ['wall-hugger-frames'] }));
    expect(desc).toContain('Strata Furniture');
  });

  it('uses Night & Day Furniture for standard frames', () => {
    const desc = generateMetaDescription(makeProduct({ collections: ['futon-frames'] }));
    expect(desc).toContain('Night & Day Furniture');
  });

  it('includes category descriptor for futon frames', () => {
    const desc = generateMetaDescription(makeProduct({ collections: ['futon-frames'] }));
    expect(desc).toContain('futon frame');
  });

  it('includes category descriptor for mattresses', () => {
    const desc = generateMetaDescription(makeProduct({ collections: ['mattresses'] }));
    expect(desc).toContain('mattress');
  });

  it('includes category descriptor for murphy beds', () => {
    const desc = generateMetaDescription(makeProduct({ collections: ['murphy-cabinet-beds'] }));
    expect(desc).toContain('murphy');
  });

  it('includes category descriptor for platform beds', () => {
    const desc = generateMetaDescription(makeProduct({ collections: ['platform-beds'] }));
    expect(desc).toContain('platform bed');
  });

  it('includes category descriptor for covers', () => {
    const desc = generateMetaDescription(makeProduct({ collections: ['covers'] }));
    expect(desc).toContain('cover');
  });

  it('includes category descriptor for outdoor furniture', () => {
    const desc = generateMetaDescription(makeProduct({ collections: ['outdoor-furniture'] }));
    expect(desc).toContain('outdoor');
  });

  it('includes category descriptor for pillows', () => {
    const desc = generateMetaDescription(makeProduct({ collections: ['pillows'] }));
    expect(desc).toContain('pillow');
  });

  it('mentions Carolina Futons store name', () => {
    const desc = generateMetaDescription(makeProduct());
    expect(desc).toContain('Carolina Futons');
  });

  it('includes price hint when price > 0', () => {
    const desc = generateMetaDescription(makeProduct({ price: 549 }));
    expect(desc).toContain('549');
  });

  it('uses discountedPrice when present', () => {
    const desc = generateMetaDescription(makeProduct({ price: 599, discountedPrice: 449 }));
    expect(desc).toContain('449');
    expect(desc).not.toContain('599');
  });

  it('omits price hint when price is 0', () => {
    const desc = generateMetaDescription(makeProduct({ price: 0, discountedPrice: null }));
    expect(desc).not.toMatch(/\$0/);
  });

  it('returns a fallback for null product', () => {
    const desc = generateMetaDescription(null);
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });

  it('returns a fallback for product with no name', () => {
    const desc = generateMetaDescription({ collections: [] });
    expect(typeof desc).toBe('string');
    expect(desc).toContain('Carolina Futons');
  });

  it('caps output at 155 characters', () => {
    const longName = 'Ultra Premium Deluxe Monterey Hardwood Solid Oak Convertible Futon Frame With Extended Armrests Edition';
    const desc = generateMetaDescription(makeProduct({ name: longName, price: 1299 }));
    expect(desc.length).toBeLessThanOrEqual(155);
  });

  it('appends ellipsis when truncated', () => {
    const longName = 'Ultra Premium Deluxe Monterey Hardwood Solid Oak Convertible Futon Frame With Extended Armrests Edition';
    const desc = generateMetaDescription(makeProduct({ name: longName }));
    if (desc.length === 155) {
      expect(desc).toMatch(/…$/);
    }
  });

  it('strips HTML tags from product name (XSS safety)', () => {
    const desc = generateMetaDescription(makeProduct({ name: '<script>alert(1)</script>Futon' }));
    // Tags must be stripped — text content of the tag is harmless plain text
    expect(desc).not.toContain('<script>');
    expect(desc).not.toContain('</script>');
    expect(desc).toContain('Futon');
  });

  it('strips injected attribute-breaking characters from product name', () => {
    const desc = generateMetaDescription(makeProduct({ name: 'Futon"><img src=x onerror=alert(1)>' }));
    expect(desc).not.toContain('<img');
    expect(desc).not.toContain('onerror');
  });

  it('strips HTML entities from product name', () => {
    const desc = generateMetaDescription(makeProduct({ name: 'Bed &amp; Frame' }));
    expect(desc).not.toContain('&amp;');
  });

  it('handles products with no collections', () => {
    const desc = generateMetaDescription(makeProduct({ collections: null }));
    expect(typeof desc).toBe('string');
    expect(desc.length).toBeGreaterThan(0);
  });
});

// ── getProductMetaDescription ─────────────────────────────────────────────────

describe('getProductMetaDescription', () => {
  it('returns saved description when one exists', async () => {
    __seed('ProductMetaDescriptions', [{
      _id: 'md-1',
      productId: 'prod-1',
      description: 'Saved custom description.',
      generatedAt: new Date(),
    }]);

    const result = await getProductMetaDescription('prod-1');
    expect(result.success).toBe(true);
    expect(result.description).toBe('Saved custom description.');
    expect(result.source).toBe('saved');
  });

  it('generates description when no saved entry exists', async () => {
    __seed('Stores/Products', [makeProduct({ _id: 'prod-1' })]);

    const result = await getProductMetaDescription('prod-1');
    expect(result.success).toBe(true);
    expect(result.description).toContain('Carolina Futons');
    expect(result.source).toBe('generated');
  });

  it('returns error for missing productId', async () => {
    const result = await getProductMetaDescription('');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for null productId', async () => {
    const result = await getProductMetaDescription(null);
    expect(result.success).toBe(false);
  });

  it('returns fallback description when product not found in Stores/Products', async () => {
    // No product seeded — get() returns null
    const result = await getProductMetaDescription('nonexistent');
    expect(result.success).toBe(true);
    expect(typeof result.description).toBe('string');
    expect(result.source).toBe('generated');
  });

  it('returns error on DB query failure', async () => {
    __setQueryError('ProductMetaDescriptions', new Error('DB down'));
    const result = await getProductMetaDescription('prod-1');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── backfillProductMetaDescriptions ──────────────────────────────────────────

describe('backfillProductMetaDescriptions', () => {
  it('generates descriptions for all visible products with no saved entry', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', visible: true }),
      makeProduct({ _id: 'p2', visible: true, name: 'Murphy Bed' }),
    ]);

    const result = await backfillProductMetaDescriptions();
    expect(result.success).toBe(true);
    expect(result.generated).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('skips products that already have a saved description', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', visible: true }),
      makeProduct({ _id: 'p2', visible: true }),
    ]);
    __seed('ProductMetaDescriptions', [
      { _id: 'md-1', productId: 'p1', description: 'Existing.', generatedAt: new Date() },
    ]);

    const result = await backfillProductMetaDescriptions();
    expect(result.success).toBe(true);
    expect(result.generated).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('inserts a record into ProductMetaDescriptions for each new product', async () => {
    __seed('Stores/Products', [makeProduct({ _id: 'p1', visible: true })]);

    await backfillProductMetaDescriptions();

    const inserted = __getInserted('ProductMetaDescriptions');
    const newEntry = inserted.find(i => i.productId === 'p1');
    expect(newEntry).toBeDefined();
    expect(newEntry.description).toContain('Carolina Futons');
    expect(newEntry.generatedAt).toBeInstanceOf(Date);
  });

  it('returns success=true with zero counts when no products exist', async () => {
    __seed('Stores/Products', []);
    const result = await backfillProductMetaDescriptions();
    expect(result.success).toBe(true);
    expect(result.generated).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('returns error on DB failure', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const result = await backfillProductMetaDescriptions();
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
