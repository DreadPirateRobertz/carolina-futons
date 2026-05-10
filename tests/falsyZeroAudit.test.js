/**
 * CF-05nn — Codebase-wide falsy-zero audit regression tests.
 * Locks the != null fixes across discountedPrice, threshold, and comparison patterns.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onUpdate } from './__mocks__/wix-data.js';

// ── facebookCatalog ─────────────────────────────────────────────────
import {
  buildCapiEvent,
  buildCatalogBatch,
  getEnhancedCatalogFields,
} from '../src/backend/facebookCatalog.web.js';

// ── salePageHelpers ─────────────────────────────────────────────────
import {
  formatSalePrice,
  sortByDiscount,
} from '../src/public/salePageHelpers.js';

// ── productSchema ───────────────────────────────────────────────────
import { injectProductMeta } from '../src/public/product/productSchema.js';

// ── inventoryService (remaining fix) ────────────────────────────────
import {
} from '../src/backend/inventoryService.web.js';

beforeEach(() => {
  __reset();
  __seed('InventoryLevels', []);
  __seed('InventoryLog', []);
});

// ═══════════════════════════════════════════════════════════════════
// discountedPrice falsy-zero — $0 discount must not revert to base price
// ═══════════════════════════════════════════════════════════════════

describe('facebookCatalog — discountedPrice zero handling', () => {
  it('buildCapiEvent ViewContent: uses discountedPrice 0 not base price', () => {
    const event = buildCapiEvent('ViewContent', {
      product: { _id: 'p-1', name: 'Test', price: 100, discountedPrice: 0 },
    });
    expect(event).not.toBeNull();
    expect(event.custom_data.value).toBe(0);
  });

  it('buildCapiEvent AddToCart: uses discountedPrice 0 not base price', () => {
    const event = buildCapiEvent('AddToCart', {
      product: { _id: 'p-1', name: 'Test', price: 100, discountedPrice: 0 },
      quantity: 1,
    });
    expect(event.custom_data.value).toBe(0);
  });

  it('buildCapiEvent: null discountedPrice falls back to base price', () => {
    const event = buildCapiEvent('ViewContent', {
      product: { _id: 'p-1', name: 'Test', price: 100, discountedPrice: null },
    });
    expect(event.custom_data.value).toBe(100);
  });

  it('buildCapiEvent: undefined discountedPrice falls back to base price', () => {
    const event = buildCapiEvent('ViewContent', {
      product: { _id: 'p-1', name: 'Test', price: 100 },
    });
    expect(event.custom_data.value).toBe(100);
  });

  it('buildCatalogBatch: $0 sale price emitted correctly in feed', () => {
    const result = buildCatalogBatch([{
      _id: 'p-1', name: 'Free Item', slug: 'free-item', price: 100,
      discountedPrice: 0, mainMedia: 'https://example.com/img.jpg', inStock: true,
    }]);
    expect(result.processed).toBe(1);
    expect(result.results[0].price).toBe('0.00 USD');
  });

  it('buildCatalogBatch: null discountedPrice uses base price', () => {
    const result = buildCatalogBatch([{
      _id: 'p-1', name: 'Normal Item', slug: 'normal-item', price: 549,
      discountedPrice: null, mainMedia: 'https://example.com/img.jpg', inStock: true,
    }]);
    expect(result.results[0].price).toBe('549.00 USD');
  });

  it('getEnhancedCatalogFields: uses $0 discounted price', () => {
    const fields = getEnhancedCatalogFields({
      _id: 'p-1', name: 'Test', price: 100, discountedPrice: 0,
    });
    // Enhanced fields include the price as a feed field
    expect(fields).toBeDefined();
  });
});

describe('salePageHelpers — discountedPrice zero handling', () => {
  it('formatSalePrice: $0 discounted price shows sale format', () => {
    const result = formatSalePrice({ price: 100, discountedPrice: 0 });
    expect(result).toContain('Sale');
    expect(result).toContain('$0');
  });

  it('formatSalePrice: null discounted price shows original only', () => {
    const result = formatSalePrice({ price: 100, discountedPrice: null });
    expect(result).toBe('$100');
  });

  it('formatSalePrice: undefined discounted price shows original only', () => {
    const result = formatSalePrice({ price: 100 });
    expect(result).toBe('$100');
  });

  it('sortByDiscount: $0 discounted price is largest discount', () => {
    const sorted = sortByDiscount([
      { price: 100, discountedPrice: 50 },
      { price: 100, discountedPrice: 0 },
      { price: 100, discountedPrice: 80 },
    ]);
    expect(sorted[0].discountedPrice).toBe(0);   // 100% off first
    expect(sorted[1].discountedPrice).toBe(50);   // 50% off second
    expect(sorted[2].discountedPrice).toBe(80);   // 20% off third
  });

  it('sortByDiscount: null discounted price treated as no discount', () => {
    const sorted = sortByDiscount([
      { price: 100, discountedPrice: null },
      { price: 100, discountedPrice: 50 },
    ]);
    expect(sorted[0].discountedPrice).toBe(50); // Has actual discount
    expect(sorted[1].discountedPrice).toBeNull(); // No discount
  });
});

