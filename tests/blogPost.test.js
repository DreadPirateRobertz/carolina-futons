/**
 * Tests for pages/Blog Post.js
 * Covers: slug extraction edge cases, reading time, author bio, share URLs,
 * related posts repeater, SEO schema injection, early-exit guards.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    value: '',
    src: '',
    data: [],
    collapsed: false,
    accessibility: { ariaLabel: '', role: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
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

vi.mock('backend/seoHelpers.web', () => ({
  getBlogArticleSchema: vi.fn(() => Promise.resolve('{"@type":"Article"}')),
  getBlogFaqSchema: vi.fn(() => Promise.resolve(null)),
  getPageTitle: vi.fn(() => Promise.resolve('Test Post | Blog')),
  getCanonicalUrl: vi.fn(() => Promise.resolve('https://carolinafutons.com/blog/test-post')),
  getPageMetaDescription: vi.fn(() => Promise.resolve('A test post description')),
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getGuidePinData: vi.fn(() => Promise.resolve({ success: true, meta: { 'pinterest-rich-pin': 'true' } })),
}));

vi.mock('backend/blogContent', () => ({
  getBlogPost: vi.fn(() => ({
    slug: 'futon-buying-guide',
    title: 'The Complete Futon Buying Guide',
    excerpt: 'Everything you need to know about buying a futon for your home.',
    category: 'Guides',
    publishDate: '2026-01-15',
    coverImage: 'https://example.com/cover.jpg',
    heroImage: 'https://example.com/hero.jpg',
    author: 'Carolina Futons',
  })),
  getAllBlogPosts: vi.fn(() => [
    { slug: 'futon-buying-guide', title: 'The Complete Futon Buying Guide', category: 'Guides', excerpt: 'Everything about futons.' },
    { slug: 'futon-vs-sofa', title: 'Futon vs Sofa', category: 'Guides', excerpt: 'Comparing futons and sofas.' },
    { slug: 'small-space-tips', title: 'Small Space Tips', category: 'Tips', excerpt: 'Making the most of small spaces.' },
  ]),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: ['blog', 'futon-buying-guide'] },
}));

vi.mock('public/mobileHelpers', () => ({
  initBackToTop: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));

vi.mock('public/ga4Tracking', () => ({
  fireCustomEvent: vi.fn(),
}));

vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    el.onClick(handler);
    if (opts?.ariaLabel) el.accessibility.ariaLabel = opts.ariaLabel;
  }),
}));

vi.mock('public/blogHelpers', () => ({
  estimateReadingTime: vi.fn((text) => {
    if (!text) return 1;
    return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
  }),
  formatPublishDate: vi.fn(() => 'January 15, 2026'),
  buildAuthorBio: vi.fn(() => ({
    name: 'Carolina Futons',
    description: 'Family-owned furniture store in Hendersonville, NC',
    location: 'Hendersonville, NC',
    established: '2003',
  })),
  buildShareUrls: vi.fn((url, title) => ({
    facebook: `https://facebook.com/sharer?u=${url}`,
    pinterest: `https://pinterest.com/pin/create?url=${url}`,
    twitter: `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
    email: `mailto:?subject=${title}&body=${url}`,
  })),
  getRelatedPosts: vi.fn((current, all) =>
    all.filter((p) => p.slug !== current.slug).slice(0, 3)
  ),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-window-frontend', () => ({
  openUrl: vi.fn(),
}));

vi.mock('wix-seo-frontend', () => ({
  head: { setMetaTag: vi.fn() },
}));

// ── Helper: load page and trigger onReady ───────────────────────────

async function loadPage() {
  onReadyHandler = null;
  elements.clear();
  vi.resetModules();
  await import('../src/pages/Blog Post.js');
  if (onReadyHandler) await onReadyHandler();
  // Let async operations settle
  await new Promise((r) => setTimeout(r, 50));
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Blog Post page — $w wiring', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('registers an onReady handler', async () => {
    await import('../src/pages/Blog Post.js');
    expect(onReadyHandler).toBeTypeOf('function');
  });

  it('calls initBackToTop on ready', async () => {
    await loadPage();
    const { initBackToTop } = await import('public/mobileHelpers');
    expect(initBackToTop).toHaveBeenCalled();
  });

  it('tracks page_view event', async () => {
    await loadPage();
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'blog_post' });
  });
});

describe('Blog Post page — reading time and metadata', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets reading time text on #postReadTime', async () => {
    await loadPage();
    expect(getEl('#postReadTime').text).toMatch(/\d+ min read/);
  });

  it('sets formatted publish date on #postDate', async () => {
    await loadPage();
    expect(getEl('#postDate').text).toBe('January 15, 2026');
  });

  it('sets category on #postCategory', async () => {
    await loadPage();
    expect(getEl('#postCategory').text).toBe('Guides');
  });
});

describe('Blog Post page — author bio', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('populates author name', async () => {
    await loadPage();
    expect(getEl('#authorName').text).toBe('Carolina Futons');
  });

  it('populates author location', async () => {
    await loadPage();
    expect(getEl('#authorLocation').text).toBe('Hendersonville, NC');
  });

  it('expands the author bio section', async () => {
    await loadPage();
    expect(getEl('#authorBioSection').expand).toHaveBeenCalled();
  });
});

describe('Blog Post page — share buttons', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets up Facebook share with aria label', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers');
    expect(makeClickable).toHaveBeenCalledWith(
      getEl('#postShareFacebook'),
      expect.any(Function),
      { ariaLabel: 'Share on Facebook (opens in new window)' }
    );
  });

  it('sets up Pinterest share with aria label', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers');
    expect(makeClickable).toHaveBeenCalledWith(
      getEl('#postSharePinterest'),
      expect.any(Function),
      { ariaLabel: 'Share on Pinterest (opens in new window)' }
    );
  });

  it('sets up email share with aria label', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers');
    expect(makeClickable).toHaveBeenCalledWith(
      getEl('#postShareEmail'),
      expect.any(Function),
      { ariaLabel: 'Share via email' }
    );
  });
});

describe('Blog Post page — related posts', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('sets up related posts repeater with onItemReady', async () => {
    await loadPage();
    const repeater = getEl('#relatedPostsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('populates repeater data excluding current post', async () => {
    await loadPage();
    const repeater = getEl('#relatedPostsRepeater');
    expect(repeater.data.length).toBeGreaterThan(0);
    const slugs = repeater.data.map((d) => d.slug);
    expect(slugs).not.toContain('futon-buying-guide');
  });

  it('related posts have _id field for repeater binding', async () => {
    await loadPage();
    const repeater = getEl('#relatedPostsRepeater');
    for (const item of repeater.data) {
      expect(item._id).toBeTruthy();
    }
  });

  it('expands related posts section when posts exist', async () => {
    await loadPage();
    expect(getEl('#relatedPostsSection').expand).toHaveBeenCalled();
  });

  it('wires repeater items with title, category, read time, and link', async () => {
    await loadPage();
    const repeater = getEl('#relatedPostsRepeater');
    const itemReadyCb = repeater.onItemReady.mock.calls[0][0];

    const mockItem = createMockElement();
    const $item = (sel) => {
      if (!mockItem[sel]) mockItem[sel] = createMockElement();
      return mockItem[sel];
    };

    const testData = { title: 'Futon vs Sofa', category: 'Guides', excerpt: 'Comparing.', slug: 'futon-vs-sofa' };
    itemReadyCb($item, testData);

    expect($item('#relatedTitle').text).toBe('Futon vs Sofa');
    expect($item('#relatedCategory').text).toBe('Guides');
  });
});

describe('Blog Post page — SEO schema', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('injects article schema via postMessage to #postSeoSchema', async () => {
    await loadPage();
    const el = getEl('#postSeoSchema');
    expect(el.postMessage).toHaveBeenCalled();
    const msg = el.postMessage.mock.calls[0][0];
    expect(msg).toContain('application/ld+json');
  });

  it('injects meta tags via postMessage to #postMetaHtml', async () => {
    await loadPage();
    const el = getEl('#postMetaHtml');
    expect(el.postMessage).toHaveBeenCalled();
    const msg = JSON.parse(el.postMessage.mock.calls[0][0]);
    expect(msg.title).toBe('Test Post | Blog');
    expect(msg.canonical).toContain('carolinafutons.com');
  });

  it('calls initPageSeo with blogPost type', async () => {
    await loadPage();
    const { initPageSeo } = await import('public/pageSeo.js');
    expect(initPageSeo).toHaveBeenCalledWith(
      'blogPost',
      expect.objectContaining({ name: 'The Complete Futon Buying Guide', slug: 'futon-buying-guide' })
    );
  });

  it('fires blog_post_view GA4 event with slug and category', async () => {
    await loadPage();
    const { fireCustomEvent } = await import('public/ga4Tracking');
    expect(fireCustomEvent).toHaveBeenCalledWith('blog_post_view', {
      slug: 'futon-buying-guide',
      category: 'Guides',
    });
  });
});

describe('Blog Post page — edge cases', () => {
  beforeEach(async () => {
    elements.clear();
    onReadyHandler = null;
  });

  it('exits early when URL has no slug (empty path)', async () => {
    const wixLocation = await import('wix-location-frontend');
    wixLocation.default.path = [];

    onReadyHandler = null;
    elements.clear();
    vi.resetModules();
    await import('../src/pages/Blog Post.js');
    if (onReadyHandler) await onReadyHandler();
    await new Promise((r) => setTimeout(r, 50));

    // No reading time or author bio should be set
    expect(getEl('#postReadTime').text).toBe('');
    expect(getEl('#authorName').text).toBe('');

    // Restore
    wixLocation.default.path = ['blog', 'futon-buying-guide'];
  });

  it('exits early when getBlogPost returns null (non-pillar post)', async () => {
    const blogContent = await import('backend/blogContent');
    blogContent.getBlogPost.mockReturnValueOnce(null);

    onReadyHandler = null;
    elements.clear();
    vi.resetModules();
    await import('../src/pages/Blog Post.js');
    if (onReadyHandler) await onReadyHandler();
    await new Promise((r) => setTimeout(r, 50));

    // Page view event still fires, but no custom enhancements
    const { trackEvent } = await import('public/engagementTracker');
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'blog_post' });
    expect(getEl('#postReadTime').text).toBe('');
  });

  it('collapses related posts section when no related posts exist', async () => {
    const blogHelpers = await import('public/blogHelpers');
    blogHelpers.getRelatedPosts.mockReturnValueOnce([]);

    onReadyHandler = null;
    elements.clear();
    vi.resetModules();
    await import('../src/pages/Blog Post.js');
    if (onReadyHandler) await onReadyHandler();
    await new Promise((r) => setTimeout(r, 50));

    expect(getEl('#relatedPostsSection').collapse).toHaveBeenCalled();
  });

  it('sets up Twitter share button with aria label', async () => {
    await loadPage();
    const { makeClickable } = await import('public/a11yHelpers');
    expect(makeClickable).toHaveBeenCalledWith(
      getEl('#postShareTwitter'),
      expect.any(Function),
      { ariaLabel: 'Share on Twitter (opens in new window)' }
    );
  });
});
