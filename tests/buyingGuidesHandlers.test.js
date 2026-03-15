import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w mock ────────────────────────────────────────────────────────────
const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '' },
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
    focus: vi.fn(),
    disable: vi.fn(), enable: vi.fn(),
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

// ── Mock data ──────────────────────────────────────────────────────────
const mockGuides = [
  {
    _id: 'g1',
    title: 'Futon Buying Guide',
    slug: 'futon-guide',
    category: 'futons',
    description: 'How to choose',
    publishDate: '2026-01-15',
    readingTime: 8,
    heroImage: 'https://cdn/hero.jpg',
    url: '/buying-guide/futon-guide',
  },
];

const mockHub = {
  title: 'Buying Guides',
  metaDescription: 'Expert guides',
  url: 'https://carolinafutons.com/buying-guides',
  guideCount: 1,
};

const mockBreadcrumbs = [
  { label: 'Home', url: '/' },
  { label: 'Buying Guides', url: '/buying-guides' },
];

const mockCategories = [
  { slug: 'futons', label: 'Futons' },
  { slug: 'mattresses', label: 'Mattresses' },
];

// ── vi.mock declarations ───────────────────────────────────────────────
vi.mock('backend/buyingGuides.web', () => ({
  getAllBuyingGuides: vi.fn(() => Promise.resolve({ success: true, guides: mockGuides })),
}));

vi.mock('backend/seoContentHub.web', () => ({
  getContentHub: vi.fn(() => Promise.resolve({ success: true, hub: mockHub })),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getPageTitle: vi.fn(() => Promise.resolve('Buying Guides | Carolina Futons')),
  getPageMetaDescription: vi.fn(() => Promise.resolve('Expert buying guides')),
  getCanonicalUrl: vi.fn(() => Promise.resolve('https://carolinafutons.com/buying-guides')),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  default: { to: vi.fn() },
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/buyingGuidesHelpers', () => ({
  buildBreadcrumbs: vi.fn(() => mockBreadcrumbs),
  buildHubCardData: vi.fn((guides) => guides.map(g => ({ ...g, categoryLabel: 'Futons' }))),
  formatGuideDate: vi.fn((d) => d),
  getCategoryIcon: vi.fn(),
  getGuideCategories: vi.fn(() => mockCategories),
  filterGuidesByCategory: vi.fn((guides, cat) => cat === 'all' ? guides : guides.filter(g => g.category === cat)),
}));

// ── Import mocks & page ───────────────────────────────────────────────
let getAllBuyingGuides, getContentHub;
let getPageTitle, getPageMetaDescription, getCanonicalUrl;
let initPageSeo;
let initBackToTop;
let trackEvent;
let announce, makeClickable;
let buildBreadcrumbs, buildHubCardData, formatGuideDate, getCategoryIcon, getGuideCategories, filterGuidesByCategory;
let wixLocationFrontend;

