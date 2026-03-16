/**
 * Tests for pages/Assembly Guides.js
 * Covers: page init, category filters, search, guide list, guide detail,
 * care tips, SEO schema, loading states, navigation.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { createMockElement, createItemScope } from './helpers/wixMocks.js';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Mock Data ───────────────────────────────────────────────────────

const mockGuides = [
  {
    _id: 'ag-1', sku: 'NDF-SEATTLE', title: 'Seattle Futon Frame Assembly',
    category: 'futon-frames', estimatedTime: '30 minutes',
    hasPdf: true, hasVideo: true,
  },
  {
    _id: 'ag-2', sku: 'ARA-MURPHY', title: 'Murphy Cabinet Bed Setup',
    category: 'murphy-cabinet-beds', estimatedTime: '45 minutes',
    hasPdf: true, hasVideo: false,
  },
  {
    _id: 'ag-3', sku: 'NDF-NOMAD', title: 'Nomad Platform Bed Assembly',
    category: 'platform-beds', estimatedTime: '20 minutes',
    hasPdf: false, hasVideo: false,
  },
];

const mockGuideDetail = {
  _id: 'ag-1', sku: 'NDF-SEATTLE', title: 'Seattle Futon Frame Assembly',
  category: 'futon-frames', estimatedTime: '30 minutes',
  steps: '<ol><li>Unbox</li><li>Attach arms</li></ol>',
  tips: 'Use a Phillips screwdriver',
  videoUrl: 'https://youtube.com/watch?v=abc123',
  pdfUrl: 'https://cdn.example.com/seattle.pdf',
};

const mockCareTips = [
  { title: 'Wood Care', tip: 'Dust weekly with a soft cloth' },
  { title: 'Hardware Check', tip: 'Tighten bolts every 6 months' },
];

// ── Mock Dependencies ───────────────────────────────────────────────

const listAssemblyGuides = vi.fn().mockResolvedValue(mockGuides);
const getAssemblyGuide = vi.fn().mockResolvedValue(mockGuideDetail);
const getCareTips = vi.fn().mockResolvedValue(mockCareTips);

vi.mock('backend/assemblyGuides.web', () => ({
  listAssemblyGuides: (...args) => listAssemblyGuides(...args),
  getAssemblyGuide: (...args) => getAssemblyGuide(...args),
  getCareTips: (...args) => getCareTips(...args),
}));

const trackEvent = vi.fn();
vi.mock('public/engagementTracker', () => ({
  trackEvent: (...args) => trackEvent(...args),
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

const announce = vi.fn();
const makeClickable = vi.fn();
vi.mock('public/a11yHelpers', () => ({
  announce: (...args) => announce(...args),
  makeClickable: (...args) => makeClickable(...args),
}));

const mockCategories = [
  { id: 'futon-frames', label: 'Futon Frames', description: 'Assembly guides for futon frames', icon: '🛋️' },
  { id: 'murphy-cabinet-beds', label: 'Murphy Cabinet Beds', description: 'Assembly guides for murphy beds', icon: '🛏️' },
  { id: 'platform-beds', label: 'Platform Beds', description: 'Assembly guides for platform beds', icon: '🪵' },
  { id: 'mattresses', label: 'Mattresses', description: 'Setup guides for mattresses', icon: '💤' },
];

vi.mock('public/assemblyGuideHelpers.js', () => ({
  getGuideCategories: vi.fn(() => mockCategories),
  groupGuidesByCategory: vi.fn(),
  filterGuides: vi.fn((guides, cat, query) => {
    let result = guides || [];
    if (cat) result = result.filter(g => g.category === cat);
    if (query) result = result.filter(g =>
      g.title.toLowerCase().includes(query.toLowerCase()) ||
      g.sku.toLowerCase().includes(query.toLowerCase())
    );
    return result;
  }),
  buildVideoEmbedUrl: vi.fn((url) => url ? `https://www.youtube.com/embed/abc123` : null),
  formatEstimatedTime: vi.fn((t) => t ? t.trim() : ''),
  buildHowToSchema: vi.fn((guide) => guide ? { '@type': 'HowTo', name: guide.title } : null),
  getCategoryLabel: vi.fn((cat) => {
    const found = mockCategories.find(c => c.id === cat);
    return found ? found.label : cat || '';
  }),
  getCategoryIcon: vi.fn((cat) => {
    const found = mockCategories.find(c => c.id === cat);
    return found ? found.icon : '📋';
  }),
}));

vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));

// ── Helpers ─────────────────────────────────────────────────────────

const flushAsync = () => new Promise(r => setTimeout(r, 50));

// ── Import Page ─────────────────────────────────────────────────────

describe('Assembly Guides Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Assembly Guides.js');
  });

  beforeEach(() => {
    elements.clear();
    listAssemblyGuides.mockClear();
    getAssemblyGuide.mockClear();
    getCareTips.mockClear();
    trackEvent.mockClear();
    announce.mockClear();
    makeClickable.mockClear();
    listAssemblyGuides.mockResolvedValue(mockGuides);
    getAssemblyGuide.mockResolvedValue(mockGuideDetail);
    getCareTips.mockResolvedValue(mockCareTips);
  });

  // ── Page Init ───────────────────────────────────────────────────

  describe('page initialization', () => {
    it('calls listAssemblyGuides on ready', async () => {
      await onReadyHandler();
      expect(listAssemblyGuides).toHaveBeenCalled();
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'assembly-guides' });
    });

    it('announces guide count after loading', async () => {
      await onReadyHandler();
      expect(announce).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('3 assembly guides available')
      );
    });

    it('populates guide list repeater with data', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      expect(repeater.data).toHaveLength(3);
      expect(repeater.data[0]._id).toBe('ag-1');
    });
  });

  // ── Loading States ──────────────────────────────────────────────

  describe('loading states', () => {
    it('shows loading indicator during fetch', async () => {
      let resolveGuides;
      listAssemblyGuides.mockReturnValue(new Promise(r => { resolveGuides = r; }));

      const readyPromise = onReadyHandler();
      // loading should be expanded before guides resolve
      expect(getEl('#guideLoading').expand).toHaveBeenCalled();

      resolveGuides(mockGuides);
      await readyPromise;
    });

    it('hides loading after guides load', async () => {
      await onReadyHandler();
      expect(getEl('#guideLoading').collapse).toHaveBeenCalled();
      expect(getEl('#guideListRepeater').expand).toHaveBeenCalled();
    });

    it('shows error message when listAssemblyGuides fails', async () => {
      listAssemblyGuides.mockRejectedValueOnce(new Error('Network error'));
      await onReadyHandler();
      expect(getEl('#guideNoResults').text).toContain('Unable to load');
    });
  });

  // ── Category Filters ────────────────────────────────────────────

  describe('category filters', () => {
    it('populates category repeater with categories + all option', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#guideCategoryRepeater');
      // 4 categories + 1 "All Guides" = 5
      expect(catRepeater.data.length).toBe(5);
      expect(catRepeater.data[0].label).toBe('All Guides');
    });

    it('registers onItemReady on category repeater', async () => {
      await onReadyHandler();
      expect(getEl('#guideCategoryRepeater').onItemReady).toHaveBeenCalled();
    });

    it('sets ARIA label on category repeater', async () => {
      await onReadyHandler();
      expect(getEl('#guideCategoryRepeater').accessibility.ariaLabel).toContain('category');
    });

    it('onItemReady sets category label text', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#guideCategoryRepeater');
      const itemReadyCb = catRepeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, { _id: 'cat-futon-frames', id: 'futon-frames', label: 'Futon Frames', icon: '🛋️' });
      expect(els.get('#catLabel').text).toContain('Futon Frames');
    });

    it('onItemReady registers onClick for category selection', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#guideCategoryRepeater');
      const itemReadyCb = catRepeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, { _id: 'cat-futon-frames', id: 'futon-frames', label: 'Futon Frames', icon: '🛋️' });
      expect(els.get('#catLabel').onClick).toHaveBeenCalled();
    });

    it('category click triggers filter and tracking', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#guideCategoryRepeater');
      const itemReadyCb = catRepeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, { _id: 'cat-futon-frames', id: 'futon-frames', label: 'Futon Frames', icon: '🛋️' });

      // Invoke the onClick handler
      trackEvent.mockClear();
      announce.mockClear();
      const clickHandler = els.get('#catLabel').onClick.mock.calls[0][0];
      clickHandler();

      expect(trackEvent).toHaveBeenCalledWith('assembly_guide_category', { category: 'Futon Frames' });
      expect(announce).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Futon Frames'));
    });

    it('All Guides category resets filter to show all', async () => {
      await onReadyHandler();
      const catRepeater = getEl('#guideCategoryRepeater');
      const itemReadyCb = catRepeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      // The "All Guides" option has empty id
      itemReadyCb($item, { _id: 'cat-all', id: '', label: 'All Guides', icon: '📋' });
      const clickHandler = els.get('#catLabel').onClick.mock.calls[0][0];
      clickHandler();

      // List should show all guides (filter with null category)
      const repeater = getEl('#guideListRepeater');
      expect(repeater.data).toHaveLength(3);
    });
  });

  // ── Search ──────────────────────────────────────────────────────

  describe('search', () => {
    it('registers onKeyPress on search input', async () => {
      await onReadyHandler();
      expect(getEl('#guideSearchInput').onKeyPress).toHaveBeenCalled();
    });

    it('sets ARIA label on search input', async () => {
      await onReadyHandler();
      expect(getEl('#guideSearchInput').accessibility.ariaLabel).toContain('Search');
    });

    it('debounced search filters guide list', async () => {
      await onReadyHandler();
      const searchInput = getEl('#guideSearchInput');
      const keyPressCb = searchInput.onKeyPress.mock.calls[0][0];

      // Set value and trigger keypress
      searchInput.value = 'Seattle';
      keyPressCb();

      // Wait for debounce (300ms)
      await new Promise(r => setTimeout(r, 350));

      // Should filter and re-render
      const repeater = getEl('#guideListRepeater');
      expect(repeater.data).toHaveLength(1);
      expect(repeater.data[0].title).toContain('Seattle');
    });

    it('search tracks event for non-empty queries', async () => {
      await onReadyHandler();
      trackEvent.mockClear();
      const searchInput = getEl('#guideSearchInput');
      const keyPressCb = searchInput.onKeyPress.mock.calls[0][0];

      searchInput.value = 'murphy';
      keyPressCb();
      await new Promise(r => setTimeout(r, 350));

      expect(trackEvent).toHaveBeenCalledWith('assembly_guide_search', { query: 'murphy' });
    });

    it('shows no-results message when search has no matches', async () => {
      await onReadyHandler();
      const searchInput = getEl('#guideSearchInput');
      const keyPressCb = searchInput.onKeyPress.mock.calls[0][0];

      searchInput.value = 'nonexistent-product-xyz';
      keyPressCb();
      await new Promise(r => setTimeout(r, 350));

      expect(getEl('#guideNoResults').text).toContain('No guides match');
      expect(getEl('#guideNoResults').expand).toHaveBeenCalled();
    });
  });

  // ── Guide List ──────────────────────────────────────────────────

  describe('guide list', () => {
    it('registers onItemReady on guide list repeater', async () => {
      await onReadyHandler();
      expect(getEl('#guideListRepeater').onItemReady).toHaveBeenCalled();
    });

    it('sets ARIA label on guide list repeater', async () => {
      await onReadyHandler();
      expect(getEl('#guideListRepeater').accessibility.ariaLabel).toContain('guides list');
    });

    it('onItemReady sets guide title', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]);
      expect(els.get('#guideTitle').text).toBe('Seattle Futon Frame Assembly');
    });

    it('onItemReady sets category label with icon', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]);
      expect(els.get('#guideCategory').text).toContain('Futon Frames');
    });

    it('onItemReady shows estimated time with clock emoji', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]);
      expect(els.get('#guideTime').text).toContain('30 minutes');
    });

    it('onItemReady shows PDF badge when hasPdf is true', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]); // hasPdf: true
      expect(els.get('#guidePdfBadge').text).toContain('PDF');
    });

    it('onItemReady shows Video badge when hasVideo is true', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]); // hasVideo: true
      expect(els.get('#guideVideoBadge').text).toContain('Video');
    });

    it('onItemReady hides badges when hasPdf/hasVideo are false', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[2]); // hasPdf: false, hasVideo: false
      expect(els.get('#guidePdfBadge').text).toBe('');
      expect(els.get('#guideVideoBadge').text).toBe('');
    });

    it('onItemReady uses makeClickable for guide title', async () => {
      await onReadyHandler();
      makeClickable.mockClear();
      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]);

      const titleCalls = makeClickable.mock.calls.filter(
        call => call[0] === els.get('#guideTitle')
      );
      expect(titleCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('onItemReady uses makeClickable for view button', async () => {
      await onReadyHandler();
      makeClickable.mockClear();
      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]);

      const btnCalls = makeClickable.mock.calls.filter(
        call => call[0] === els.get('#guideViewBtn')
      );
      expect(btnCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('onItemReady sets ARIA label on guide title', async () => {
      await onReadyHandler();
      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]);
      expect(els.get('#guideTitle').accessibility.ariaLabel).toContain('Seattle Futon Frame Assembly');
    });

    it('guide click triggers detail load and tracking', async () => {
      await onReadyHandler();
      makeClickable.mockClear();
      trackEvent.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]);

      // Find the makeClickable call for the title and invoke its handler
      const titleCall = makeClickable.mock.calls.find(
        call => call[0] === els.get('#guideTitle')
      );
      expect(titleCall).toBeDefined();
      titleCall[1](); // invoke the openGuide handler
      await flushAsync();

      expect(getAssemblyGuide).toHaveBeenCalledWith('NDF-SEATTLE');
      expect(trackEvent).toHaveBeenCalledWith('assembly_guide_view', {
        sku: 'NDF-SEATTLE', title: 'Seattle Futon Frame Assembly',
      });
    });
  });

  // ── Guide Detail View ──────────────────────────────────────────

  describe('guide detail view', () => {
    async function openGuide() {
      await onReadyHandler();
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(
        call => call[0] === els.get('#guideTitle')
      );
      titleCall[1]();
      await flushAsync();
    }

    it('shows detail section and hides list section', async () => {
      await openGuide();
      expect(getEl('#guideListSection').collapse).toHaveBeenCalled();
      expect(getEl('#guideDetailSection').expand).toHaveBeenCalled();
    });

    it('scrolls to detail section', async () => {
      await openGuide();
      expect(getEl('#guideDetailSection').scrollTo).toHaveBeenCalled();
    });

    it('sets detail title from guide data', async () => {
      await openGuide();
      expect(getEl('#detailTitle').text).toBe('Seattle Futon Frame Assembly');
    });

    it('sets detail category with icon', async () => {
      await openGuide();
      expect(getEl('#detailCategory').text).toContain('Futon Frames');
    });

    it('sets estimated time in detail view', async () => {
      await openGuide();
      expect(getEl('#detailTime').text).toContain('30 minutes');
    });

    it('renders steps HTML and expands steps section', async () => {
      await openGuide();
      expect(getEl('#detailSteps').html).toContain('<ol>');
      expect(getEl('#detailStepsSection').expand).toHaveBeenCalled();
    });

    it('renders tips text and expands tips section', async () => {
      await openGuide();
      expect(getEl('#detailTips').text).toContain('Phillips screwdriver');
      expect(getEl('#detailTipsSection').expand).toHaveBeenCalled();
    });

    it('sets video embed URL and expands video section', async () => {
      await openGuide();
      expect(getEl('#detailVideo').src).toContain('youtube.com/embed');
      expect(getEl('#detailVideoSection').expand).toHaveBeenCalled();
    });

    it('sets video ARIA label', async () => {
      await openGuide();
      expect(getEl('#detailVideo').accessibility.ariaLabel).toContain('Video tutorial');
    });

    it('sets PDF link and expands PDF section', async () => {
      await openGuide();
      expect(getEl('#detailPdfBtn').link).toContain('seattle.pdf');
      expect(getEl('#detailPdfBtn').target).toBe('_blank');
      expect(getEl('#detailPdfSection').expand).toHaveBeenCalled();
    });

    it('sets PDF download ARIA label', async () => {
      await openGuide();
      expect(getEl('#detailPdfBtn').accessibility.ariaLabel).toContain('Download PDF');
    });

    it('collapses video section when no video URL', async () => {
      getAssemblyGuide.mockResolvedValueOnce({ ...mockGuideDetail, videoUrl: null });
      await onReadyHandler();
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();
      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(c => c[0] === els.get('#guideTitle'));
      titleCall[1]();
      await flushAsync();

      expect(getEl('#detailVideoSection').collapse).toHaveBeenCalled();
    });

    it('collapses PDF section when no PDF URL', async () => {
      getAssemblyGuide.mockResolvedValueOnce({ ...mockGuideDetail, pdfUrl: null });
      await onReadyHandler();
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();
      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(c => c[0] === els.get('#guideTitle'));
      titleCall[1]();
      await flushAsync();

      expect(getEl('#detailPdfSection').collapse).toHaveBeenCalled();
    });

    it('collapses steps section when no steps content', async () => {
      getAssemblyGuide.mockResolvedValueOnce({ ...mockGuideDetail, steps: null });
      await onReadyHandler();
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();
      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(c => c[0] === els.get('#guideTitle'));
      titleCall[1]();
      await flushAsync();

      expect(getEl('#detailStepsSection').collapse).toHaveBeenCalled();
    });

    it('shows error when guide detail fails to load', async () => {
      getAssemblyGuide.mockResolvedValueOnce(null);
      await onReadyHandler();
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();
      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(c => c[0] === els.get('#guideTitle'));
      titleCall[1]();
      await flushAsync();

      expect(getEl('#detailError').text).toContain('Guide not found');
    });

    it('announces guide title on detail load', async () => {
      announce.mockClear();
      await openGuide();
      expect(announce).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('Seattle Futon Frame Assembly')
      );
    });
  });

  // ── Back Button ─────────────────────────────────────────────────

  describe('back button', () => {
    it('registers makeClickable on back button', async () => {
      makeClickable.mockClear();
      await onReadyHandler();

      const backCalls = makeClickable.mock.calls.filter(
        call => call[0] === getEl('#guideBackBtn')
      );
      expect(backCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('back button has ARIA label', async () => {
      makeClickable.mockClear();
      await onReadyHandler();

      const backCall = makeClickable.mock.calls.find(
        call => call[0] === getEl('#guideBackBtn')
      );
      expect(backCall[2]).toEqual(expect.objectContaining({ ariaLabel: 'Back to guides list' }));
    });

    it('back click hides detail and shows list', async () => {
      makeClickable.mockClear();
      await onReadyHandler();

      const backCall = makeClickable.mock.calls.find(
        call => call[0] === getEl('#guideBackBtn')
      );
      backCall[1](); // invoke back handler

      expect(getEl('#guideDetailSection').collapse).toHaveBeenCalled();
      expect(getEl('#guideListSection').expand).toHaveBeenCalled();
    });

    it('back click tracks event', async () => {
      makeClickable.mockClear();
      trackEvent.mockClear();
      await onReadyHandler();

      const backCall = makeClickable.mock.calls.find(
        call => call[0] === getEl('#guideBackBtn')
      );
      backCall[1]();

      expect(trackEvent).toHaveBeenCalledWith('assembly_guide_back', {});
    });
  });

  // ── Care Tips ───────────────────────────────────────────────────

  describe('care tips', () => {
    it('registers onItemReady on care tips repeater', async () => {
      await onReadyHandler();
      expect(getEl('#careTipsRepeater').onItemReady).toHaveBeenCalled();
    });

    it('sets ARIA label on care tips repeater', async () => {
      await onReadyHandler();
      expect(getEl('#careTipsRepeater').accessibility.ariaLabel).toContain('care tips');
    });

    it('onItemReady sets tip title and text', async () => {
      await onReadyHandler();
      const repeater = getEl('#careTipsRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();

      itemReadyCb($item, { _id: 'tip-0', title: 'Wood Care', tip: 'Dust weekly' });
      expect(els.get('#careTipTitle').text).toBe('Wood Care');
      expect(els.get('#careTipText').text).toBe('Dust weekly');
    });

    it('expands care tips section when tips available', async () => {
      // Open a guide to trigger care tips render
      await onReadyHandler();
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();
      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(c => c[0] === els.get('#guideTitle'));
      titleCall[1]();
      await flushAsync();

      expect(getEl('#careTipsSection').expand).toHaveBeenCalled();
      expect(getEl('#careTipsRepeater').data).toHaveLength(2);
    });

    it('collapses care tips section when no tips', async () => {
      getCareTips.mockResolvedValueOnce([]);
      await onReadyHandler();
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();
      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(c => c[0] === els.get('#guideTitle'));
      titleCall[1]();
      await flushAsync();

      expect(getEl('#careTipsSection').collapse).toHaveBeenCalled();
    });
  });

  // ── SEO Schema ──────────────────────────────────────────────────

  describe('SEO schema injection', () => {
    it('injects HowTo schema into schema HTML element', async () => {
      await onReadyHandler();
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();
      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(c => c[0] === els.get('#guideTitle'));
      titleCall[1]();
      await flushAsync();

      expect(getEl('#guideSchemaHtml').postMessage).toHaveBeenCalled();
      const schemaArg = getEl('#guideSchemaHtml').postMessage.mock.calls[0][0];
      const parsed = JSON.parse(schemaArg);
      expect(parsed['@type']).toBe('HowTo');
    });

    it('does not inject schema when buildHowToSchema returns null', async () => {
      const { buildHowToSchema } = await import('public/assemblyGuideHelpers.js');
      buildHowToSchema.mockReturnValueOnce(null);

      await onReadyHandler();
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();
      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(c => c[0] === els.get('#guideTitle'));

      // Clear postMessage before triggering
      getEl('#guideSchemaHtml').postMessage.mockClear();
      titleCall[1]();
      await flushAsync();

      expect(getEl('#guideSchemaHtml').postMessage).not.toHaveBeenCalled();
    });
  });

  // ── Error Resilience ────────────────────────────────────────────

  describe('error resilience', () => {
    it('does not throw when guide detail backend rejects', async () => {
      await onReadyHandler();
      // Set rejection AFTER init so it applies to the detail load
      getAssemblyGuide.mockRejectedValue(new Error('Server error'));
      makeClickable.mockClear();

      const repeater = getEl('#guideListRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const { $item, elements: els } = createItemScope();
      itemReadyCb($item, mockGuides[0]);
      const titleCall = makeClickable.mock.calls.find(c => c[0] === els.get('#guideTitle'));

      titleCall[1]();
      await flushAsync();

      // Promise.allSettled catches the rejection; guideData is null → "Guide not found"
      expect(getEl('#detailError').text).toContain('Guide not found');
    });

    it('does not throw when category repeater is missing', async () => {
      const original = globalThis.$w;
      const throwingSelector = Object.assign(
        (sel) => {
          if (sel === '#guideCategoryRepeater') return null;
          return getEl(sel);
        },
        { onReady: original.onReady }
      );
      globalThis.$w = throwingSelector;

      await expect(onReadyHandler()).resolves.not.toThrow();

      globalThis.$w = original;
    });
  });
});
