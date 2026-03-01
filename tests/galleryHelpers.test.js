import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  trackProductView,
  getRecentlyViewed,
  addToCompare,
  removeFromCompare,
  getCompareList,
  formatDescription,
  getProductBadge,
  buildRecentlyViewedSection,
  buildComparisonBar,
  initImageLightbox,
  initImageZoom,
} from '../src/public/galleryHelpers.js';
import { futonFrame, wallHuggerFrame, futonMattress, murphyBed } from './fixtures/products.js';
import { session } from 'wix-storage-frontend';

// ── trackProductView ────────────────────────────────────────────────

describe('trackProductView', () => {
  it('stores a product in session storage', () => {
    trackProductView(futonFrame);
    const viewed = getRecentlyViewed();
    expect(viewed).toHaveLength(1);
    expect(viewed[0]._id).toBe(futonFrame._id);
  });

  it('stores only display fields (_id, name, slug, price, mainMedia)', () => {
    trackProductView(futonFrame);
    const viewed = getRecentlyViewed();
    expect(viewed[0]).toEqual({
      _id: futonFrame._id,
      name: futonFrame.name,
      slug: futonFrame.slug,
      price: futonFrame.formattedPrice,
      mainMedia: futonFrame.mainMedia,
    });
  });

  it('deduplicates — re-viewing moves product to front', () => {
    trackProductView(futonFrame);
    trackProductView(futonMattress);
    trackProductView(futonFrame);
    const viewed = getRecentlyViewed();
    expect(viewed).toHaveLength(2);
    expect(viewed[0]._id).toBe(futonFrame._id);
    expect(viewed[1]._id).toBe(futonMattress._id);
  });

  it('caps at MAX_RECENT=12', () => {
    for (let i = 0; i < 15; i++) {
      trackProductView({
        _id: `prod-${i}`,
        name: `Product ${i}`,
        slug: `product-${i}`,
        formattedPrice: '$10.00',
        mainMedia: 'https://example.com/img.jpg',
      });
    }
    const viewed = getRecentlyViewed();
    expect(viewed).toHaveLength(12);
    // Most recent should be at front
    expect(viewed[0]._id).toBe('prod-14');
    // Oldest trimmed should be prod-0, prod-1, prod-2
    const ids = viewed.map(p => p._id);
    expect(ids).not.toContain('prod-0');
    expect(ids).not.toContain('prod-1');
    expect(ids).not.toContain('prod-2');
  });

  it('ignores null product', () => {
    trackProductView(null);
    expect(getRecentlyViewed()).toHaveLength(0);
  });

  it('ignores undefined product', () => {
    trackProductView(undefined);
    expect(getRecentlyViewed()).toHaveLength(0);
  });

  it('ignores product without _id', () => {
    trackProductView({ name: 'No ID Product' });
    expect(getRecentlyViewed()).toHaveLength(0);
  });
});

// ── getRecentlyViewed ───────────────────────────────────────────────