beforeAll(async () => {
  ({ getAllBuyingGuides } = await import('backend/buyingGuides.web'));
  ({ getContentHub } = await import('backend/seoContentHub.web'));
  ({ getPageTitle, getPageMetaDescription, getCanonicalUrl } = await import('backend/seoHelpers.web'));
  ({ initPageSeo } = await import('public/pageSeo.js'));
  ({ initBackToTop } = await import('public/mobileHelpers'));
  ({ trackEvent } = await import('public/engagementTracker'));
  ({ announce, makeClickable } = await import('public/a11yHelpers'));
  ({
    buildBreadcrumbs, buildHubCardData, formatGuideDate,
    getCategoryIcon, getGuideCategories, filterGuidesByCategory,
  } = await import('public/buyingGuidesHelpers'));
  ({ default: wixLocationFrontend } = await import('wix-location-frontend'));

  await import('../src/pages/Buying Guides.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();

  getAllBuyingGuides.mockResolvedValue({ success: true, guides: mockGuides });
  getContentHub.mockResolvedValue({ success: true, hub: mockHub });
  getPageTitle.mockResolvedValue('Buying Guides | Carolina Futons');
  getPageMetaDescription.mockResolvedValue('Expert buying guides');
  getCanonicalUrl.mockResolvedValue('https://carolinafutons.com/buying-guides');
  buildBreadcrumbs.mockReturnValue(mockBreadcrumbs);
  buildHubCardData.mockImplementation((guides) => guides.map(g => ({ ...g, categoryLabel: 'Futons' })));
  formatGuideDate.mockImplementation((d) => d);
  getGuideCategories.mockReturnValue(mockCategories);
  filterGuidesByCategory.mockImplementation((guides, cat) => cat === 'all' ? guides : guides.filter(g => g.category === cat));
});

// ── Tests ──────────────────────────────────────────────────────────────
describe('Buying Guides Hub Page', () => {
  // 1. Init: initBackToTop, trackEvent page_view, initPageSeo('buyingGuides')
  describe('initialization', () => {
    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('tracks page_view event for buying_guides_hub', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'buying_guides_hub' });
    });

    it('calls initPageSeo with buyingGuides', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('buyingGuides');
    });
  });

  // 2. Backend calls: getAllBuyingGuides and getContentHub called
  describe('backend calls', () => {
    it('calls getAllBuyingGuides', async () => {
      await onReadyHandler();
      expect(getAllBuyingGuides).toHaveBeenCalled();
    });

    it('calls getContentHub', async () => {
      await onReadyHandler();
      expect(getContentHub).toHaveBeenCalled();
    });
  });

  // 3. Breadcrumbs: repeater data set from buildBreadcrumbs, onItemReady sets label/separator
  describe('breadcrumbs', () => {
    it('sets breadcrumb repeater data from buildBreadcrumbs', async () => {
      await onReadyHandler();
      const repeater = getEl('#breadcrumbRepeater');
      expect(buildBreadcrumbs).toHaveBeenCalled();
      expect(repeater.data).toEqual([
        { label: 'Home', url: '/', _id: 'crumb-0' },
        { label: 'Buying Guides', url: '/buying-guides', _id: 'crumb-1' },
      ]);
    });

    it('registers onItemReady on breadcrumb repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#breadcrumbRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets breadcrumb label text', async () => {
      await onReadyHandler();
      const repeater = getEl('#breadcrumbRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`breadcrumb-item-0-${sel}`);
      itemReadyCb($item, { label: 'Home', url: '/' }, 0);
      expect(getEl('breadcrumb-item-0-#breadcrumbLabel').text).toBe('Home');
    });

    it('onItemReady sets separator for non-last items', async () => {
      await onReadyHandler();
      const repeater = getEl('#breadcrumbRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`breadcrumb-sep-0-${sel}`);
      itemReadyCb($item, { label: 'Home', url: '/' }, 0);
      expect(getEl('breadcrumb-sep-0-#breadcrumbSeparator').text).toBe('›');
    });

    it('onItemReady sets empty separator for last item', async () => {
      await onReadyHandler();
      const repeater = getEl('#breadcrumbRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`breadcrumb-last-${sel}`);
      itemReadyCb($item, { label: 'Buying Guides', url: '/buying-guides' }, 1);
      expect(getEl('breadcrumb-last-#breadcrumbSeparator').text).toBe('');
    });

    it('breadcrumb label click navigates for non-last items', async () => {
      await onReadyHandler();
      const repeater = getEl('#breadcrumbRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`breadcrumb-nav-${sel}`);
      itemReadyCb($item, { label: 'Home', url: '/' }, 0);

      const labelEl = getEl('breadcrumb-nav-#breadcrumbLabel');
      expect(labelEl.onClick).toHaveBeenCalled();

      const clickCb = labelEl.onClick.mock.calls[0][0];
      clickCb();
      expect(wixLocationFrontend.to).toHaveBeenCalledWith('/');
    });
  });

  // 4. Category filters: repeater data includes 'All Guides' + categories, onItemReady sets label/button
  describe('category filters', () => {
    it('sets filter repeater data with All Guides plus categories', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryFilterRepeater');
      expect(repeater.data).toEqual([
        { _id: 'filter-all', slug: 'all', label: 'All Guides' },
        { _id: 'filter-futons', slug: 'futons', label: 'Futons' },
        { _id: 'filter-mattresses', slug: 'mattresses', label: 'Mattresses' },
      ]);
    });

    it('registers onItemReady on filter repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryFilterRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets filter label text', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryFilterRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`filter-item-${sel}`);
      itemReadyCb($item, { _id: 'filter-all', slug: 'all', label: 'All Guides' });
      expect(getEl('filter-item-#filterLabel').text).toBe('All Guides');
    });

    it('onItemReady sets filter button label and onClick', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryFilterRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`filter-btn-${sel}`);
      itemReadyCb($item, { _id: 'filter-futons', slug: 'futons', label: 'Futons' });

      const btnEl = getEl('filter-btn-#filterButton');
      expect(btnEl.label).toBe('Futons');
      expect(btnEl.onClick).toHaveBeenCalled();
    });

    it('filter button click tracks event and announces result', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryFilterRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const $item = (sel) => getEl(`filter-click-${sel}`);
      itemReadyCb($item, { _id: 'filter-futons', slug: 'futons', label: 'Futons' });

      const clickCb = getEl('filter-click-#filterButton').onClick.mock.calls[0][0];
      clickCb();

      expect(trackEvent).toHaveBeenCalledWith('guide_category_filter', { category: 'futons' });
      expect(announce).toHaveBeenCalledWith($w, expect.stringContaining('guides for Futons'));
    });
  });

  // 5. Guide grid: repeater data set from buildHubCardData, onItemReady sets title/description/category/date/image
  describe('guide grid', () => {
    it('sets guide repeater data from buildHubCardData', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      expect(buildHubCardData).toHaveBeenCalledWith(mockGuides);
      expect(repeater.data).toEqual([{ ...mockGuides[0], categoryLabel: 'Futons' }]);
    });

    it('registers onItemReady on guides repeater', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets guide title', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const cardData = { ...mockGuides[0], categoryLabel: 'Futons' };
      const $item = (sel) => getEl(`guide-title-${sel}`);
      itemReadyCb($item, cardData);
      expect(getEl('guide-title-#guideTitle').text).toBe('Futon Buying Guide');
    });

    it('onItemReady sets guide description', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const cardData = { ...mockGuides[0], categoryLabel: 'Futons' };
      const $item = (sel) => getEl(`guide-desc-${sel}`);
      itemReadyCb($item, cardData);
      expect(getEl('guide-desc-#guideDescription').text).toBe('How to choose');
    });

    it('onItemReady sets guide category label', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const cardData = { ...mockGuides[0], categoryLabel: 'Futons' };
      const $item = (sel) => getEl(`guide-cat-${sel}`);
      itemReadyCb($item, cardData);
      expect(getEl('guide-cat-#guideCategoryLabel').text).toBe('Futons');
    });

    it('onItemReady sets guide date via formatGuideDate', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const cardData = { ...mockGuides[0], categoryLabel: 'Futons' };
      const $item = (sel) => getEl(`guide-date-${sel}`);
      itemReadyCb($item, cardData);
      expect(formatGuideDate).toHaveBeenCalledWith('2026-01-15');
      expect(getEl('guide-date-#guideDate').text).toBe('2026-01-15');
    });

    it('onItemReady sets guide reading time', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const cardData = { ...mockGuides[0], categoryLabel: 'Futons' };
      const $item = (sel) => getEl(`guide-rt-${sel}`);
      itemReadyCb($item, cardData);
      expect(getEl('guide-rt-#guideReadTime').text).toBe('8 min read');
    });

    it('onItemReady sets guide hero image src and alt', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const cardData = { ...mockGuides[0], categoryLabel: 'Futons' };
      const $item = (sel) => getEl(`guide-img-${sel}`);
      itemReadyCb($item, cardData);
      expect(getEl('guide-img-#guideHeroImage').src).toBe('https://cdn/hero.jpg');
      expect(getEl('guide-img-#guideHeroImage').alt).toBe('Futon Buying Guide hero image');
    });

    it('shows empty state when no cards', async () => {
      buildHubCardData.mockReturnValue([]);
      await onReadyHandler();
      expect(getEl('#emptyStateBox').show).toHaveBeenCalled();
      expect(getEl('#guidesRepeater').hide).toHaveBeenCalled();
    });

    it('hides empty state when cards exist', async () => {
      await onReadyHandler();
      expect(getEl('#emptyStateBox').hide).toHaveBeenCalled();
      expect(getEl('#guidesRepeater').show).toHaveBeenCalled();
    });
  });

  // 6. Guide card click: tracks guide_card_click event
  describe('guide card click', () => {
    it('tracks guide_card_click and navigates on card click', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const cardData = { ...mockGuides[0], categoryLabel: 'Futons' };
      const $item = (sel) => getEl(`guide-click-${sel}`);
      itemReadyCb($item, cardData);

      const cardBox = getEl('guide-click-#guideCardBox');
      const clickCb = cardBox.onClick.mock.calls[0][0];
      clickCb();

      expect(trackEvent).toHaveBeenCalledWith('guide_card_click', { slug: 'futon-guide' });
      expect(wixLocationFrontend.to).toHaveBeenCalledWith('/buying-guide/futon-guide');
    });

    it('calls makeClickable on guide card box', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const cardData = { ...mockGuides[0], categoryLabel: 'Futons' };
      const $item = (sel) => getEl(`guide-a11y-${sel}`);
      itemReadyCb($item, cardData);

      expect(makeClickable).toHaveBeenCalledWith(
        getEl('guide-a11y-#guideCardBox'),
        expect.any(Function),
        'Read Futon Buying Guide',
      );
    });

    it('readGuideButton click navigates to guide', async () => {
      await onReadyHandler();
      const repeater = getEl('#guidesRepeater');
      const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const cardData = { ...mockGuides[0], categoryLabel: 'Futons' };
      const $item = (sel) => getEl(`guide-readbtn-${sel}`);
      itemReadyCb($item, cardData);

      const readBtn = getEl('guide-readbtn-#readGuideButton');
      expect(readBtn.label).toBe('Read Guide');

      const clickCb = readBtn.onClick.mock.calls[0][0];
      clickCb();
      expect(wixLocationFrontend.to).toHaveBeenCalledWith('/buying-guide/futon-guide');
    });
  });

  // 7. Guide count text: shows card count
  describe('guide count text', () => {
    it('sets guide count text with card count', async () => {
      await onReadyHandler();
      expect(getEl('#guideCountText').text).toBe('1 Expert Buying Guides');
    });
  });

  // 8. Hub SEO: posts CollectionPage schema to hubSeoSchema
  describe('hub SEO', () => {
    it('posts CollectionPage JSON-LD schema to hubSeoSchema', async () => {
      await onReadyHandler();
      const seoEl = getEl('#hubSeoSchema');
      expect(seoEl.postMessage).toHaveBeenCalled();

      const posted = seoEl.postMessage.mock.calls[0][0];
      expect(posted).toContain('application/ld+json');
      expect(posted).toContain('"@type":"CollectionPage"');
      expect(posted).toContain('"name":"Buying Guides"');
      expect(posted).toContain('"description":"Expert guides"');
      expect(posted).toContain('"numberOfItems":1');
    });

    it('skips hub SEO when hub is null', async () => {
      getContentHub.mockResolvedValue({ success: false });
      await onReadyHandler();
      const seoEl = getEl('#hubSeoSchema');
      expect(seoEl.postMessage).not.toHaveBeenCalled();
    });
  });

  // 9. Hub meta: calls getPageTitle/getPageMetaDescription/getCanonicalUrl, posts to hubMetaHtml
  describe('hub meta', () => {
    it('calls getPageTitle with buyingGuides', async () => {
      await onReadyHandler();
      expect(getPageTitle).toHaveBeenCalledWith('buyingGuides', {});
    });

    it('calls getPageMetaDescription with buyingGuides', async () => {
      await onReadyHandler();
      expect(getPageMetaDescription).toHaveBeenCalledWith('buyingGuides', {});
    });

    it('calls getCanonicalUrl with buyingGuides', async () => {
      await onReadyHandler();
      expect(getCanonicalUrl).toHaveBeenCalledWith('buyingGuides');
    });

    it('posts meta data to hubMetaHtml', async () => {
      await onReadyHandler();
      // Allow async initHubMeta to settle
      await new Promise(r => setTimeout(r, 10));

      const metaEl = getEl('#hubMetaHtml');
      expect(metaEl.postMessage).toHaveBeenCalled();

      const posted = JSON.parse(metaEl.postMessage.mock.calls[0][0]);
      expect(posted.title).toBe('Buying Guides | Carolina Futons');
      expect(posted.description).toBe('Expert buying guides');
      expect(posted.canonical).toBe('https://carolinafutons.com/buying-guides');
    });
  });
});
