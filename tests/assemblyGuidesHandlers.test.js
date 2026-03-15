import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', placeholder: '',
    options: [], data: [], html: '', link: '', target: '',
    style: { color: '', fontWeight: '', backgroundColor: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
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

// ── Backend mocks ────────────────────────────────────────────────────

const mockGuides = [
  { _id: 'g1', sku: 'KD-123', title: 'Futon Frame Assembly', category: 'frames', estimatedTime: 45, hasPdf: true, hasVideo: true },
];

const mockGuideDetail = {
  title: 'Futon Frame Assembly', category: 'frames', estimatedTime: 45,
  steps: '<ol><li>Step 1</li></ol>', tips: 'Use a level',
  videoUrl: 'https://youtube.com/watch?v=abc', pdfUrl: 'https://cdn/guide.pdf',
};

const mockCareTips = [{ title: 'Wood Care', tip: 'Dust regularly' }];

vi.mock('backend/assemblyGuides.web', () => ({
  listAssemblyGuides: vi.fn(() => Promise.resolve(mockGuides)),
  getAssemblyGuide: vi.fn(() => Promise.resolve(mockGuideDetail)),
  getCareTips: vi.fn(() => Promise.resolve(mockCareTips)),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/assemblyGuideHelpers.js', () => ({
  getGuideCategories: vi.fn(() => [{ id: 'frames', label: 'Futon Frames', icon: '🛏️' }]),
  groupGuidesByCategory: vi.fn(),
  filterGuides: vi.fn((guides, cat, query) => guides),
  buildVideoEmbedUrl: vi.fn((url) => 'https://youtube.com/embed/abc'),
  formatEstimatedTime: vi.fn((min) => `${min} minutes`),
  buildHowToSchema: vi.fn(() => ({ '@type': 'HowTo' })),
  getCategoryLabel: vi.fn((cat) => cat === 'frames' ? 'Futon Frames' : cat),
  getCategoryIcon: vi.fn((cat) => '🛏️'),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

// ── Import mocks for assertion access ────────────────────────────────

import { listAssemblyGuides } from 'backend/assemblyGuides.web';
import { trackEvent } from 'public/engagementTracker';
import { initBackToTop } from 'public/mobileHelpers';
import { announce, makeClickable } from 'public/a11yHelpers';
import { initPageSeo } from 'public/pageSeo.js';
import { filterGuides, formatEstimatedTime, getCategoryLabel, getCategoryIcon } from 'public/assemblyGuideHelpers.js';

// ── Test Suite ───────────────────────────────────────────────────────

describe('Assembly Guides page', () => {
  beforeAll(async () => {
    await import('../src/pages/Assembly Guides.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // 1. Init: initBackToTop, initPageSeo, trackEvent page_view
  describe('initialisation', () => {
    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with assemblyGuides', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('assemblyGuides');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'assembly-guides' });
    });
  });

  // 2. Load guides: calls listAssemblyGuides, renders guide list
  describe('loading guides', () => {
    it('calls listAssemblyGuides and populates repeater data', async () => {
      await onReadyHandler();
      expect(listAssemblyGuides).toHaveBeenCalled();
      const repeater = getEl('#guideListRepeater');
      expect(repeater.data.length).toBe(1);
      expect(repeater.data[0].title).toBe('Futon Frame Assembly');
    });
  });

  // 3. Loading state: shows/hides loading indicator
  describe('loading state', () => {
    it('collapses loading indicator after guides load', async () => {
      await onReadyHandler();
      const loading = getEl('#guideLoading');
      expect(loading.collapse).toHaveBeenCalled();
    });

    it('expands guide list after loading completes', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      expect(repeater.expand).toHaveBeenCalled();
    });
  });

  // 4. Guide count announce
  describe('guide count announcement', () => {
    it('announces number of guides available', async () => {
      await onReadyHandler();
      expect(announce).toHaveBeenCalledWith($w, '1 assembly guide available');
    });
  });

  // 5. Category filters
  describe('category filters', () => {
    it('sets ARIA label on category repeater', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#guideCategoryRepeater');
      expect(catRepeater.accessibility.ariaLabel).toBe('Assembly guide category filters');
    });

    it('populates category data with All Guides plus categories', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#guideCategoryRepeater');
      expect(catRepeater.data.length).toBe(2);
      expect(catRepeater.data[0].label).toBe('All Guides');
      expect(catRepeater.data[1].label).toBe('Futon Frames');
    });

    it('onItemReady sets category label with ARIA attributes', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#guideCategoryRepeater');
      const onItemReadyCb = catRepeater.onItemReady.mock.calls[0][0];
      const mockItem = (sel) => getEl(`catItem-${sel}`);
      const itemData = { id: 'frames', label: 'Futon Frames', icon: '🛏️' };
      onItemReadyCb(mockItem, itemData);
      expect(getEl('catItem-#catLabel').text).toContain('Futon Frames');
      expect(getEl('catItem-#catLabel').accessibility.ariaLabel).toBe('Filter: Futon Frames');
      expect(getEl('catItem-#catLabel').accessibility.tabIndex).toBe(0);
    });
  });

  // 6. Category click
  describe('category click', () => {
    it('tracks assembly_guide_category event and announces selection', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#guideCategoryRepeater');
      const onItemReadyCb = catRepeater.onItemReady.mock.calls[0][0];
      const mockItem = (sel) => getEl(`catClick-${sel}`);
      const itemData = { id: 'frames', label: 'Futon Frames', icon: '🛏️' };
      onItemReadyCb(mockItem, itemData);
      // Trigger the onClick handler
      const clickCb = getEl('catClick-#catLabel').onClick.mock.calls[0][0];
      clickCb();
      expect(trackEvent).toHaveBeenCalledWith('assembly_guide_category', { category: 'Futon Frames' });
      expect(announce).toHaveBeenCalledWith($w, 'Showing Futon Frames');
    });
  });

  // 7. Search input
  describe('search input', () => {
    it('sets ARIA label on search input', async () => {
      await onReadyHandler();
      const searchInput = getEl('#guideSearchInput');
      expect(searchInput.accessibility.ariaLabel).toBe('Search assembly guides');
    });

    it('registers onKeyPress handler on search input', async () => {
      await onReadyHandler();
      const searchInput = getEl('#guideSearchInput');
      expect(searchInput.onKeyPress).toHaveBeenCalled();
    });
  });

  // 8. Guide list repeater
  describe('guide list repeater', () => {
    it('sets ARIA label on guide list repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      expect(repeater.accessibility.ariaLabel).toBe('Assembly guides list');
    });

    it('onItemReady sets title, category, time, pdf badge, and video badge', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
      const mockItem = (sel) => getEl(`guideItem-${sel}`);
      const itemData = { _id: 'g1', sku: 'KD-123', title: 'Futon Frame Assembly', category: 'frames', estimatedTime: 45, hasPdf: true, hasVideo: true };
      onItemReadyCb(mockItem, itemData);
      expect(getEl('guideItem-#guideTitle').text).toBe('Futon Frame Assembly');
      expect(getEl('guideItem-#guideCategory').text).toContain('Futon Frames');
      expect(getEl('guideItem-#guideTime').text).toContain('45 minutes');
      expect(getEl('guideItem-#guidePdfBadge').text).toContain('PDF');
      expect(getEl('guideItem-#guideVideoBadge').text).toContain('Video');
    });
  });

  // 9. Guide list ARIA
  describe('guide list ARIA', () => {
    it('sets ariaLabel and tabIndex on guide title', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
      const mockItem = (sel) => getEl(`guideAria-${sel}`);
      const itemData = { _id: 'g1', sku: 'KD-123', title: 'Futon Frame Assembly', category: 'frames', estimatedTime: 45, hasPdf: true, hasVideo: true };
      onItemReadyCb(mockItem, itemData);
      expect(getEl('guideAria-#guideTitle').accessibility.ariaLabel).toBe('View assembly guide: Futon Frame Assembly');
      expect(getEl('guideAria-#guideTitle').accessibility.tabIndex).toBe(0);
    });
  });

  // 10. Guide view: makeClickable on title and view button, tracks event
  describe('guide view interaction', () => {
    it('calls makeClickable on guide title and view button', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
      const mockItem = (sel) => getEl(`guideView-${sel}`);
      const itemData = { _id: 'g1', sku: 'KD-123', title: 'Futon Frame Assembly', category: 'frames', estimatedTime: 45, hasPdf: true, hasVideo: true };
      onItemReadyCb(mockItem, itemData);
      expect(makeClickable).toHaveBeenCalledWith(getEl('guideView-#guideTitle'), expect.any(Function));
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('guideView-#guideViewBtn'),
        expect.any(Function),
        { ariaLabel: 'View assembly guide: Futon Frame Assembly' }
      );
    });

    it('tracks assembly_guide_view when guide is opened', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
      const mockItem = (sel) => getEl(`guideTrack-${sel}`);
      const itemData = { _id: 'g1', sku: 'KD-123', title: 'Futon Frame Assembly', category: 'frames', estimatedTime: 45, hasPdf: true, hasVideo: true };
      onItemReadyCb(mockItem, itemData);
      // Get the openGuide callback passed to makeClickable for the title
      const openGuide = makeClickable.mock.calls.find(c => c[0] === getEl('guideTrack-#guideTitle'))[1];
      await openGuide();
      expect(trackEvent).toHaveBeenCalledWith('assembly_guide_view', { sku: 'KD-123', title: 'Futon Frame Assembly' });
    });
  });

  // 11. Guide detail: back button wired via makeClickable
  describe('guide detail back button', () => {
    it('wires back button via makeClickable with ARIA label', async () => {
      await onReadyHandler();
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('#guideBackBtn'),
        expect.any(Function),
        { ariaLabel: 'Back to guides list' }
      );
    });
  });

  // 12. Care tips repeater
  describe('care tips repeater', () => {
    it('sets ARIA label on care tips repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#careTipsRepeater');
      expect(repeater.accessibility.ariaLabel).toBe('Product care tips');
    });

    it('onItemReady sets care tip title and text', async () => {
      await onReadyHandler();
      const repeater = getEl('#careTipsRepeater');
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
      const mockItem = (sel) => getEl(`careTip-${sel}`);
      const itemData = { title: 'Wood Care', tip: 'Dust regularly' };
      onItemReadyCb(mockItem, itemData);
      expect(getEl('careTip-#careTipTitle').text).toBe('Wood Care');
      expect(getEl('careTip-#careTipText').text).toBe('Dust regularly');
    });
  });

  // 13. Load error: shows error message on listAssemblyGuides failure
  describe('load error handling', () => {
    it('shows error message when listAssemblyGuides rejects', async () => {
      listAssemblyGuides.mockRejectedValueOnce(new Error('Network error'));
      await onReadyHandler();
      const noResults = getEl('#guideNoResults');
      expect(noResults.text).toBe('Unable to load assembly guides. Please try again later.');
      expect(noResults.expand).toHaveBeenCalled();
    });
  });
});
