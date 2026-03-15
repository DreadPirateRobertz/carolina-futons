import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

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

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('backend/seoHelpers.web', () => ({
  getBlogArticleSchema: vi.fn(() => Promise.resolve('{}')),
  getBlogFaqSchema: vi.fn(() => Promise.resolve('{}')),
  getPageTitle: vi.fn(() => Promise.resolve('Title')),
  getCanonicalUrl: vi.fn(() => Promise.resolve('https://example.com')),
  getPageMetaDescription: vi.fn(() => Promise.resolve('Desc')),
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getGuidePinData: vi.fn(() => Promise.resolve({ success: false })),
}));

vi.mock('backend/blogContent', () => ({
  getBlogPost: vi.fn(() => ({
    title: 'Test Post',
    slug: 'test-post',
    excerpt: 'An excerpt',
    category: 'Guides',
    publishDate: '2026-01-15',
    coverImage: 'img.jpg',
  })),
  getAllBlogPosts: vi.fn(() => [
    { title: 'Related', slug: 'related-post', excerpt: 'Rel', category: 'Guides' },
  ]),
}));

vi.mock('wix-location-frontend', () => ({
  default: {
    path: ['blog', 'test-post'],
    url: 'https://carolinafutons.com/blog/test-post',
  },
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
  makeClickable: vi.fn(),
}));

