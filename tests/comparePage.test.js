import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame, wallHuggerFrame, futonMattress, saleProduct } from './fixtures/products.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    label: '',
    data: [],
    style: { color: '', backgroundColor: '', fontWeight: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Backend Modules ────────────────────────────────────────────

vi.mock('backend/comparisonService.web', () => ({
  getComparisonData: vi.fn().mockResolvedValue({ success: true }),
  buildShareableUrl: vi.fn().mockResolvedValue('/compare?ids=prod-frame-001,prod-frame-002'),
  trackComparison: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/galleryHelpers.js', () => ({
  getCompareList: vi.fn(() => []),
  removeFromCompare: vi.fn(),
  addToCompare: vi.fn(),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    sand: '#E8D5B7',
    espresso: '#3A2518',
    mountainBlue: '#5B8FA8',
    coral: '#E8845C',
    sandLight: '#FFF8F0',
    success: '#28a745',
    mutedBrown: '#8B7355',
  },
}));

vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  isMobile: vi.fn(() => false),
}));

vi.mock('public/engagementTracker', () => ({
  trackProductPageView: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

import { getComparisonData, buildShareableUrl, trackComparison } from 'backend/comparisonService.web';
import { getCompareList, removeFromCompare } from 'public/galleryHelpers.js';
import { isMobile } from 'public/mobileHelpers';
import { trackProductPageView } from 'public/engagementTracker';
import { makeClickable } from 'public/a11yHelpers';
import wixLocationFrontend, { __setQuery, __reset as resetLocation } from 'wix-location-frontend';

// Mock data defined after imports (vi.mock factories are hoisted)
const mockComparisonData = {
  success: true,
  products: [
    { ...futonFrame, mainMedia: 'https://example.com/eureka.jpg' },
    { ...wallHuggerFrame, mainMedia: 'https://example.com/dillon.jpg' },
  ],
  rows: [
    { label: 'Material', cells: [{ value: 'Hardwood' }, { value: 'Hardwood' }], differs: false },
    { label: 'Price', cells: [{ value: '$499' }, { value: '$699' }], differs: true },
    { label: 'Dimensions', cells: [{ value: '54x38x33' }, { value: '54x10x34' }], differs: true },
  ],
  badges: {
    bestValue: futonFrame._id,
    bestRated: wallHuggerFrame._id,
    mostPopular: null,
  },
  sharedCategory: 'futon-frames',
};

// ── Import Page ─────────────────────────────────────────────────────

describe('Compare Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Compare Page.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    resetLocation();
    getComparisonData.mockResolvedValue(mockComparisonData);
    getCompareList.mockReturnValue([]);
    isMobile.mockReturnValue(false);
  });

  // ── Initialization ─────────────────────────────────────────────

  describe('initialization', () => {
    it('fetches comparison data from URL query IDs', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getComparisonData).toHaveBeenCalledWith(['prod-frame-001', 'prod-frame-002']);
    });

    it('falls back to session compare list when URL has fewer than 2 IDs', async () => {
      __setQuery({ ids: 'prod-frame-001' });
      getCompareList.mockReturnValue([
        { _id: 'prod-frame-001' },
        { _id: 'prod-frame-002' },
      ]);
      await onReadyHandler();
      expect(getComparisonData).toHaveBeenCalledWith(['prod-frame-001', 'prod-frame-002']);
    });

    it('falls back to session compare list when URL has no IDs', async () => {
      __setQuery({});
      getCompareList.mockReturnValue([
        { _id: 'prod-frame-001' },
        { _id: 'prod-matt-001' },
      ]);
      await onReadyHandler();
      expect(getComparisonData).toHaveBeenCalledWith(['prod-frame-001', 'prod-matt-001']);
    });

    it('limits URL IDs to a maximum of 4', async () => {
      __setQuery({ ids: 'a,b,c,d,e,f' });
      await onReadyHandler();
      expect(getComparisonData).toHaveBeenCalledWith(['a', 'b', 'c', 'd']);
    });

    it('filters empty strings from URL IDs', async () => {
      __setQuery({ ids: 'a,,b,,' });
      await onReadyHandler();
      expect(getComparisonData).toHaveBeenCalledWith(['a', 'b']);
    });

    it('tracks page view after successful data load', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(trackProductPageView).toHaveBeenCalledWith({ name: 'Product Comparison', _id: 'compare-page' });
    });

    it('tracks comparison in CMS after successful load', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(trackComparison).toHaveBeenCalledWith(['prod-frame-001', 'prod-frame-002']);
    });

    it('shows loading indicator while fetching', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#compareLoading').show).toHaveBeenCalled();
    });

    it('hides loading and shows content after fetch', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#compareLoading').hide).toHaveBeenCalled();
      expect(getEl('#compareContent').show).toHaveBeenCalled();
    });
  });

  // ── Empty State ────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows empty state when fewer than 2 IDs available', async () => {
      __setQuery({ ids: 'single' });
      getCompareList.mockReturnValue([]);
      await onReadyHandler();
      expect(getEl('#compareEmptyState').show).toHaveBeenCalled();
      expect(getEl('#compareEmptyState').expand).toHaveBeenCalled();
    });

    it('shows empty state when no IDs in URL and no compare list', async () => {
      __setQuery({});
      getCompareList.mockReturnValue([]);
      await onReadyHandler();
      expect(getEl('#compareEmptyState').show).toHaveBeenCalled();
    });

    it('sets accessible empty state title', async () => {
      __setQuery({});
      getCompareList.mockReturnValue([]);
      await onReadyHandler();
      expect(getEl('#emptyStateTitle').text).toBe('Compare Products');
      expect(getEl('#emptyStateTitle').accessibility.ariaLabel).toBe('No products to compare');
    });

    it('sets helpful empty state message', async () => {
      __setQuery({});
      getCompareList.mockReturnValue([]);
      await onReadyHandler();
      expect(getEl('#emptyStateText').text).toContain('Add at least 2 products');
    });

    it('browse button navigates to futon-frames', async () => {
      __setQuery({});
      getCompareList.mockReturnValue([]);
      const toSpy = vi.spyOn(wixLocationFrontend, 'to');
      await onReadyHandler();
      const clickHandler = getEl('#browseProductsBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect(toSpy).toHaveBeenCalledWith('/futon-frames');
      toSpy.mockRestore();
    });

    it('shows empty state when getComparisonData returns unsuccessful', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      getComparisonData.mockResolvedValue({ success: false });
      await onReadyHandler();
      expect(getEl('#compareEmptyState').show).toHaveBeenCalled();
    });

    it('shows empty state when getComparisonData returns null', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      getComparisonData.mockResolvedValue(null);
      await onReadyHandler();
      expect(getEl('#compareEmptyState').show).toHaveBeenCalled();
    });

    it('shows empty state on fetch error', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      getComparisonData.mockRejectedValue(new Error('Network error'));
      await onReadyHandler();
      expect(getEl('#compareEmptyState').show).toHaveBeenCalled();
    });
  });

  // ── Product Headers ────────────────────────────────────────────

  describe('product headers', () => {
    it('renders product names in header columns', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#compareName1').text).toBe(futonFrame.name);
      expect(getEl('#compareName2').text).toBe(wallHuggerFrame.name);
    });

    it('renders product images with alt text', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#compareImage1').src).toBe('https://example.com/eureka.jpg');
      expect(getEl('#compareImage1').alt).toContain('Eureka Futon Frame');
    });

    it('shows discounted price when available', async () => {
      const discountData = {
        ...mockComparisonData,
        products: [
          { ...futonFrame, formattedDiscountedPrice: '$399.00' },
          { ...wallHuggerFrame },
        ],
      };
      getComparisonData.mockResolvedValue(discountData);
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#comparePrice1').text).toBe('$399.00');
    });

    it('shows regular price when no discount', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#comparePrice1').text).toBe(futonFrame.formattedPrice);
    });

    it('shows ribbon badge when product has one', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      // wallHuggerFrame has ribbon 'Featured'
      expect(getEl('#compareBadge2').text).toBe('Featured');
      expect(getEl('#compareBadge2').show).toHaveBeenCalled();
    });

    it('hides ribbon badge when product has none', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      // futonFrame has ribbon ''
      expect(getEl('#compareBadge1').hide).toHaveBeenCalled();
    });

    it('sets ARIA labels on column regions', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#compareCol1').accessibility.ariaLabel).toContain('Product 1');
      expect(getEl('#compareCol1').accessibility.ariaLabel).toContain(futonFrame.name);
    });

    it('sets page title with product count', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#comparePageTitle').text).toBe('Comparing 2 Products');
    });

    it('makes product images and names clickable with navigation', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(makeClickable).toHaveBeenCalled();
      const calls = makeClickable.mock.calls;
      const imageClick = calls.find(c => c[0] === getEl('#compareImage1'));
      expect(imageClick).toBeTruthy();
    });

    it('collapses unused columns (desktop, 2 products)', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#compareCol3').collapse).toHaveBeenCalled();
      expect(getEl('#compareCol4').collapse).toHaveBeenCalled();
    });

    it('collapses extra columns on mobile (max 2)', async () => {
      isMobile.mockReturnValue(true);
      const threeProducts = {
        ...mockComparisonData,
        products: [
          { ...futonFrame },
          { ...wallHuggerFrame },
          { ...futonMattress, mainMedia: 'https://example.com/matt.jpg' },
        ],
      };
      getComparisonData.mockResolvedValue(threeProducts);
      __setQuery({ ids: 'a,b,c' });
      await onReadyHandler();
      // 3rd product should be collapsed on mobile (maxCols=2)
      expect(getEl('#compareCol3').collapse).toHaveBeenCalled();
    });
  });

  // ── Comparison Rows ────────────────────────────────────────────

  describe('comparison rows', () => {
    it('sets up repeater data from comparison rows', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      const repeater = getEl('#comparisonRowRepeater');
      expect(repeater.data.length).toBe(3);
      expect(repeater.data[0]._id).toBe('row-0');
      expect(repeater.data[1]._id).toBe('row-1');
    });

    it('registers onItemReady for row repeater', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#comparisonRowRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady renders row label and cell values', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      const repeater = getEl('#comparisonRowRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = { text: '', style: { backgroundColor: '' }, collapse: vi.fn(), expand: vi.fn(), accessibility: {} };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, {
        _id: 'row-0',
        label: 'Material',
        cells: [{ value: 'Hardwood' }, { value: 'Hardwood' }],
        differs: false,
      });

      expect(itemElements['#rowLabel'].text).toBe('Material');
      expect(itemElements['#rowCell1'].text).toBe('Hardwood');
      expect(itemElements['#rowCell2'].text).toBe('Hardwood');
    });

    it('highlights differing cells with sand background', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      const repeater = getEl('#comparisonRowRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = { text: '', style: { backgroundColor: '' }, collapse: vi.fn(), expand: vi.fn(), accessibility: {} };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, {
        _id: 'row-1',
        label: 'Price',
        cells: [{ value: '$499' }, { value: '$699' }],
        differs: true,
      });

      expect(itemElements['#rowCell1'].style.backgroundColor).toBe('#FFF8F0');
    });

    it('collapses cells beyond available products', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      const repeater = getEl('#comparisonRowRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = { text: '', style: { backgroundColor: '' }, collapse: vi.fn(), expand: vi.fn(), accessibility: {} };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, {
        _id: 'row-0',
        label: 'Material',
        cells: [{ value: 'Hardwood' }, { value: 'Hardwood' }],
        differs: false,
      });

      // cells 3 and 4 have no data, should be collapsed
      expect(itemElements['#rowCell3'].collapse).toHaveBeenCalled();
      expect(itemElements['#rowCell4'].collapse).toHaveBeenCalled();
    });

    it('sets ARIA label on row label', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      const repeater = getEl('#comparisonRowRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = { text: '', style: { backgroundColor: '' }, collapse: vi.fn(), expand: vi.fn(), accessibility: {} };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, {
        _id: 'row-0',
        label: 'Material',
        cells: [{ value: 'Hardwood' }, { value: 'Hardwood' }],
        differs: false,
      });

      expect(itemElements['#rowLabel'].accessibility.ariaLabel).toBe('Attribute: Material');
    });
  });

  // ── Winner Badges ──────────────────────────────────────────────

  describe('winner badges', () => {
    it('shows Best Value badge on the winning product', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      // futonFrame is bestValue (index 0 → winnerBadge1)
      expect(getEl('#winnerBadge1').text).toContain('Best Value');
      expect(getEl('#winnerBadge1').show).toHaveBeenCalled();
    });

    it('shows Best Rated badge on the winning product', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      // wallHuggerFrame is bestRated (index 1 → winnerBadge2)
      expect(getEl('#winnerBadge2').text).toContain('Best Rated');
      expect(getEl('#winnerBadge2').show).toHaveBeenCalled();
    });

    it('combines multiple badges with pipe separator', async () => {
      const multiData = {
        ...mockComparisonData,
        badges: {
          bestValue: futonFrame._id,
          bestRated: futonFrame._id,
          mostPopular: futonFrame._id,
        },
      };
      getComparisonData.mockResolvedValue(multiData);
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#winnerBadge1').text).toBe('Best Value | Best Rated | Most Popular');
    });

    it('sets ARIA label for winner badges', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#winnerBadge1').accessibility.ariaLabel).toContain('Awards');
      expect(getEl('#winnerBadge1').accessibility.ariaLabel).toContain('Best Value');
    });

    it('hides badge for products with no awards', async () => {
      const noAwards = {
        ...mockComparisonData,
        badges: { bestValue: 'some-other-id', bestRated: 'some-other-id', mostPopular: null },
      };
      getComparisonData.mockResolvedValue(noAwards);
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#winnerBadge1').hide).toHaveBeenCalled();
      expect(getEl('#winnerBadge2').hide).toHaveBeenCalled();
    });
  });

  // ── Share Button ───────────────────────────────────────────────

  describe('share button', () => {
    it('sets accessible label on share button', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#shareCompareBtn').accessibility.ariaLabel).toBe('Copy shareable comparison link');
    });

    it('registers click handler on share button', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#shareCompareBtn').onClick).toHaveBeenCalled();
    });

    it('calls buildShareableUrl with product IDs', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(buildShareableUrl).toHaveBeenCalledWith([futonFrame._id, wallHuggerFrame._id]);
    });
  });

  // ── Remove Product Buttons ────────────────────────────────────

  describe('remove product buttons', () => {
    it('registers click handlers for each product remove button', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#removeProduct1').onClick).toHaveBeenCalled();
      expect(getEl('#removeProduct2').onClick).toHaveBeenCalled();
    });

    it('sets accessible remove button labels', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#removeProduct1').accessibility.ariaLabel).toContain('Remove');
      expect(getEl('#removeProduct1').accessibility.ariaLabel).toContain(futonFrame.name);
    });

    it('removing a product calls removeFromCompare', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      const toSpy = vi.spyOn(wixLocationFrontend, 'to');
      await onReadyHandler();
      const clickHandler = getEl('#removeProduct1').onClick.mock.calls[0][0];
      await clickHandler();
      expect(removeFromCompare).toHaveBeenCalledWith(futonFrame._id);
      toSpy.mockRestore();
    });

    it('shows empty state when removing leaves fewer than 2 products', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      // Remove product 1 → only 1 remains
      const clickHandler = getEl('#removeProduct1').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#compareEmptyState').show).toHaveBeenCalled();
    });

    it('redirects with remaining IDs when 2+ products remain', async () => {
      const threeProducts = {
        ...mockComparisonData,
        products: [
          { ...futonFrame },
          { ...wallHuggerFrame },
          { ...futonMattress, mainMedia: 'https://example.com/matt.jpg' },
        ],
      };
      getComparisonData.mockResolvedValue(threeProducts);
      __setQuery({ ids: 'a,b,c' });
      const toSpy = vi.spyOn(wixLocationFrontend, 'to');
      await onReadyHandler();
      const clickHandler = getEl('#removeProduct1').onClick.mock.calls[0][0];
      await clickHandler();
      expect(toSpy).toHaveBeenCalledWith(expect.stringContaining('/compare?ids='));
      toSpy.mockRestore();
    });
  });

  // ── Add Product Button ────────────────────────────────────────

  describe('add product button', () => {
    it('shows add button when fewer than 4 products', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#addProductBtn').onClick).toHaveBeenCalled();
      expect(getEl('#addProductBtn').collapse).not.toHaveBeenCalled();
    });

    it('collapses add button when 4 products are shown', async () => {
      const fourProducts = {
        ...mockComparisonData,
        products: [
          { ...futonFrame },
          { ...wallHuggerFrame },
          { ...futonMattress, mainMedia: 'https://example.com/matt.jpg' },
          { ...saleProduct },
        ],
      };
      getComparisonData.mockResolvedValue(fourProducts);
      __setQuery({ ids: 'a,b,c,d' });
      await onReadyHandler();
      expect(getEl('#addProductBtn').collapse).toHaveBeenCalled();
    });

    it('navigates to shared category when add button clicked', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      const toSpy = vi.spyOn(wixLocationFrontend, 'to');
      await onReadyHandler();
      const clickHandler = getEl('#addProductBtn').onClick.mock.calls[0][0];
      clickHandler();
      expect(toSpy).toHaveBeenCalledWith('/futon-frames');
      toSpy.mockRestore();
    });

    it('sets accessible label on add button', async () => {
      __setQuery({ ids: 'prod-frame-001,prod-frame-002' });
      await onReadyHandler();
      expect(getEl('#addProductBtn').accessibility.ariaLabel).toBe('Add another product to comparison');
    });
  });
});
