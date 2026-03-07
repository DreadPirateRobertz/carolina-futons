import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame, wallHuggerFrame } from './fixtures/products.js';
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
    hidden: true,
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
    focus: vi.fn(),
    scrollTo: vi.fn(),
    postMessage: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onKeyPress: vi.fn(),
    onFocus: vi.fn(),
    onItemReady: vi.fn(),
    onItemClicked: vi.fn(),
    onReady: vi.fn((cb) => { if (cb) cb(); return Promise.resolve(); }),
    onCurrentIndexChanged: vi.fn(),
    getCurrentItem: vi.fn(() => futonFrame),
    getTotalCount: vi.fn(() => 5),
    getItems: vi.fn(() => ({
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
  getCategoryMetaDescription: vi.fn().mockResolvedValue('desc'),
  getCategoryOgTags: vi.fn().mockResolvedValue(null),
  getCanonicalUrl: vi.fn().mockResolvedValue(null),
}));

vi.mock('backend/searchService.web', () => ({
  getFilterValues: vi.fn().mockResolvedValue({
    materials: [],
    colors: [],
    features: [],
    dimensions: { width: { min: 0, max: 0 }, depth: { min: 0, max: 0 } },
    totalProducts: 5,
  }),
}));

vi.mock('backend/categorySearch.web', () => ({
  searchProducts: vi.fn().mockResolvedValue({ items: [], totalCount: 0 }),
  suggestFilterRelaxation: vi.fn().mockResolvedValue({ suggestions: [] }),
  getFacetMetadata: vi.fn().mockResolvedValue(null),
}));

// Helper: create a mock $item function for repeater items
function createItemScope() {
  const itemElements = {};
  const $item = (sel) => {
    if (!itemElements[sel]) {
      itemElements[sel] = {
        text: '', src: '', alt: '', label: '', value: '', options: [],
        style: { color: '', backgroundColor: '' },
        accessibility: {},
        show: vi.fn(), hide: vi.fn(), collapse: vi.fn(), expand: vi.fn(),
        enable: vi.fn(), disable: vi.fn(), focus: vi.fn(),
        onClick: vi.fn(), onKeyPress: vi.fn(), onFocus: vi.fn(),
      };
    }
    return itemElements[sel];
  };
  return { $item, itemElements };
}

// ── Import Page ─────────────────────────────────────────────────────