vi.mock('public/blogHelpers', () => ({
  estimateReadingTime: vi.fn(() => 5),
  formatPublishDate: vi.fn(() => 'Jan 15, 2026'),
  buildAuthorBio: vi.fn(() => ({
    name: 'CF Team',
    description: 'Experts',
    location: 'Hendersonville, NC',
    established: '1991',
  })),
  buildShareUrls: vi.fn(() => ({
    facebook: 'https://fb.com',
    pinterest: 'https://pin.com',
    twitter: 'https://tw.com',
    email: 'mailto:...',
  })),
  getRelatedPosts: vi.fn(() => [
    { title: 'Related', slug: 'related-post', excerpt: 'Rel', category: 'Guides' },
  ]),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('wix-seo-frontend', () => ({
  head: { setMetaTag: vi.fn() },
}));

// ── Import mock refs ─────────────────────────────────────────────────

let initBackToTop, trackEvent, fireCustomEvent, makeClickable;
let initPageSeo;
let getBlogPost, getAllBlogPosts;
let estimateReadingTime, formatPublishDate, buildAuthorBio, buildShareUrls, getRelatedPosts;
let getBlogArticleSchema;

// ── Import page ──────────────────────────────────────────────────────

describe('Blog Post page handlers', () => {
  beforeAll(async () => {
    ({ initBackToTop } = await import('public/mobileHelpers'));
    ({ trackEvent } = await import('public/engagementTracker'));
    ({ fireCustomEvent } = await import('public/ga4Tracking'));
    ({ makeClickable } = await import('public/a11yHelpers'));
    ({ initPageSeo } = await import('public/pageSeo.js'));
    ({ getBlogPost, getAllBlogPosts } = await import('backend/blogContent'));
    ({ estimateReadingTime, formatPublishDate, buildAuthorBio, buildShareUrls, getRelatedPosts } = await import('public/blogHelpers'));
    ({ getBlogArticleSchema } = await import('backend/seoHelpers.web'));
    await import('../src/pages/Blog Post.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  // ── Initialization ──────────────────────────────────────────────

  it('calls trackEvent with page_view on init', async () => {
    await onReadyHandler();
    expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'blog_post' });
  });

  it('calls initBackToTop with $w', async () => {
    await onReadyHandler();
    expect(initBackToTop).toHaveBeenCalledWith($w);
  });

  // ── Reading Time Badge ──────────────────────────────────────────

  it('sets #postReadTime text with reading time', async () => {
    await onReadyHandler();
    expect(getEl('#postReadTime').text).toBe('5 min read');
  });

  it('sets #postDate text with formatted publish date', async () => {
    await onReadyHandler();
    expect(getEl('#postDate').text).toBe('Jan 15, 2026');
  });

  it('sets #postCategory text with post category', async () => {
    await onReadyHandler();
    expect(getEl('#postCategory').text).toBe('Guides');
  });

  // ── Author Bio ──────────────────────────────────────────────────

  it('sets #authorName from buildAuthorBio', async () => {
    await onReadyHandler();
    expect(getEl('#authorName').text).toBe('CF Team');
  });

  it('sets #authorDescription from buildAuthorBio', async () => {
    await onReadyHandler();
    expect(getEl('#authorDescription').text).toBe('Experts');
  });

  it('sets #authorLocation from buildAuthorBio', async () => {
    await onReadyHandler();
    expect(getEl('#authorLocation').text).toBe('Hendersonville, NC');
  });

  it('sets #authorEstablished with Est. prefix', async () => {
    await onReadyHandler();
    expect(getEl('#authorEstablished').text).toBe('Est. 1991');
  });

  it('expands #authorBioSection', async () => {
    await onReadyHandler();
    expect(getEl('#authorBioSection').expand).toHaveBeenCalled();
  });

  // ── Share Buttons ───────────────────────────────────────────────

  it('calls makeClickable for all four share buttons', async () => {
    await onReadyHandler();
    const selectors = makeClickable.mock.calls.map(c => c[0]);
    const shareIds = ['#postShareFacebook', '#postSharePinterest', '#postShareTwitter', '#postShareEmail'];
    for (const id of shareIds) {
      expect(selectors).toContain(getEl(id));
    }
  });

  // ── Related Posts ───────────────────────────────────────────────

  it('sets #relatedPostsRepeater data with related posts', async () => {
    await onReadyHandler();
    const data = getEl('#relatedPostsRepeater').data;
    expect(data).toHaveLength(1);
    expect(data[0].slug).toBe('related-post');
    expect(data[0]._id).toBe('related-post');
  });

  it('onItemReady sets #relatedTitle and #relatedCategory for each item', async () => {
    await onReadyHandler();
    const repeater = getEl('#relatedPostsRepeater');
    const cb = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    cb($item, { title: 'Related', slug: 'related-post', excerpt: 'Rel', category: 'Guides', _id: 'related-post' });
    expect($item('#relatedTitle').text).toBe('Related');
    expect($item('#relatedCategory').text).toBe('Guides');
  });

  it('onItemReady sets #relatedReadTime for each item', async () => {
    await onReadyHandler();
    const repeater = getEl('#relatedPostsRepeater');
    const cb = repeater.onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    cb($item, { title: 'Related', slug: 'related-post', excerpt: 'Rel', category: 'Guides', _id: 'related-post' });
    expect($item('#relatedReadTime').text).toBe('5 min read');
  });

  // ── SEO Schema ──────────────────────────────────────────────────

  it('posts article schema to #postSeoSchema', async () => {
    await onReadyHandler();
    const calls = getEl('#postSeoSchema').postMessage.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const payload = calls[0][0];
    expect(payload).toContain('<script type="application/ld+json">');
    expect(payload).toContain('{}');
  });

  // ── Page SEO ────────────────────────────────────────────────────

  it('calls initPageSeo with blogPost and post data', async () => {
    await onReadyHandler();
    expect(initPageSeo).toHaveBeenCalledWith('blogPost', {
      name: 'Test Post',
      slug: 'test-post',
      image: 'img.jpg',
    });
  });

  // ── Custom Event ────────────────────────────────────────────────

  it('fires blog_post_view custom event with slug and category', async () => {
    await onReadyHandler();
    expect(fireCustomEvent).toHaveBeenCalledWith('blog_post_view', {
      slug: 'test-post',
      category: 'Guides',
    });
  });

  // ── Early return guards ─────────────────────────────────────────

  it('returns early and skips enhancements when no slug in path', async () => {
    const wixLocation = await import('wix-location-frontend');
    wixLocation.default.path = [];
    await onReadyHandler();
    expect(initPageSeo).not.toHaveBeenCalled();
    expect(fireCustomEvent).not.toHaveBeenCalled();
    wixLocation.default.path = ['blog', 'test-post'];
  });

  it('returns early when getBlogPost returns null', async () => {
    getBlogPost.mockReturnValueOnce(null);
    await onReadyHandler();
    expect(initPageSeo).not.toHaveBeenCalled();
    expect(fireCustomEvent).not.toHaveBeenCalled();
  });
});
