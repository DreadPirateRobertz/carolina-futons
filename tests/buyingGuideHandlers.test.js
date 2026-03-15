import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

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

// ── Mock data ───────────────────────────────────────────────────────

const mockGuide = {
  title: 'Futon Mattress Guide',
  slug: 'futon-mattress-guide',
  categoryLabel: 'Mattresses',
  updatedDate: '2026-01-15',
  heroImage: 'hero.jpg',
  sections: [{ heading: 'Section 1', body: 'Body text' }],
  relatedProducts: [
    { _id: 'p1', name: 'Product', slug: 'product', formattedPrice: '$199', mainMedia: 'img.jpg' },
  ],
};

// ── Backend mocks ───────────────────────────────────────────────────

vi.mock('backend/buyingGuides.web', () => ({
  getBuyingGuide: vi.fn(() => Promise.resolve({ success: true, guide: mockGuide })),
  getBuyingGuideSchema: vi.fn(() => Promise.resolve({ success: true, articleSchema: '{}', faqSchema: '{}' })),
  getGuideComparisonTable: vi.fn(() => Promise.resolve({ success: true, table: null })),
  getGuideFaqs: vi.fn(() => Promise.resolve({ success: true, faqs: null })),
  getSocialShareLinks: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock('backend/seoContentHub.web', () => ({
  getPillarGuide: vi.fn(() => Promise.resolve({ success: true, relatedGuides: [] })),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getPageTitle: vi.fn(() => Promise.resolve('')),
  getCanonicalUrl: vi.fn(() => Promise.resolve('')),
  getPageMetaDescription: vi.fn(() => Promise.resolve('')),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: ['buying-guides', 'futon-mattress-guide'], to: vi.fn(), query: {} },
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
  isMobile: vi.fn(() => false),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
}));

vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn(() => 'Alt text'),
}));

vi.mock('public/buyingGuidesHelpers', () => ({
  buildBreadcrumbs: vi.fn(() => [{ label: 'Home', url: '/' }]),
  buildTableOfContents: vi.fn(() => [{ id: 'sec1', label: 'Section 1' }]),
  buildComparisonRows: vi.fn(() => []),
  buildFaqAccordionData: vi.fn(() => []),
  buildShareLinks: vi.fn(() => ({ facebook: 'fb', twitter: 'tw', pinterest: 'pin', email: 'mailto' })),
  getRelatedGuideCards: vi.fn(() => []),
  getReadingTime: vi.fn(() => 5),
  formatGuideDate: vi.fn(() => 'Jan 15, 2026'),
}));

// ── Import after mocks ──────────────────────────────────────────────

const { initBackToTop, isMobile } = await import('public/mobileHelpers');
const { trackEvent } = await import('public/engagementTracker');
const { makeClickable } = await import('public/a11yHelpers');
const { initPageSeo } = await import('public/pageSeo.js');
const { buildBreadcrumbs, buildTableOfContents, getReadingTime, formatGuideDate, buildShareLinks } = await import('public/buyingGuidesHelpers');
const { buildGridAlt } = await import('public/productPageUtils.js');
const { getBuyingGuide, getBuyingGuideSchema } = await import('backend/buyingGuides.web');
const { getPillarGuide } = await import('backend/seoContentHub.web');
const wixLocationFrontend = (await import('wix-location-frontend')).default;