describe('getRecentlyViewed', () => {
  it('returns empty array on fresh session', () => {
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('excludes current product by excludeId', () => {
    trackProductView(futonFrame);
    trackProductView(futonMattress);
    trackProductView(murphyBed);
    const viewed = getRecentlyViewed(futonFrame._id);
    expect(viewed).toHaveLength(2);
    expect(viewed.find(p => p._id === futonFrame._id)).toBeUndefined();
  });

  it('returns all when excludeId is null', () => {
    trackProductView(futonFrame);
    trackProductView(futonMattress);
    const viewed = getRecentlyViewed(null);
    expect(viewed).toHaveLength(2);
  });

  it('returns all when excludeId is not provided', () => {
    trackProductView(futonFrame);
    trackProductView(futonMattress);
    const viewed = getRecentlyViewed();
    expect(viewed).toHaveLength(2);
  });

  it('handles corrupted JSON in session storage gracefully', () => {
    session.setItem('cf_recently_viewed', '{bad-json!!!');
    expect(getRecentlyViewed()).toEqual([]);
  });

  it('returns empty when excludeId matches only product', () => {
    trackProductView(futonFrame);
    const viewed = getRecentlyViewed(futonFrame._id);
    expect(viewed).toEqual([]);
  });
});

// ── addToCompare ────────────────────────────────────────────────────

describe('addToCompare', () => {
  it('adds a product and returns true', () => {
    const result = addToCompare(futonFrame);
    expect(result).toBe(true);
    expect(getCompareList()).toHaveLength(1);
    expect(getCompareList()[0]._id).toBe(futonFrame._id);
  });

  it('rejects duplicate product and returns false', () => {
    addToCompare(futonFrame);
    const result = addToCompare(futonFrame);
    expect(result).toBe(false);
    expect(getCompareList()).toHaveLength(1);
  });

  it('allows up to MAX_COMPARE=4 items', () => {
    const products = [];
    for (let i = 0; i < 4; i++) {
      products.push({
        _id: `comp-${i}`,
        name: `Compare ${i}`,
        slug: `compare-${i}`,
        formattedPrice: '$100.00',
        mainMedia: 'https://example.com/img.jpg',
      });
    }

    products.forEach(p => {
      expect(addToCompare(p)).toBe(true);
    });
    expect(getCompareList()).toHaveLength(4);
  });

  it('rejects 5th product and returns false', () => {
    for (let i = 0; i < 4; i++) {
      addToCompare({
        _id: `comp-${i}`,
        name: `Compare ${i}`,
        slug: `compare-${i}`,
        formattedPrice: '$100.00',
        mainMedia: 'https://example.com/img.jpg',
      });
    }
    const result = addToCompare({
      _id: 'comp-4',
      name: 'Compare 4',
      slug: 'compare-4',
      formattedPrice: '$100.00',
      mainMedia: 'https://example.com/img.jpg',
    });
    expect(result).toBe(false);
    expect(getCompareList()).toHaveLength(4);
  });

  it('stores only display fields', () => {
    addToCompare(futonFrame);
    expect(getCompareList()[0]).toEqual({
      _id: futonFrame._id,
      name: futonFrame.name,
      slug: futonFrame.slug,
      price: futonFrame.formattedPrice,
      mainMedia: futonFrame.mainMedia,
    });
  });
});

// ── removeFromCompare ───────────────────────────────────────────────

describe('removeFromCompare', () => {
  it('removes a product by ID', () => {
    addToCompare(futonFrame);
    addToCompare(futonMattress);
    removeFromCompare(futonFrame._id);
    const list = getCompareList();
    expect(list).toHaveLength(1);
    expect(list[0]._id).toBe(futonMattress._id);
  });

  it('does nothing if product not in list', () => {
    addToCompare(futonFrame);
    removeFromCompare('nonexistent-id');
    expect(getCompareList()).toHaveLength(1);
  });

  it('does nothing when list is empty', () => {
    removeFromCompare(futonFrame._id);
    expect(getCompareList()).toEqual([]);
  });
});

// ── getCompareList ──────────────────────────────────────────────────

describe('getCompareList', () => {
  it('returns empty array on fresh session', () => {
    expect(getCompareList()).toEqual([]);
  });

  it('returns items in insertion order', () => {
    addToCompare(futonFrame);
    addToCompare(futonMattress);
    addToCompare(murphyBed);
    const list = getCompareList();
    expect(list[0]._id).toBe(futonFrame._id);
    expect(list[1]._id).toBe(futonMattress._id);
    expect(list[2]._id).toBe(murphyBed._id);
  });

  it('handles corrupted JSON gracefully', () => {
    session.setItem('cf_compare_list', 'not-valid-json');
    expect(getCompareList()).toEqual([]);
  });
});

// ── getProductBadge ─────────────────────────────────────────────────

describe('getProductBadge', () => {
  it('returns ribbon when product has one', () => {
    expect(getProductBadge(wallHuggerFrame)).toBe('Featured');
    expect(getProductBadge({ ...futonMattress })).toBe('Sale');
  });

  it('returns "Sale" for products with discount > 0 and no ribbon', () => {
    const product = { ...futonFrame, ribbon: '', discount: 50 };
    expect(getProductBadge(product)).toBe('Sale');
  });

  it('returns "In-Store Only" for inStoreOnly products', () => {
    const product = { ...futonFrame, ribbon: '', discount: 0, inStoreOnly: true };
    expect(getProductBadge(product)).toBe('In-Store Only');
  });

  it('returns "New" for products created within 30 days', () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 5);
    const product = { ...futonFrame, ribbon: '', discount: 0, _createdDate: recent };
    expect(getProductBadge(product)).toBe('New');
  });

  it('returns null for products older than 30 days with no badge', () => {
    const old = new Date();
    old.setDate(old.getDate() - 60);
    const product = { ...futonFrame, ribbon: '', discount: 0, _createdDate: old };
    expect(getProductBadge(product)).toBeNull();
  });

  it('returns null for null product', () => {
    expect(getProductBadge(null)).toBeNull();
  });

  it('returns null for product with no badge attributes', () => {
    const product = { _id: 'test', ribbon: '', discount: 0 };
    expect(getProductBadge(product)).toBeNull();
  });

  it('ribbon takes priority over discount', () => {
    const product = { ...futonFrame, ribbon: 'Clearance', discount: 100 };
    expect(getProductBadge(product)).toBe('Clearance');
  });

  it('discount takes priority over inStoreOnly', () => {
    const product = { ...futonFrame, ribbon: '', discount: 50, inStoreOnly: true };
    expect(getProductBadge(product)).toBe('Sale');
  });

  it('inStoreOnly takes priority over "New"', () => {
    const recent = new Date();
    const product = {
      ...futonFrame,
      ribbon: '',
      discount: 0,
      inStoreOnly: true,
      _createdDate: recent,
    };
    expect(getProductBadge(product)).toBe('In-Store Only');
  });
});

// ── formatDescription ──────────────────────────────────────────────

