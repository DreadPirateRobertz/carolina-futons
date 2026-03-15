import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// $w mock infrastructure
// ---------------------------------------------------------------------------
const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
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

// ---------------------------------------------------------------------------
// Mock ALL imports before they are pulled in
// ---------------------------------------------------------------------------
vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn(() => Promise.resolve([])),
  getSaleProducts: vi.fn(() => Promise.resolve([])),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getWebSiteSchema: vi.fn(() => Promise.resolve('')),
}));

vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('public/galleryHelpers.js', () => ({
  getRecentlyViewed: vi.fn(() => []),
  buildRecentlyViewedSection: vi.fn(),
}));

vi.mock('public/placeholderImages.js', () => ({
  getHomepageHeroImage: vi.fn(() => 'hero.jpg'),
  getCategoryCardImage: vi.fn(() => 'cat.jpg'),
  getCategoryCardAlt: vi.fn(() => 'Alt'),
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  limitForViewport: vi.fn((arr) => arr),
  onViewportChange: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
  setupAccessibleDialog: vi.fn(() => ({ open: vi.fn(), close: vi.fn(), destroy: vi.fn() })),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    primary: '#2E5339',
    accent: '#D4A843',
    text: '#1A1A1A',
    background: '#FFFFFF',
  },
}));

vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections, opts) => {
    const critical = sections.filter(s => s.critical);
    const deferred = sections.filter(s => !s.critical);
    const criticalResults = await Promise.allSettled(critical.map(s => s.init()));
    const deferredResults = await Promise.allSettled(deferred.map(s => s.init()));
    return { critical: criticalResults, deferred: Promise.resolve(deferredResults) };
  }),
  lazyLoadImage: vi.fn(),
}));

vi.mock('public/StarRatingCard.js', () => ({
  batchLoadRatings: vi.fn(() => Promise.resolve({})),
  renderCardStarRating: vi.fn(),
  _resetCache: vi.fn(),
}));

vi.mock('public/WishlistCardButton.js', () => ({
  initCardWishlistButton: vi.fn(),
  batchCheckWishlistStatus: vi.fn(() => Promise.resolve(new Set())),
}));

vi.mock('public/productCardHelpers.js', () => ({
  styleCardContainer: vi.fn(),
  styleBadge: vi.fn(),
  initCardHover: vi.fn(),
  formatCardPrice: vi.fn(() => '$199'),
  setCardImage: vi.fn(),
  getBadgeColor: vi.fn(() => '#red'),
}));

