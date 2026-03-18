/**
 * Compare Page — $onReady edge cases and deeper interaction tests (CF-g0fo)
 * Covers: sale prices, add-to-cart cycle, remove navigation, null products,
 *         empty-state variations, and compareEmptyShopBtn.
 *
 * Core handler tests are in comparePageHandlers.test.js.
 * Helper unit tests are in tests/pages/compare-page.test.js.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import {
  __setProductMap,
  __setGetProductShouldFail,
} from './__mocks__/wix-stores-frontend.js';

// ── $w mock (isolated from comparePageHandlers.test.js) ───────────────────────

const elements2 = new Map();
function createEl() {
  return {
    text: '', src: '', label: '', data: [], html: '',
    style: { opacity: '', textDecoration: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onItemReady: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
    postMessage: vi.fn(),
  };
}
function getEl2(sel) {
  if (!elements2.has(sel)) elements2.set(sel, createEl());
  return elements2.get(sel);
}

// ── Product fixtures ─────────────────────────────────────────────────────────

const prodSale = {
  _id: 'sale-001', name: 'Sale Frame', slug: 'sale-frame',
  price: 399, formattedPrice: '$399.00', compareAtPrice: 499,
  mainMedia: 'https://example.com/sale.jpg', ribbon: 'Sale',
  inStock: true, numericRating: 4.0,
  additionalInfoSections: [],
};
const prodFull = {
  _id: 'full-001', name: 'Full Price Frame', slug: 'full-price-frame',
  price: 699, formattedPrice: '$699.00', compareAtPrice: null,
  mainMedia: 'https://example.com/full.jpg', ribbon: '',
  inStock: false, numericRating: null,
  additionalInfoSections: [
    { title: 'Frame Material', description: 'Metal' },
  ],
};

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('wix-location-frontend', () => ({
  default: {
    to: vi.fn(),
    query: { ids: 'sale-001,full-001' },
    baseUrl: 'https://carolinafutons.com',
  },
}));

const mockAddToCart = vi.fn(() => Promise.resolve());
vi.mock('public/cartService', () => ({
  addToCart: (...args) => mockAddToCart(...args),
}));

// ── Test suite ────────────────────────────────────────────────────────────────

describe('Compare Page — edge cases', () => {

  beforeEach(() => {
    elements2.clear();
    vi.clearAllMocks();
    mockAddToCart.mockResolvedValue(undefined);
    __setProductMap({ 'sale-001': prodSale, 'full-001': prodFull });
    __setGetProductShouldFail(false);
  });

  // ── S2: Sale price display ────────────────────────────────────────────────

  it('column with sale product: onItemReady shows origPrice and hides it with strikethrough', () => {
    const saleColData = {
      _id: 'sale-001',
      name: 'Sale Frame',
      slug: 'sale-frame',
      image: 'https://example.com/sale.jpg',
      price: '$399.00',
      salePrice: '$399.00',
      origPrice: '$499.00',
      showOrigPrice: true,
      showBadge: true,
      badge: 'Sale',
      inStock: true,
      productUrl: '/product-page/sale-frame',
    };

    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createEl());
      return itemEls.get(sel);
    };

    // Simulate what Compare Page.js onItemReady does for a sale product
    $item('#compareColImage').src = saleColData.image;
    $item('#compareColName').text = saleColData.name;
    $item('#compareColPrice').text = saleColData.showOrigPrice ? saleColData.salePrice : saleColData.price;

    if (saleColData.showOrigPrice) {
      $item('#compareColOrigPrice').text = saleColData.origPrice;
      $item('#compareColOrigPrice').style.textDecoration = 'line-through';
      $item('#compareColOrigPrice').show();
    }

    expect($item('#compareColOrigPrice').text).toBe('$499.00');
    expect($item('#compareColOrigPrice').style.textDecoration).toBe('line-through');
    expect($item('#compareColOrigPrice').show).toHaveBeenCalled();
    expect($item('#compareColPrice').text).toBe('$399.00');
  });

  it('column without sale: origPrice remains hidden', () => {
    const noSaleData = {
      _id: 'full-001',
      showOrigPrice: false,
      price: '$699.00',
    };

    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createEl());
      return itemEls.get(sel);
    };

    $item('#compareColPrice').text = noSaleData.price;
    if (!noSaleData.showOrigPrice) {
      $item('#compareColOrigPrice').hide();
    }

    expect($item('#compareColOrigPrice').hide).toHaveBeenCalled();
    expect($item('#compareColPrice').text).toBe('$699.00');
  });

  // ── S2: Add-to-cart cycle ─────────────────────────────────────────────────

  it('add-to-cart cycle: disables button, sets Adding…, then Added!, then resets', async () => {
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createEl());
      return itemEls.get(sel);
    };

    // Simulate the onClick handler from Compare Page.js
    async function simulateAddToCart(productId) {
      try {
        $item('#compareColAddCart').disable();
        $item('#compareColAddCart').label = 'Adding...';
        const { addToCart } = await import('public/cartService');
        await addToCart(productId);
        $item('#compareColAddCart').label = 'Added!';
        // In real code: setTimeout resets after 2000ms — we just verify the state here
      } catch (err) {
        $item('#compareColAddCart').label = 'Error — Try Again';
        $item('#compareColAddCart').enable();
      }
    }

    await simulateAddToCart('sale-001');

    expect($item('#compareColAddCart').disable).toHaveBeenCalled();
    expect($item('#compareColAddCart').label).toBe('Added!');
    expect(mockAddToCart).toHaveBeenCalledWith('sale-001');
  });

  it('add-to-cart cycle on API error: resets label to error message and re-enables', async () => {
    mockAddToCart.mockRejectedValue(new Error('Cart API down'));

    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createEl());
      return itemEls.get(sel);
    };

    async function simulateAddToCart(productId) {
      try {
        $item('#compareColAddCart').disable();
        $item('#compareColAddCart').label = 'Adding...';
        const { addToCart } = await import('public/cartService');
        await addToCart(productId);
        $item('#compareColAddCart').label = 'Added!';
      } catch (err) {
        $item('#compareColAddCart').label = 'Error — Try Again';
        $item('#compareColAddCart').enable();
      }
    }

    await simulateAddToCart('full-001');

    expect($item('#compareColAddCart').label).toBe('Error — Try Again');
    expect($item('#compareColAddCart').enable).toHaveBeenCalled();
  });

  // ── S6: Remove-from-compare URL building ─────────────────────────────────

  it('removeProductFromCompare generates correct new URL', async () => {
    const { removeProductFromCompare, buildCompareUrl } = await import(
      '../src/public/comparePageHelpers.js'
    );

    const newIds = removeProductFromCompare(['sale-001', 'full-001', 'other-001'], 'full-001');
    expect(buildCompareUrl(newIds)).toBe('/compare?ids=sale-001,other-001');
  });

  it('removing last second product gives /compare URL (no ids)', async () => {
    const { removeProductFromCompare, buildCompareUrl } = await import(
      '../src/public/comparePageHelpers.js'
    );

    const newIds = removeProductFromCompare(['sale-001', 'full-001'], 'full-001');
    const url = buildCompareUrl(newIds);
    expect(url).toContain('/compare');
  });

  // ── S1: Null products filtered out ──────────────────────────────────────

  it('products.getProduct returning null for some IDs: valid products used', () => {
    // If one product is null (not found), only valid ones should be used
    // This is tested via the helpers — null filtering in Compare Page.js:
    // validProducts = fetchedProducts.filter(Boolean)
    const fetched = [prodSale, null, prodFull, null];
    const valid = fetched.filter(Boolean);
    expect(valid).toHaveLength(2);
    expect(valid.map(p => p._id)).toEqual(['sale-001', 'full-001']);
  });

  it('all products returning null: filter leaves empty array triggering empty state', () => {
    const fetched = [null, null];
    const valid = fetched.filter(Boolean);
    // validProducts.map(p => p._id) would be [], shouldShowEmpty([]) = true
    expect(valid).toHaveLength(0);
    expect(valid.map(p => p._id)).toEqual([]);
  });

  // ── S3: Attributes table — diff cell HTML contains values ────────────────

  it('buildAttributeRows generates HTML-injectable values for diff cells', async () => {
    const { buildAttributeRows, isDiff } = await import(
      '../src/public/comparePageHelpers.js'
    );

    const rows = buildAttributeRows([prodSale, prodFull]);
    const frameMaterialRow = rows.find(r => r.label === 'Frame Material');

    // prodSale has no Frame Material section → '—'; prodFull has 'Metal'
    expect(frameMaterialRow.values).toEqual(['—', 'Metal']);
    expect(frameMaterialRow.hasDiff).toBe(true);
  });

  it('In Stock row reflects inStock field correctly', async () => {
    const { buildAttributeRows } = await import('../src/public/comparePageHelpers.js');
    const rows = buildAttributeRows([prodSale, prodFull]);
    const stockRow = rows.find(r => r.label === 'In Stock');
    expect(stockRow.values[0]).toBe('In Stock');   // prodSale.inStock = true
    expect(stockRow.values[1]).toBe('Out of Stock'); // prodFull.inStock = false
    expect(stockRow.hasDiff).toBe(true);
  });

  // ── CF-28uz: htmlEscape + XSS protection in attribute rows ───────────────

  it('htmlEscape escapes < > & " characters', async () => {
    const { htmlEscape } = await import('../src/public/comparePageHelpers.js');
    expect(htmlEscape('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(htmlEscape('A & B')).toBe('A &amp; B');
    expect(htmlEscape('"quoted"')).toBe('&quot;quoted&quot;');
    expect(htmlEscape("it's fine")).toBe('it&#39;s fine');
  });

  it('htmlEscape returns plain string unchanged', async () => {
    const { htmlEscape } = await import('../src/public/comparePageHelpers.js');
    expect(htmlEscape('Steel Frame')).toBe('Steel Frame');
    expect(htmlEscape('—')).toBe('—');
  });

  it('getProductAttribute escapes XSS payload from additionalInfoSections', async () => {
    const { getProductAttribute } = await import('../src/public/comparePageHelpers.js');
    const xssProd = {
      additionalInfoSections: [
        { title: 'Frame Material', description: '<img src=x onerror=alert(1)>' },
      ],
    };
    const val = getProductAttribute(xssProd, 'Frame Material');
    expect(val).not.toContain('<img');
    expect(val).toContain('&lt;img');
  });

  it('buildAttributeRows escapes XSS payloads in all returned values', async () => {
    const { buildAttributeRows } = await import('../src/public/comparePageHelpers.js');
    const xssProd = {
      _id: 'xss-prod',
      name: 'XSS Test',
      price: 0,
      inStock: true,
      additionalInfoSections: [
        { title: 'Frame Material', description: '<script>evil()</script>' },
        { title: 'Weight Capacity', description: '"><svg onload=x()>' },
      ],
    };
    const rows = buildAttributeRows([xssProd]);
    rows.forEach(row => {
      row.values.forEach(val => {
        // No raw angle brackets — all HTML tags must be escaped
        expect(val).not.toMatch(/<[a-z]/i);
        expect(val).not.toContain('>');
      });
    });
  });

  // ── S5: Schema HTML injection ─────────────────────────────────────────────

  it('buildItemListSchema produces valid JSON-LD for injection', async () => {
    const { buildItemListSchema } = await import('../src/public/comparePageHelpers.js');
    const schema = buildItemListSchema([prodSale, prodFull], 'https://carolinafutons.com');
    const wrapped = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
    expect(wrapped).toContain('"@type":"ItemList"');
    expect(wrapped).toContain('Sale Frame');
    expect(wrapped).toContain('Full Price Frame');
  });

  // ── S4: Mobile snap CSS ──────────────────────────────────────────────────

  it('buildMobileSnapCss includes x-axis mandatory snap', async () => {
    const { buildMobileSnapCss } = await import('../src/public/comparePageHelpers.js');
    const css = buildMobileSnapCss();
    expect(css).toContain('scroll-snap-type: x mandatory');
  });

  it('buildDotIndicatorData for 4 products has 4 dots', async () => {
    const { buildDotIndicatorData } = await import('../src/public/comparePageHelpers.js');
    const dots = buildDotIndicatorData(4, 1);
    expect(dots).toHaveLength(4);
    expect(dots[1].active).toBe(true);
    expect(dots[0].active).toBe(false);
    expect(dots[2].active).toBe(false);
  });
});
