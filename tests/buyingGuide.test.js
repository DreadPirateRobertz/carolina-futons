/**
 * Tests for pages/Buying Guide.js
 * Covers: guide render, not-found, coming-soon, breadcrumbs, TOC, comparison table,
 * FAQ accordion, share buttons, related products/guides, SEO schema.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    src: '',
    alt: '',
    html: '',
    data: [],
    collapsed: false,
    style: { color: '', backgroundColor: '' },
    accessibility: { ariaLabel: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    postMessage: vi.fn(),
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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('backend/buyingGuides.web', () => ({
  getBuyingGuide: vi.fn(),
  getBuyingGuideSchema: vi.fn(),
  getGuideComparisonTable: vi.fn(),
  getGuideFaqs: vi.fn(),
  getSocialShareLinks: vi.fn(),
}));

vi.mock('backend/seoContentHub.web', () => ({
  getPillarGuide: vi.fn(),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getPageTitle: vi.fn(),
  getCanonicalUrl: vi.fn(),
  getPageMetaDescription: vi.fn(),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: ['buying-guides', 'futon-frames'], to: vi.fn() },
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
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
    if (opts?.ariaLabel) {
      el.accessibility.ariaLabel = opts.ariaLabel;
    }
  }),
}));

vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn((item) => `${item.name} product image`),
}));

vi.mock('public/buyingGuidesHelpers', () => ({
  buildBreadcrumbs: vi.fn(() => [
    { label: 'Home', url: '/' },
    { label: 'Buying Guides', url: '/buying-guides' },
    { label: 'Futon Frames', url: '/buying-guides/futon-frames' },
  ]),
  buildTableOfContents: vi.fn((sections) => sections.map((s, i) => ({ id: `s${i}`, label: s.heading }))),
  buildComparisonRows: vi.fn((table) => table.rows || []),
  buildFaqAccordionData: vi.fn((faqs) => faqs.map((f, i) => ({ _id: `faq-${i}`, ...f }))),
  buildShareLinks: vi.fn(() => ({
    facebook: 'https://facebook.com/share',
    twitter: 'https://twitter.com/share',
    pinterest: 'https://pinterest.com/share',
    email: 'mailto:?subject=Guide',
  })),
  getRelatedGuideCards: vi.fn(() => []),
  getReadingTime: vi.fn(() => 8),
  formatGuideDate: vi.fn(() => 'Mar 14, 2026'),
}));

// ── Test Data ───────────────────────────────────────────────────────

const mockGuide = {
  slug: 'futon-frames',
  title: 'Best Futon Frames of 2026',
  categoryLabel: 'Futon Frames',
  updatedDate: '2026-03-14',
  heroImage: 'https://example.com/hero.jpg',
  sections: [
    { heading: 'Introduction', body: 'Welcome to our guide...' },
    { heading: 'Top Picks', body: 'Here are the best futon frames...' },
  ],
  relatedProducts: [
    { _id: 'p1', name: 'Clover Frame', slug: 'clover', formattedPrice: '$499', mainMedia: 'https://img.com/clover.jpg', ribbon: 'Best Seller' },
    { _id: 'p2', name: 'Northern Frame', slug: 'northern', formattedPrice: '$299', mainMedia: 'https://img.com/northern.jpg', ribbon: '' },
  ],
};

// ── Load Page ───────────────────────────────────────────────────────

beforeEach(() => {
  elements.clear();
  onReadyHandler = null;
  vi.resetModules();
});

async function loadPage(overrides = {}) {
  const { getBuyingGuide, getBuyingGuideSchema, getGuideComparisonTable, getGuideFaqs } =
    await import('backend/buyingGuides.web');
  const { getPillarGuide } = await import('backend/seoContentHub.web');
  const { getPageTitle, getCanonicalUrl, getPageMetaDescription } = await import('backend/seoHelpers.web');

  getBuyingGuide.mockResolvedValue(overrides.guide ?? { success: true, guide: mockGuide });
  getBuyingGuideSchema.mockResolvedValue(overrides.schema ?? { success: true, articleSchema: '{}', faqSchema: '{}' });
  getGuideComparisonTable.mockResolvedValue(overrides.table ?? { success: false });
  getGuideFaqs.mockResolvedValue(overrides.faqs ?? { success: false });
  getPillarGuide.mockResolvedValue(overrides.pillar ?? { success: false });
  getPageTitle.mockResolvedValue('Futon Frames Guide');
  getCanonicalUrl.mockResolvedValue('https://www.carolinafutons.com/buying-guides/futon-frames');
  getPageMetaDescription.mockResolvedValue('Find the best futon frames');

  await import('../src/pages/Buying Guide.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Tests ───────────────────────────────────────────────────────────

describe('page initialization', () => {
  it('tracks page view with slug', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'buying_guide', slug: 'futon-frames' });
  });

  it('calls initBackToTop', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });

  it('calls initPageSeo with guide name and slug', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith('buyingGuide', { name: mockGuide.title, slug: 'futon-frames' });
  });

  it('fetches all guide data in parallel', async () => {
    await loadPage();
    const { getBuyingGuide, getBuyingGuideSchema, getGuideComparisonTable, getGuideFaqs } =
      await import('backend/buyingGuides.web');
    expect(getBuyingGuide).toHaveBeenCalledWith('futon-frames');
    expect(getBuyingGuideSchema).toHaveBeenCalledWith('futon-frames');
    expect(getGuideComparisonTable).toHaveBeenCalledWith('futon-frames');
    expect(getGuideFaqs).toHaveBeenCalledWith('futon-frames');
  });
});

describe('not found / coming soon', () => {
  it('shows not found when guide fetch fails', async () => {
    await loadPage({ guide: { success: false } });
    expect(getEl('#guideContent').hide).toHaveBeenCalled();
    expect(getEl('#notFoundBox').show).toHaveBeenCalled();
  });

  it('shows coming soon state for guide.comingSoon', async () => {
    await loadPage({
      guide: { success: true, guide: { ...mockGuide, comingSoon: true, message: 'Check back soon!' } },
    });
    expect(getEl('#guideContent').hide).toHaveBeenCalled();
    expect(getEl('#comingSoonBox').show).toHaveBeenCalled();
    expect(getEl('#comingSoonTitle').text).toBe('Best Futon Frames of 2026');
    expect(getEl('#comingSoonMessage').text).toBe('Check back soon!');
  });
});

describe('guide header', () => {
  it('sets title, category, date, reading time, and hero image', async () => {
    await loadPage();

    expect(getEl('#guideTitle').text).toBe('Best Futon Frames of 2026');
    expect(getEl('#guideCategoryLabel').text).toBe('Futon Frames');
    expect(getEl('#guideDate').text).toContain('Mar 14, 2026');
    expect(getEl('#guideReadTime').text).toBe('8 min read');
    expect(getEl('#guideHeroImage').src).toBe('https://example.com/hero.jpg');
    expect(getEl('#guideHeroImage').alt).toContain('hero image');
  });
});

describe('breadcrumbs', () => {
  it('sets breadcrumb repeater data', async () => {
    await loadPage();

    const repeater = getEl('#breadcrumbRepeater');
    expect(repeater.data).toHaveLength(3);
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('breadcrumb onItemReady sets label and separator', async () => {
    await loadPage();

    const repeater = getEl('#breadcrumbRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    // First crumb (not last — has separator)
    itemReadyFn($item, { label: 'Home', url: '/' }, 0);
    expect($item('#breadcrumbLabel').text).toBe('Home');
    expect($item('#breadcrumbSeparator').text).toBe('›');
  });
});

describe('table of contents', () => {
  it('sets TOC repeater data from sections', async () => {
    await loadPage();

    const tocRepeater = getEl('#tocRepeater');
    expect(tocRepeater.data).toHaveLength(2);
    expect(tocRepeater.data[0]._id).toBe('toc-s0');
  });
});

describe('guide sections', () => {
  it('sets section repeater data', async () => {
    await loadPage();

    const sectionRepeater = getEl('#sectionRepeater');
    expect(sectionRepeater.data).toHaveLength(2);
    expect(sectionRepeater.onItemReady).toHaveBeenCalled();
  });

  it('section onItemReady sets heading and body', async () => {
    await loadPage();

    const sectionRepeater = getEl('#sectionRepeater');
    const itemReadyFn = sectionRepeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, { heading: 'Introduction', body: 'Welcome to our guide...' });
    expect($item('#sectionHeading').text).toBe('Introduction');
    expect($item('#sectionBody').text).toBe('Welcome to our guide...');
  });
});

describe('comparison table', () => {
  it('collapses when no table data', async () => {
    await loadPage({ table: { success: false } });
    expect(getEl('#comparisonBox').collapse).toHaveBeenCalled();
  });

  it('renders table when data available', async () => {
    await loadPage({
      table: {
        success: true,
        table: {
          title: 'Frame Comparison',
          headers: ['Feature', 'Clover', 'Northern'],
          rows: [{ _id: 'r1', feature: 'Weight', values: ['60 lbs', '45 lbs'] }],
        },
      },
    });

    expect(getEl('#comparisonTitle').text).toBe('Frame Comparison');
    expect(getEl('#comparisonHeaderRepeater').data).toHaveLength(3);
    expect(getEl('#comparisonBox').expand).toHaveBeenCalled();

    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('guide_comparison_view', { title: 'Frame Comparison' });
  });
});

describe('FAQ section', () => {
  it('collapses when no FAQs', async () => {
    await loadPage({ faqs: { success: false } });
    expect(getEl('#faqBox').collapse).toHaveBeenCalled();
  });

  it('renders FAQ accordion when data available', async () => {
    await loadPage({
      faqs: {
        success: true,
        faqs: [
          { question: 'How heavy?', answer: 'About 60 lbs.' },
          { question: 'What size?', answer: 'Queen and Full.' },
        ],
      },
    });

    const faqRepeater = getEl('#guideFaqRepeater');
    expect(faqRepeater.data).toHaveLength(2);
    expect(faqRepeater.onItemReady).toHaveBeenCalled();
    expect(getEl('#faqBox').expand).toHaveBeenCalled();
  });

  it('FAQ onItemReady sets question/answer and starts collapsed', async () => {
    await loadPage({
      faqs: {
        success: true,
        faqs: [{ question: 'How heavy?', answer: 'About 60 lbs.' }],
      },
    });

    const faqRepeater = getEl('#guideFaqRepeater');
    const itemReadyFn = faqRepeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, { question: 'How heavy?', answer: 'About 60 lbs.' });
    expect($item('#faqQuestion').text).toBe('How heavy?');
    expect($item('#faqAnswer').text).toBe('About 60 lbs.');
    expect($item('#faqAnswer').collapse).toHaveBeenCalled();
  });
});

describe('share buttons', () => {
  it('wires share buttons via makeClickable', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers');

    const shareLabels = makeClickable.mock.calls
      .filter(c => c[2]?.ariaLabel?.includes('Share') || c[2]?.ariaLabel?.includes('email'))
      .map(c => c[2].ariaLabel);

    expect(shareLabels).toContain('Share on Facebook');
    expect(shareLabels).toContain('Share on Twitter');
    expect(shareLabels).toContain('Share on Pinterest');
    expect(shareLabels).toContain('Share via email');
  });
});

describe('related products', () => {
  it('sets repeater data and expands section', async () => {
    await loadPage();

    const repeater = getEl('#relatedProductRepeater');
    expect(repeater.data).toHaveLength(2);
    expect(getEl('#relatedProductsBox').expand).toHaveBeenCalled();
  });

  it('collapses when no related products', async () => {
    await loadPage({
      guide: { success: true, guide: { ...mockGuide, relatedProducts: [] } },
    });
    expect(getEl('#relatedProductsBox').collapse).toHaveBeenCalled();
  });

  it('onItemReady sets product name, price, image', async () => {
    await loadPage();

    const repeater = getEl('#relatedProductRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    itemReadyFn($item, mockGuide.relatedProducts[0]);
    expect($item('#productName').text).toBe('Clover Frame');
    expect($item('#productPrice').text).toBe('$499');
    expect($item('#productImage').src).toBe('https://img.com/clover.jpg');
  });

  it('shows ribbon for best sellers, hides when empty', async () => {
    await loadPage();

    const repeater = getEl('#relatedProductRepeater');
    const itemReadyFn = repeater.onItemReady.mock.calls[0][0];

    // Product with ribbon
    const el1 = new Map();
    const $item1 = (sel) => { if (!el1.has(sel)) el1.set(sel, createMockElement()); return el1.get(sel); };
    itemReadyFn($item1, mockGuide.relatedProducts[0]);
    expect($item1('#productRibbon').text).toBe('Best Seller');
    expect($item1('#productRibbon').show).toHaveBeenCalled();

    // Product without ribbon
    const el2 = new Map();
    const $item2 = (sel) => { if (!el2.has(sel)) el2.set(sel, createMockElement()); return el2.get(sel); };
    itemReadyFn($item2, mockGuide.relatedProducts[1]);
    expect($item2('#productRibbon').hide).toHaveBeenCalled();
  });
});

describe('related guides', () => {
  it('renders related guides from pillar data', async () => {
    await loadPage({
      pillar: {
        success: true,
        relatedGuides: [
          { slug: 'mattress-guide', title: 'Best Mattresses', shortTitle: 'Mattresses', description: 'Top picks' },
        ],
      },
    });

    const repeater = getEl('#relatedGuideRepeater');
    expect(repeater.data).toHaveLength(1);
    expect(getEl('#relatedGuidesBox').expand).toHaveBeenCalled();
  });

  it('collapses when no pillar data', async () => {
    await loadPage({ pillar: { success: false } });
    expect(getEl('#relatedGuidesBox').collapse).toHaveBeenCalled();
  });
});

describe('SEO schema', () => {
  it('posts schema JSON to guideSeoSchema element', async () => {
    await loadPage({
      schema: { success: true, articleSchema: '{"@type":"Article"}', faqSchema: '{"@type":"FAQPage"}' },
    });

    const schemaEl = getEl('#guideSeoSchema');
    expect(schemaEl.postMessage).toHaveBeenCalled();
    const msg = schemaEl.postMessage.mock.calls[0][0];
    expect(msg).toContain('application/ld+json');
    expect(msg).toContain('Article');
    expect(msg).toContain('FAQPage');
  });

  it('posts meta data to guideMetaHtml element', async () => {
    await loadPage();

    // Wait for async initGuideMeta to complete
    await new Promise(r => setTimeout(r, 50));

    const metaEl = getEl('#guideMetaHtml');
    expect(metaEl.postMessage).toHaveBeenCalled();
  });
});