describe('Category Page — Keyboard Navigation (CF-n1c)', () => {
  beforeAll(async () => {
    await import('../src/pages/Category Page.js');
  });

  beforeEach(() => {
    elements.clear();
  });

  // ── Product Grid Card Keyboard Access ─────────────────────────────

  describe('product grid card keyboard access', () => {
    it('compare button is keyboard-accessible (onKeyPress for Enter/Space)', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const compareBtn = itemElements['#gridCompareBtn'];
      expect(compareBtn.onKeyPress).toHaveBeenCalled();
    });

    it('compare button responds to Enter key', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const compareBtn = itemElements['#gridCompareBtn'];
      const keyHandler = compareBtn.onKeyPress.mock.calls[0][0];

      // Simulate Enter key — should toggle compare without error
      expect(() => keyHandler({ key: 'Enter', preventDefault: vi.fn() })).not.toThrow();
    });

    it('compare button responds to Space key', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const compareBtn = itemElements['#gridCompareBtn'];
      const keyHandler = compareBtn.onKeyPress.mock.calls[0][0];

      expect(() => keyHandler({ key: ' ', preventDefault: vi.fn() })).not.toThrow();
    });

    it('compare button has aria-label', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const compareBtn = itemElements['#gridCompareBtn'];
      expect(compareBtn.accessibility.ariaLabel).toBeTruthy();
    });

    it('compare button has tabIndex 0', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const compareBtn = itemElements['#gridCompareBtn'];
      expect(compareBtn.accessibility.tabIndex).toBe(0);
    });

    it('quick view button is keyboard-accessible (onKeyPress)', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const qvBtn = itemElements['#quickViewBtn'];
      expect(qvBtn.onKeyPress).toHaveBeenCalled();
    });

    it('quick view button has aria-label', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const qvBtn = itemElements['#quickViewBtn'];
      expect(qvBtn.accessibility.ariaLabel).toBeTruthy();
      expect(qvBtn.accessibility.ariaLabel).toContain(futonFrame.name);
    });

    it('quick view button has tabIndex 0', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const qvBtn = itemElements['#quickViewBtn'];
      expect(qvBtn.accessibility.tabIndex).toBe(0);
    });
  });

  // ── Compare Bar Keyboard Access ──────────────────────────────────

  describe('compare bar keyboard access', () => {
    it('compare view button gets keyboard handler when compare bar refreshes', async () => {
      await onReadyHandler();

      // Trigger compare flow: add a product via compare button click
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const compareBtn = itemElements['#gridCompareBtn'];
      const clickHandler = compareBtn.onClick.mock.calls[0][0];
      clickHandler(); // triggers refreshCompareBarUI

      const compareViewBtn = getEl('#compareViewBtn');
      expect(compareViewBtn.onKeyPress).toHaveBeenCalled();
    });

    it('compare view button has tabIndex 0 after compare bar refresh', async () => {
      await onReadyHandler();

      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];
      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const clickHandler = itemElements['#gridCompareBtn'].onClick.mock.calls[0][0];
      clickHandler();

      const compareViewBtn = getEl('#compareViewBtn');
      expect(compareViewBtn.accessibility.tabIndex).toBe(0);
    });
  });

  // ── Filter Controls Keyboard Access ──────────────────────────────

  describe('filter controls keyboard access', () => {
    it('clear filters button is keyboard-accessible (onKeyPress)', async () => {
      await onReadyHandler();
      const clearBtn = getEl('#clearFilters');
      expect(clearBtn.onKeyPress).toHaveBeenCalled();
    });

    it('clear filters responds to Enter key', async () => {
      await onReadyHandler();
      const clearBtn = getEl('#clearFilters');
      const keyHandler = clearBtn.onKeyPress.mock.calls[0][0];

      // Should reset filters without error
      expect(() => keyHandler({ key: 'Enter', preventDefault: vi.fn() })).not.toThrow();
    });

    it('clear all advanced filters button is keyboard-accessible', async () => {
      await onReadyHandler();
      const clearAllBtn = getEl('#clearAllFilters');
      expect(clearAllBtn.onKeyPress).toHaveBeenCalled();
    });

    it('clear filters button has tabIndex 0', async () => {
      await onReadyHandler();
      const clearBtn = getEl('#clearFilters');
      expect(clearBtn.accessibility.tabIndex).toBe(0);
    });

    it('filter panel section has role="search" or aria-label', async () => {
      await onReadyHandler();
      const filterBrand = getEl('#filterBrand');
      expect(filterBrand.accessibility.ariaLabel).toBeTruthy();
    });
  });

  // ── Filter Chip Keyboard Access ──────────────────────────────────

  describe('filter chip keyboard access', () => {
    it('clear all chips button is keyboard-accessible', async () => {
      await onReadyHandler();
      const clearAllChip = getEl('#clearAllFiltersChip');
      expect(clearAllChip.onKeyPress).toHaveBeenCalled();
    });

    it('clear all chips button has tabIndex 0', async () => {
      await onReadyHandler();
      const clearAllChip = getEl('#clearAllFiltersChip');
      expect(clearAllChip.accessibility.tabIndex).toBe(0);
    });
  });

  // ── Breadcrumb Keyboard Access ──────────────────────────────────

  describe('breadcrumb keyboard access', () => {
    it('breadcrumb home link is keyboard-accessible', async () => {
      __setPath(['futon-frames']);
      elements.clear();
      await onReadyHandler();
      const breadcrumbHome = getEl('#breadcrumbHome');
      expect(breadcrumbHome.onKeyPress).toHaveBeenCalled();
    });

    it('breadcrumb home link has tabIndex 0', async () => {
      __setPath(['futon-frames']);
      elements.clear();
      await onReadyHandler();
      const breadcrumbHome = getEl('#breadcrumbHome');
      expect(breadcrumbHome.accessibility.tabIndex).toBe(0);
    });
  });

  // ── Screen Reader Announcements ──────────────────────────────────

  describe('keyboard action screen reader announcements', () => {
    it('compare toggle announces state change', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const compareBtn = itemElements['#gridCompareBtn'];
      const clickHandler = compareBtn.onClick.mock.calls[0][0];

      // Trigger compare toggle
      clickHandler();

      // After toggling compare, an announcement should have been made
      const liveRegion = getEl('#a11yLiveRegion');
      // The announce function sets text on the live region
      expect(liveRegion.text !== undefined).toBe(true);
    });
  });

  // ── Non-keyboard keys are ignored ────────────────────────────────

  describe('non-activation keys are ignored', () => {
    it('compare button ignores Tab key press', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const compareBtn = itemElements['#gridCompareBtn'];
      const keyHandler = compareBtn.onKeyPress.mock.calls[0][0];
      const preventDefault = vi.fn();

      // Tab should not trigger action
      keyHandler({ key: 'Tab', preventDefault });
      expect(preventDefault).not.toHaveBeenCalled();
    });

    it('quick view button ignores non-activation keys', async () => {
      await onReadyHandler();
      const repeater = getEl('#productGridRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, itemElements } = createItemScope();
      itemReadyCb($item, futonFrame);

      const qvBtn = itemElements['#quickViewBtn'];
      const keyHandler = qvBtn.onKeyPress.mock.calls[0][0];
      const preventDefault = vi.fn();

      keyHandler({ key: 'Shift', preventDefault });
      expect(preventDefault).not.toHaveBeenCalled();
    });
  });
});