vi.mock('public/productPageUtils.js', () => ({
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));

vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn(() => ({ width: 400, height: 300 })),
}));

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({
      limit: vi.fn(() => ({
        find: vi.fn(() => Promise.resolve({ items: [] })),
      })),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
let resetRatingsCache;
let prioritizeSections;
let initPageSeo;
let trackEvent;
let initBackToTop;
let collapseOnMobile;
let onViewportChange;

beforeAll(async () => {
  await import('../src/pages/Home.js');
  resetRatingsCache = (await import('public/StarRatingCard.js'))._resetCache;
  prioritizeSections = (await import('public/performanceHelpers.js')).prioritizeSections;
  initPageSeo = (await import('public/pageSeo.js')).initPageSeo;
  trackEvent = (await import('public/engagementTracker')).trackEvent;
  initBackToTop = (await import('public/mobileHelpers')).initBackToTop;
  collapseOnMobile = (await import('public/mobileHelpers')).collapseOnMobile;
  onViewportChange = (await import('public/mobileHelpers')).onViewportChange;
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

describe('Home page onReady', () => {
  it('captures the onReady handler', () => {
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls resetRatingsCache on ready', async () => {
    await onReadyHandler();
    expect(resetRatingsCache).toHaveBeenCalled();
  });

  it('collapses #section4 (template logos) on ready', async () => {
    await onReadyHandler();
    const section4 = getEl('#section4');
    expect(section4.collapse).toHaveBeenCalled();
    expect(section4.collapsed).toBe(true);
  });

  it('calls prioritizeSections with a sections array', async () => {
    await onReadyHandler();
    expect(prioritizeSections).toHaveBeenCalledTimes(1);
    const args = prioritizeSections.mock.calls[0];
    expect(Array.isArray(args[0])).toBe(true);
    expect(args[0].length).toBeGreaterThanOrEqual(10);
  });

  it('passes an onError callback in options', async () => {
    await onReadyHandler();
    const opts = prioritizeSections.mock.calls[0][1];
    expect(opts).toBeDefined();
    expect(opts.onError).toBeTypeOf('function');
  });

  it('marks heroAnimation as critical', async () => {
    await onReadyHandler();
    const sections = prioritizeSections.mock.calls[0][0];
    const hero = sections.find(s => s.name === 'heroAnimation');
    expect(hero).toBeDefined();
    expect(hero.critical).toBe(true);
  });

  it('marks categoryShowcase as critical', async () => {
    await onReadyHandler();
    const sections = prioritizeSections.mock.calls[0][0];
    const cat = sections.find(s => s.name === 'categoryShowcase');
    expect(cat).toBeDefined();
    expect(cat.critical).toBe(true);
  });

  it('marks trustBar as critical', async () => {
    await onReadyHandler();
    const sections = prioritizeSections.mock.calls[0][0];
    const trust = sections.find(s => s.name === 'trustBar');
    expect(trust).toBeDefined();
    expect(trust.critical).toBe(true);
  });

  it('includes deferred featuredProducts section', async () => {
    await onReadyHandler();
    const sections = prioritizeSections.mock.calls[0][0];
    const fp = sections.find(s => s.name === 'featuredProducts');
    expect(fp).toBeDefined();
    expect(fp.critical).toBe(false);
  });

  it('includes deferred testimonials section', async () => {
    await onReadyHandler();
    const sections = prioritizeSections.mock.calls[0][0];
    const t = sections.find(s => s.name === 'testimonials');
    expect(t).toBeDefined();
    expect(t.critical).toBe(false);
  });

  it('includes deferred newsletter section', async () => {
    await onReadyHandler();
    const sections = prioritizeSections.mock.calls[0][0];
    const nl = sections.find(s => s.name === 'newsletter');
    expect(nl).toBeDefined();
    expect(nl.critical).toBe(false);
  });

  it('includes deferred homeSeo section', async () => {
    await onReadyHandler();
    const sections = prioritizeSections.mock.calls[0][0];
    const seo = sections.find(s => s.name === 'homeSeo');
    expect(seo).toBeDefined();
    expect(seo.critical).toBe(false);
  });

  it('has exactly 3 critical and 12 deferred sections', async () => {
    await onReadyHandler();
    const sections = prioritizeSections.mock.calls[0][0];
    const critical = sections.filter(s => s.critical);
    const deferred = sections.filter(s => !s.critical);
    expect(critical).toHaveLength(3);
    expect(deferred).toHaveLength(12);
  });

  it('every section has a name and init function', async () => {
    await onReadyHandler();
    const sections = prioritizeSections.mock.calls[0][0];
    for (const s of sections) {
      expect(s.name).toBeTypeOf('string');
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.init).toBeTypeOf('function');
    }
  });

  it('calls trackEvent with page_view after sections load', async () => {
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'home' });
  });

  it('calls initBackToTop after sections load', async () => {
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });

  it('calls collapseOnMobile for non-critical mobile sections', async () => {
    await onReadyHandler();
    expect(collapseOnMobile).toHaveBeenCalledWith($w, ['#testimonialSection', '#videoShowcaseSection']);
  });

  it('registers an onViewportChange callback', async () => {
    await onReadyHandler();
    expect(onViewportChange).toHaveBeenCalledTimes(1);
    expect(onViewportChange.mock.calls[0][0]).toBeTypeOf('function');
  });

  it('does not throw on ready', async () => {
    await expect(onReadyHandler()).resolves.not.toThrow();
  });
});
