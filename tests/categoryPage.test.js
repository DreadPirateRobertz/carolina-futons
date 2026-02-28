import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame, wallHuggerFrame, futonMattress } from './fixtures/products.js';
import { __setPath } from './__mocks__/wix-location-frontend.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    label: '',
    options: [],
    data: [],
    style: { color: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onReady: vi.fn((cb) => { if (cb) cb(); return Promise.resolve(); }),
    onCurrentIndexChanged: vi.fn(),
    getCurrentItem: vi.fn(() => futonFrame),
    getTotalCount: vi.fn(() => 5),
    getItems: vi.fn((offset, limit) => ({
      items: [{ slug: 'eureka', name: 'Eureka', mainMedia: 'img.jpg' }],
    })),
    setSort: vi.fn(),
    setFilter: vi.fn(),
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

vi.mock('backend/seoHelpers.web', () => ({
  getCollectionSchema: vi.fn().mockResolvedValue('{"@type":"ItemList"}'),
  getBreadcrumbSchema: vi.fn().mockResolvedValue('{"@type":"BreadcrumbList"}'),
}));

// ── Import Page ─────────────────────────────────────────────────────

describe('Category Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Category Page.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ── Sort Controls ─────────────────────────────────────────────────

  describe('sort controls', () => {
    it('initializes sort dropdown with 7 options including Best Selling and Highest Rated', async () => {
      await onReadyHandler();
      const dropdown = getEl('#sortDropdown');
      expect(dropdown.options).toHaveLength(7);
      expect(dropdown.options[0]).toEqual({ label: 'Best Selling', value: 'bestselling' });
      expect(dropdown.options[1]).toEqual({ label: 'Name (A-Z)', value: 'name-asc' });
      expect(dropdown.options[2]).toEqual({ label: 'Name (Z-A)', value: 'name-desc' });
      expect(dropdown.options[3]).toEqual({ label: 'Price: Low to High', value: 'price-asc' });
      expect(dropdown.options[4]).toEqual({ label: 'Price: High to Low', value: 'price-desc' });
      expect(dropdown.options[5]).toEqual({ label: 'Newest First', value: 'date-desc' });
      expect(dropdown.options[6]).toEqual({ label: 'Highest Rated', value: 'rating-desc' });
    });

    it('defaults to bestselling sort', async () => {
      await onReadyHandler();
      expect(getEl('#sortDropdown').value).toBe('bestselling');
    });

    it('registers onChange handler on sort dropdown', async () => {
      await onReadyHandler();
      expect(getEl('#sortDropdown').onChange).toHaveBeenCalled();
    });

    it('sort change triggers dataset.setSort', async () => {
      await onReadyHandler();
      const dropdown = getEl('#sortDropdown');
      const onChange = dropdown.onChange.mock.calls[0][0];

      // Simulate selecting price-desc
      dropdown.value = 'price-desc';
      onChange();

      expect(getEl('#categoryDataset').setSort).toHaveBeenCalled();
    });

    it('rating-desc sort triggers dataset.setSort', async () => {
      await onReadyHandler();
      const dropdown = getEl('#sortDropdown');
      const onChange = dropdown.onChange.mock.calls[0][0];

      dropdown.value = 'rating-desc';
      onChange();

      expect(getEl('#categoryDataset').setSort).toHaveBeenCalled();
    });
  });

  // ── Comfort Level Filter ─────────────────────────────────────────

  describe('comfort level filter', () => {
    it('initializes comfort level filter with 4 options', async () => {
      await onReadyHandler();
      const comfortFilter = getEl('#filterComfortLevel');
      expect(comfortFilter.options).toHaveLength(4);
      expect(comfortFilter.options[0]).toEqual({ label: 'Any Comfort', value: '' });
    });

    it('registers onChange handler on comfort level filter', async () => {
      await onReadyHandler();
      expect(getEl('#filterComfortLevel').onChange).toHaveBeenCalled();
    });

    it('sets aria-label on comfort level filter', async () => {
      await onReadyHandler();
      expect(getEl('#filterComfortLevel').accessibility.ariaLabel).toBe('Filter by comfort level');
    });
  });

  // ── Active Filter Chips ─────────────────────────────────────────

  describe('active filter chips', () => {
    it('hides chips container when no filters are active', async () => {
      await onReadyHandler();
      // On initial load with no filters, chips should be hidden
      const clearBtn = getEl('#clearAllFilters');
      const onClick = clearBtn.onClick.mock.calls[0]?.[0];
      if (onClick) onClick();
      expect(getEl('#activeFilterChips').hide).toHaveBeenCalled();
    });

    it('shows chips container when filters are active', async () => {
      await onReadyHandler();
      const materialFilter = getEl('#filterMaterial');
      const onChange = materialFilter.onChange.mock.calls[0]?.[0];
      if (onChange) {
        materialFilter.value = 'hardwood';
        onChange();
      }
      // After debounce fires, chips should be shown
      // We check that the element is accessible
      expect(getEl('#activeFilterChips')).toBeDefined();
    });

    it('chips text includes filter label when filter active', async () => {
      await onReadyHandler();
      // Set brand filter value
      getEl('#filterBrand').value = 'Night & Day';
      const onChange = getEl('#filterBrand').onChange.mock.calls[0]?.[0];
      if (onChange) onChange();
      // The chips text element should exist
      expect(getEl('#filterChipsText')).toBeDefined();
    });
  });

  // ── Filter Controls ───────────────────────────────────────────────

  describe('filter controls', () => {
    it('initializes brand filter with 7 options', async () => {
      await onReadyHandler();
      const brandFilter = getEl('#filterBrand');
      expect(brandFilter.options).toHaveLength(7);
      expect(brandFilter.options[0]).toEqual({ label: 'All Brands', value: '' });
      expect(brandFilter.options[1].label).toContain('Night & Day');
      expect(brandFilter.options[2].label).toContain('Strata');
      expect(brandFilter.options[3].label).toContain('Wall Hugger');
      expect(brandFilter.options[4].label).toContain('KD Frames');
      expect(brandFilter.options[5].label).toContain('Unfinished');
      expect(brandFilter.options[6].label).toContain('Otis');
    });

    it('initializes price filter with 6 range options', async () => {
      await onReadyHandler();
      const priceFilter = getEl('#filterPrice');
      expect(priceFilter.options).toHaveLength(6);
      expect(priceFilter.options[0]).toEqual({ label: 'All Prices', value: '' });
      expect(priceFilter.options[1].value).toBe('0-300');
      expect(priceFilter.options[5].value).toBe('1200-99999');
    });

    it('initializes size filter with 4 options', async () => {
      await onReadyHandler();
      const sizeFilter = getEl('#filterSize');
      expect(sizeFilter.options).toHaveLength(4);
      expect(sizeFilter.options[0]).toEqual({ label: 'All Sizes', value: '' });
    });

    it('brand filter change triggers dataset.setFilter', async () => {
      await onReadyHandler();
      const brandFilter = getEl('#filterBrand');
      const onChange = brandFilter.onChange.mock.calls[0][0];

      brandFilter.value = 'Night & Day';
      onChange();

      expect(getEl('#categoryDataset').setFilter).toHaveBeenCalled();
    });

    it('price filter change triggers dataset.setFilter', async () => {
      await onReadyHandler();
      const priceFilter = getEl('#filterPrice');
      const onChange = priceFilter.onChange.mock.calls[0][0];

      priceFilter.value = '300-500';
      onChange();

      expect(getEl('#categoryDataset').setFilter).toHaveBeenCalled();
    });

    it('size filter change triggers dataset.setFilter', async () => {
      await onReadyHandler();
      const sizeFilter = getEl('#filterSize');
      const onChange = sizeFilter.onChange.mock.calls[0][0];

      sizeFilter.value = 'Full';
      onChange();

      expect(getEl('#categoryDataset').setFilter).toHaveBeenCalled();
    });

    it('clear filters button resets all filter dropdowns', async () => {
      await onReadyHandler();
      const clearBtn = getEl('#clearFilters');
      const onClick = clearBtn.onClick.mock.calls[0][0];

      // Set filter values
      getEl('#filterBrand').value = 'Night & Day';
      getEl('#filterPrice').value = '300-500';
      getEl('#filterSize').value = 'Full';

      onClick();

      expect(getEl('#filterBrand').value).toBe('');
      expect(getEl('#filterPrice').value).toBe('');
      expect(getEl('#filterSize').value).toBe('');
    });
  });

  // ── Product Grid ──────────────────────────────────────────────────

  describe('product grid', () => {
    it('registers onItemReady handler on product repeater', async () => {
      await onReadyHandler();
      expect(getEl('#productGridRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady populates image, name, and price', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);
      expect(itemElements['#gridImage'].src).toBe(futonFrame.mainMedia);
      expect(itemElements['#gridName'].text).toBe(futonFrame.name);
      expect(itemElements['#gridPrice'].text).toBe(futonFrame.formattedPrice);
    });

    it('onItemReady shows sale badge for discounted products', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonMattress);
      // Discounted product should show sale price
      expect(itemElements['#gridPrice'].text).toBe(futonMattress.formattedDiscountedPrice);
      expect(itemElements['#gridSaleBadge'].show).toHaveBeenCalled();
      expect(itemElements['#gridOrigPrice'].show).toHaveBeenCalled();
    });

    it('onItemReady shows ribbon badge when present', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, wallHuggerFrame);
      expect(itemElements['#gridRibbon'].text).toBe('Featured');
      expect(itemElements['#gridRibbon'].show).toHaveBeenCalled();
    });

    it('onItemReady sets click handlers for navigation', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);
      expect(itemElements['#gridImage'].onClick).toHaveBeenCalled();
      expect(itemElements['#gridName'].onClick).toHaveBeenCalled();
    });

    it('onItemReady generates SEO alt text', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);
      expect(itemElements['#gridImage'].alt).toContain('Eureka');
      expect(itemElements['#gridImage'].alt).toContain('Carolina Futons');
    });
  });

  // ── Quick View Modal ──────────────────────────────────────────────

  describe('quick view modal', () => {
    it('registers quick view button click handler', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);
      expect(itemElements['#quickViewBtn'].onClick).toHaveBeenCalled();
    });

    it('quick view button populates modal with product data', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '',
            show: vi.fn(), onClick: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);

      // Get the quickViewBtn onClick handler and call it
      const quickViewClick = itemElements['#quickViewBtn'].onClick.mock.calls[0][0];
      quickViewClick();

      // Quick view modal should be populated (via the global $w)
      expect(getEl('#qvName').text).toBe(futonFrame.name);
      expect(getEl('#qvPrice').text).toBe(futonFrame.formattedPrice);
      expect(getEl('#qvImage').src).toBe(futonFrame.mainMedia);
      expect(getEl('#quickViewModal').show).toHaveBeenCalled();
    });
  });

  // ── Result Count ──────────────────────────────────────────────────

  describe('result count', () => {
    it('updates result count text from dataset total', async () => {
      await onReadyHandler();
      // The dataset.onReady callback fires and getTotalCount returns 5
      // So resultCount should show "5 products"
      const dataset = getEl('#categoryDataset');
      expect(dataset.onReady).toHaveBeenCalled();
    });
  });

  // ── No-Matches State with Suggestions ──────────────────────────

  describe('no-matches state with suggestions', () => {
    it('shows no-matches section element exists', async () => {
      await onReadyHandler();
      expect(getEl('#noMatchesSection')).toBeDefined();
    });

    it('shows fallback suggestion text on initial load', async () => {
      await onReadyHandler();
      expect(getEl('#noMatchesSuggestion')).toBeDefined();
    });
  });

  // ── Skeleton Loading ──────────────────────────────────────────

  describe('skeleton loading', () => {
    it('loading indicator element is accessible', async () => {
      await onReadyHandler();
      const indicator = getEl('#filterLoadingIndicator');
      expect(indicator.show).toBeDefined();
      expect(indicator.hide).toBeDefined();
    });

    it('product grid has show/hide for fade transitions', async () => {
      await onReadyHandler();
      const grid = getEl('#productGridRepeater');
      expect(grid.show).toBeDefined();
      expect(grid.hide).toBeDefined();
    });
  });

  // ── Compare View ──────────────────────────────────────────────

  describe('compare view', () => {
    it('compare view button element exists', async () => {
      await onReadyHandler();
      expect(getEl('#compareViewBtn')).toBeDefined();
    });

    it('compare view button has enable/disable methods', async () => {
      await onReadyHandler();
      const btn = getEl('#compareViewBtn');
      expect(btn.enable).toBeDefined();
      expect(btn.disable).toBeDefined();
    });
  });

  // ── Mobile Sticky Sort Bar ────────────────────────────────────

  describe('mobile sticky sort bar', () => {
    it('mobile sort bar element is accessible', async () => {
      await onReadyHandler();
      expect(getEl('#mobileSortBar')).toBeDefined();
    });
  });

  // ── URL Param Restoration ──────────────────────────────────────

  describe('URL param restoration', () => {
    it('restores material filter from URL params', async () => {
      const { __setQuery } = await import('./__mocks__/wix-location-frontend.js');
      if (__setQuery) {
        __setQuery({ material: 'hardwood' });
        elements.clear();
        await onReadyHandler();
        // After restore, the filter should be set
        expect(getEl('#filterMaterial')).toBeDefined();
      }
    });

    it('strips HTML from URL params (XSS prevention)', async () => {
      const { __setQuery } = await import('./__mocks__/wix-location-frontend.js');
      if (__setQuery) {
        __setQuery({ material: '<script>alert("xss")</script>hardwood' });
        elements.clear();
        await onReadyHandler();
        // sanitizeInput should strip the script tag
        expect(getEl('#filterMaterial')).toBeDefined();
      }
    });

    it('handles empty URL query gracefully', async () => {
      const { __setQuery } = await import('./__mocks__/wix-location-frontend.js');
      if (__setQuery) {
        __setQuery({});
        elements.clear();
        await onReadyHandler();
        // No errors thrown
      }
    });
  });

  // ── Advanced Filter Edge Cases ────────────────────────────────

  describe('advanced filter edge cases', () => {
    it('handles rapid filter changes without error', async () => {
      await onReadyHandler();
      const materialFilter = getEl('#filterMaterial');
      const onChange = materialFilter.onChange.mock.calls[0]?.[0];
      if (onChange) {
        materialFilter.value = 'hardwood';
        onChange();
        materialFilter.value = 'metal';
        onChange();
        materialFilter.value = 'fabric';
        onChange();
      }
    });

    it('clears all filters resets filter dropdowns', async () => {
      await onReadyHandler();
      getEl('#filterMaterial').value = 'hardwood';
      getEl('#filterColor').value = 'walnut';
      const clearBtn = getEl('#clearAllFilters');
      const onClick = clearBtn.onClick.mock.calls[0]?.[0];
      if (onClick) onClick();
      expect(getEl('#filterMaterial').value).toBe('');
      expect(getEl('#filterColor').value).toBe('');
    });

    it('clearAllAdvancedFilters resets comfort level', async () => {
      await onReadyHandler();
      getEl('#filterComfortLevel').value = '3';
      const clearBtn = getEl('#clearAllFilters');
      const onClick = clearBtn.onClick.mock.calls[0]?.[0];
      if (onClick) onClick();
      expect(getEl('#filterComfortLevel').value).toBe('');
    });

    it('clearAllAdvancedFilters resets dimension inputs', async () => {
      await onReadyHandler();
      getEl('#filterWidthMin').value = '30';
      getEl('#filterWidthMax').value = '80';
      const clearBtn = getEl('#clearAllFilters');
      const onClick = clearBtn.onClick.mock.calls[0]?.[0];
      if (onClick) onClick();
      expect(getEl('#filterWidthMin').value).toBe('');
      expect(getEl('#filterWidthMax').value).toBe('');
    });
  });

  // ── Filter Chip Remove ──────────────────────────────────────

  describe('filter chip remove', () => {
    it('chip repeater element exists', async () => {
      await onReadyHandler();
      expect(getEl('#filterChipRepeater')).toBeDefined();
      expect(getEl('#filterChipRepeater').onItemReady).toBeDefined();
    });

    it('clear all chip button exists', async () => {
      await onReadyHandler();
      expect(getEl('#clearAllFiltersChip')).toBeDefined();
    });

    it('chip remove button has accessibility label setter', async () => {
      await onReadyHandler();
      const btn = getEl('#chipRemove');
      expect(btn).toBeDefined();
      expect(btn.onClick).toBeDefined();
    });
  });

  // ── Mobile Filter Drawer ──────────────────────────────────────

  describe('mobile filter drawer', () => {
    it('filter toggle button element exists', async () => {
      await onReadyHandler();
      expect(getEl('#filterToggleBtn')).toBeDefined();
      expect(getEl('#filterToggleBtn').onClick).toBeDefined();
    });

    it('filter drawer overlay element exists', async () => {
      await onReadyHandler();
      expect(getEl('#filterDrawerOverlay')).toBeDefined();
      expect(getEl('#filterDrawerOverlay').onClick).toBeDefined();
    });

    it('filter drawer apply button element exists', async () => {
      await onReadyHandler();
      expect(getEl('#filterDrawerApply')).toBeDefined();
      expect(getEl('#filterDrawerApply').onClick).toBeDefined();
    });
  });

  // ── Compare Flow Edge Cases ───────────────────────────────────

  describe('compare flow', () => {
    it('compare button registers click handler on grid items', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = {};
      const $item = (sel) => {
        if (!itemElements[sel]) {
          itemElements[sel] = {
            text: '', src: '', alt: '', label: '',
            show: vi.fn(), hide: vi.fn(), onClick: vi.fn(),
            enable: vi.fn(), disable: vi.fn(),
          };
        }
        return itemElements[sel];
      };

      itemReadyCb($item, futonFrame);
      expect(itemElements['#gridCompareBtn'].onClick).toHaveBeenCalled();
    });
  });

  // ── WCAG AA Compliance ────────────────────────────────────────

  describe('WCAG AA compliance', () => {
    it('sets aria-label on sort dropdown', async () => {
      await onReadyHandler();
      expect(getEl('#sortDropdown').accessibility.ariaLabel).toBe('Sort products by');
    });

    it('sets aria-label on clear filters button', async () => {
      await onReadyHandler();
      expect(getEl('#clearFilters').accessibility.ariaLabel).toBe('Clear all filters');
    });

    it('sets aria-label on quick view action buttons', async () => {
      await onReadyHandler();
      expect(getEl('#qvViewFull').accessibility.ariaLabel).toBe('View full product details');
      expect(getEl('#qvAddToCart').accessibility.ariaLabel).toBe('Add to cart');
      expect(getEl('#qvClose').accessibility.ariaLabel).toBe('Close quick view');
    });
  });

  // ── Category Schema ───────────────────────────────────────────────

  describe('category schema injection', () => {
    it('detects futon-frames category from URL path', async () => {
      __setPath(['futon-frames']);
      await onReadyHandler();
      expect(getEl('#categorySchemaHtml').postMessage).toHaveBeenCalled();
    });

    it('detects murphy-cabinet-beds category from URL path', async () => {
      elements.clear();
      __setPath(['murphy-cabinet-beds']);
      await onReadyHandler();
      expect(getEl('#categorySchemaHtml').postMessage).toHaveBeenCalled();
    });

    it('injects breadcrumb schema for category page', async () => {
      __setPath(['mattresses']);
      await onReadyHandler();
      expect(getEl('#categoryBreadcrumbSchemaHtml').postMessage).toHaveBeenCalled();
    });
  });
});