describe('formatDescription', () => {
  it('strips HTML tags', () => {
    const result = formatDescription('<p>Hello <b>World</b></p>');
    expect(result).toBe('Hello World');
  });

  it('truncates at maxLength with word boundary ellipsis', () => {
    const longText = 'This is a really long description that should be truncated at the specified length';
    const result = formatDescription(`<p>${longText}</p>`, 30);
    expect(result.length).toBeLessThanOrEqual(33); // 30 + '...'
    expect(result).toMatch(/\.\.\.$/);
  });

  it('does not truncate short text', () => {
    expect(formatDescription('<p>Short</p>', 200)).toBe('Short');
  });

  it('returns empty string for null input', () => {
    expect(formatDescription(null)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatDescription('')).toBe('');
  });

  it('uses default maxLength of 200', () => {
    const text = 'A'.repeat(250);
    const result = formatDescription(`<div>${text}</div>`);
    expect(result.length).toBeLessThanOrEqual(203);
  });

  it('handles nested HTML', () => {
    const html = '<div><p>Outer <span class="bold">inner <em>deep</em></span> text</p></div>';
    expect(formatDescription(html)).toBe('Outer inner deep text');
  });
});

// ── $w parameter tests ──────────────────────────────────────────────
// Verify functions that previously used global $w now accept it as a parameter

function createMock$w(elements = {}) {
  return (selector) => {
    if (elements[selector]) return elements[selector];
    throw new Error(`Element ${selector} not found`);
  };
}

function mockElement(overrides = {}) {
  return {
    collapse: vi.fn(),
    expand: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onItemClicked: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    text: '',
    src: '',
    data: [],
    items: [],
    onItemReady: vi.fn(),
    ...overrides,
  };
}

describe('buildRecentlyViewedSection (accepts $w)', () => {
  it('collapses container when no recent views', () => {
    const container = mockElement();
    const mock$w = createMock$w({ '#recentSection': container });
    buildRecentlyViewedSection(mock$w, '#recentSection', vi.fn());
    expect(container.collapse).toHaveBeenCalled();
  });

  it('expands container and populates repeater with recent views', () => {
    trackProductView(futonFrame);
    const container = mockElement();
    const repeater = mockElement();
    const mock$w = createMock$w({
      '#recentSection': container,
      '#recentRepeater': repeater,
    });
    const handler = vi.fn();
    buildRecentlyViewedSection(mock$w, '#recentSection', handler);
    expect(container.expand).toHaveBeenCalled();
    expect(repeater.onItemReady).toHaveBeenCalledWith(handler);
  });

  it('does not use global $w', () => {
    globalThis.$w = () => { throw new Error('should not use global $w'); };
    const container = mockElement();
    const mock$w = createMock$w({ '#section': container });
    expect(() => buildRecentlyViewedSection(mock$w, '#section', vi.fn())).not.toThrow();
    delete globalThis.$w;
  });
});

describe('buildComparisonBar (accepts $w)', () => {
  it('collapses bar when compare list is empty', () => {
    const bar = mockElement();
    const mock$w = createMock$w({ '#compareBar': bar });
    buildComparisonBar(mock$w);
    expect(bar.collapse).toHaveBeenCalled();
  });

  it('does not use global $w', () => {
    globalThis.$w = () => { throw new Error('should not use global $w'); };
    const bar = mockElement();
    const mock$w = createMock$w({ '#compareBar': bar });
    expect(() => buildComparisonBar(mock$w)).not.toThrow();
    delete globalThis.$w;
  });
});

describe('initImageLightbox (accepts $w)', () => {
  it('returns null when no images available', () => {
    const mock$w = createMock$w({});
    const result = initImageLightbox(mock$w, null, null);
    expect(result).toBeNull();
  });

  it('returns lightbox controller with open/close/handleKeydown', () => {
    const gallery = mockElement({ items: [{ src: 'img1.jpg' }, { src: 'img2.jpg' }] });
    const mainImage = mockElement({ src: 'img1.jpg' });
    const mock$w = createMock$w({
      '#lightboxImage': mockElement(),
      '#lightboxCounter': mockElement(),
      '#lightboxOverlay': mockElement(),
      '#lightboxPrev': mockElement(),
      '#lightboxNext': mockElement(),
      '#lightboxClose': mockElement(),
    });
    const result = initImageLightbox(mock$w, gallery, mainImage);
    expect(result).toHaveProperty('open');
    expect(result).toHaveProperty('close');
    expect(result).toHaveProperty('handleKeydown');
  });
});

describe('initImageZoom (accepts $w)', () => {
  it('returns null when imageElement is null', () => {
    const mock$w = createMock$w({});
    expect(initImageZoom(mock$w, null)).toBeNull();
  });

  it('returns zoom controller with show/hide', () => {
    const image = mockElement({ src: 'test.jpg' });
    const mock$w = createMock$w({
      '#imageZoomImage': mockElement(),
      '#imageZoomOverlay': mockElement(),
    });
    const result = initImageZoom(mock$w, image);
    expect(result).toHaveProperty('show');
    expect(result).toHaveProperty('hide');
    expect(result.zoomFactor).toBe(2);
  });
});