beforeAll(async () => {
  await import('../src/pages/Buying Guide.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────

describe('Buying Guide page handler', () => {
  async function runOnReady() {
    await onReadyHandler();
    // Let microtasks settle for async initGuideMeta
    await new Promise(r => setTimeout(r, 0));
  }

  // ── Init ─────────────────────────────────────────────────────────

  describe('initialization', () => {
    it('calls initBackToTop with $w', async () => {
      await runOnReady();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('tracks page_view event with slug', async () => {
      await runOnReady();
      expect(trackEvent).toHaveBeenCalledWith('page_view', {
        page: 'buying_guide',
        slug: 'futon-mattress-guide',
      });
    });

    it('returns early when slug is empty', async () => {
      wixLocationFrontend.path = [];
      await runOnReady();
      expect(getBuyingGuide).not.toHaveBeenCalled();
      wixLocationFrontend.path = ['buying-guides', 'futon-mattress-guide'];
    });
  });

  // ── Guide header ────────────────────────────────────────────────

  describe('guide header', () => {
    it('sets guide title text', async () => {
      await runOnReady();
      expect(getEl('#guideTitle').text).toBe('Futon Mattress Guide');
    });

    it('sets category label text', async () => {
      await runOnReady();
      expect(getEl('#guideCategoryLabel').text).toBe('Mattresses');
    });

    it('sets formatted date with "Updated" prefix', async () => {
      await runOnReady();
      expect(formatGuideDate).toHaveBeenCalledWith('2026-01-15');
      expect(getEl('#guideDate').text).toBe('Updated Jan 15, 2026');
    });

    it('sets reading time', async () => {
      await runOnReady();
      expect(getReadingTime).toHaveBeenCalledWith(mockGuide.sections);
      expect(getEl('#guideReadTime').text).toBe('5 min read');
    });

    it('sets hero image src and alt', async () => {
      await runOnReady();
      expect(getEl('#guideHeroImage').src).toBe('hero.jpg');
      expect(getEl('#guideHeroImage').alt).toBe('Futon Mattress Guide hero image');
    });
  });

  // ── Breadcrumbs ─────────────────────────────────────────────────

  describe('breadcrumb repeater', () => {
    it('sets breadcrumb repeater data', async () => {
      await runOnReady();
      const data = getEl('#breadcrumbRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ label: 'Home', url: '/' });
    });

    it('registers onItemReady on breadcrumb repeater', async () => {
      await runOnReady();
      expect(getEl('#breadcrumbRepeater').onItemReady).toHaveBeenCalled();
    });

    it('calls buildBreadcrumbs with slug and categoryLabel', async () => {
      await runOnReady();
      expect(buildBreadcrumbs).toHaveBeenCalledWith('futon-mattress-guide', 'Mattresses');
    });
  });

  // ── Table of Contents ───────────────────────────────────────────

  describe('TOC repeater', () => {
    it('sets TOC repeater data', async () => {
      await runOnReady();
      const data = getEl('#tocRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ label: 'Section 1' });
    });

    it('registers onItemReady on TOC repeater', async () => {
      await runOnReady();
      expect(getEl('#tocRepeater').onItemReady).toHaveBeenCalled();
    });

    it('calls buildTableOfContents with sections', async () => {
      await runOnReady();
      expect(buildTableOfContents).toHaveBeenCalledWith(mockGuide.sections);
    });
  });

  // ── Guide Sections ─────────────────────────────────────────────

  describe('section repeater', () => {
    it('sets section repeater data from guide sections', async () => {
      await runOnReady();
      const data = getEl('#sectionRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ heading: 'Section 1', body: 'Body text' });
    });

    it('registers onItemReady on section repeater', async () => {
      await runOnReady();
      expect(getEl('#sectionRepeater').onItemReady).toHaveBeenCalled();
    });

    it('generates section _id from heading slug', async () => {
      await runOnReady();
      const data = getEl('#sectionRepeater').data;
      expect(data[0]._id).toBe('section-section-1');
    });
  });

  // ── Share buttons ───────────────────────────────────────────────

  describe('share buttons', () => {
    it('calls makeClickable for Facebook share button', async () => {
      await runOnReady();
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('#shareFacebook'),
        expect.any(Function),
        { ariaLabel: 'Share on Facebook' },
      );
    });

    it('calls makeClickable for Twitter share button', async () => {
      await runOnReady();
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('#shareTwitter'),
        expect.any(Function),
        { ariaLabel: 'Share on Twitter' },
      );
    });

    it('calls makeClickable for Pinterest share button', async () => {
      await runOnReady();
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('#sharePinterest'),
        expect.any(Function),
        { ariaLabel: 'Share on Pinterest' },
      );
    });

    it('calls makeClickable for email share button', async () => {
      await runOnReady();
      expect(makeClickable).toHaveBeenCalledWith(
        getEl('#shareEmail'),
        expect.any(Function),
        { ariaLabel: 'Share via email' },
      );
    });
  });

  // ── Related products ────────────────────────────────────────────

  describe('related products', () => {
    it('sets related product repeater data', async () => {
      await runOnReady();
      const data = getEl('#relatedProductRepeater').data;
      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({ name: 'Product', slug: 'product', formattedPrice: '$199' });
    });

    it('registers onItemReady on product repeater', async () => {
      await runOnReady();
      expect(getEl('#relatedProductRepeater').onItemReady).toHaveBeenCalled();
    });

    it('expands relatedProductsBox when products exist', async () => {
      await runOnReady();
      expect(getEl('#relatedProductsBox').expand).toHaveBeenCalled();
    });
  });

  // ── SEO / Schema ───────────────────────────────────────────────

  describe('SEO and schema', () => {
    it('calls initPageSeo with buyingGuide context', async () => {
      await runOnReady();
      expect(initPageSeo).toHaveBeenCalledWith('buyingGuide', {
        name: 'Futon Mattress Guide',
        slug: 'futon-mattress-guide',
      });
    });

    it('posts schema JSON to guideSeoSchema element', async () => {
      await runOnReady();
      const el = getEl('#guideSeoSchema');
      expect(el.postMessage).toHaveBeenCalled();
      const msg = el.postMessage.mock.calls[0][0];
      expect(msg).toContain('application/ld+json');
    });
  });

  // ── Not found state ─────────────────────────────────────────────

  describe('not found state', () => {
    it('shows notFoundBox when guide fetch returns null', async () => {
      getBuyingGuide.mockResolvedValueOnce({ success: false });
      await runOnReady();
      expect(getEl('#notFoundBox').show).toHaveBeenCalled();
      expect(getEl('#guideContent').hide).toHaveBeenCalled();
    });
  });
});
