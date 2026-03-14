import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '' },
    accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(),
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

// ── Mock Post Data ──────────────────────────────────────────────────

const mockPost = {
  slug: 'futon-care-guide',
  title: 'How to Care for Your Futon',
  excerpt: 'A comprehensive guide to futon maintenance, cleaning, and longevity tips for keeping your futon in great shape for years.',
  category: 'Care Tips',
  publishDate: '2026-01-15',
  coverImage: 'https://img/futon-care.jpg',
  heroImage: 'https://img/futon-care-hero.jpg',
  author: 'Carolina Futons',
};

const mockRelatedPosts = [
  { slug: 'choosing-right-mattress', title: 'Choosing the Right Mattress', category: 'Buying Guide', excerpt: 'Short guide to mattress selection.' },
  { slug: 'futon-vs-sofa-bed', title: 'Futon vs Sofa Bed', category: 'Comparisons', excerpt: 'Compare futons and sofa beds side by side.' },
];

// ── Mock Backend Modules ────────────────────────────────────────────

vi.mock('backend/seoHelpers.web', () => ({
  getBlogArticleSchema: vi.fn().mockResolvedValue('{"@type":"Article"}'),
  getBlogFaqSchema: vi.fn().mockResolvedValue(null),
  getPageTitle: vi.fn().mockResolvedValue('How to Care for Your Futon | Carolina Futons Blog'),
  getCanonicalUrl: vi.fn().mockResolvedValue('https://www.carolinafutons.com/blog/futon-care-guide'),
  getPageMetaDescription: vi.fn().mockResolvedValue('A comprehensive guide...'),
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getGuidePinData: vi.fn().mockResolvedValue({ success: false }),
}));

vi.mock('backend/blogContent', () => ({
  getBlogPost: vi.fn((slug) => slug === 'futon-care-guide' ? mockPost : null),
  getAllBlogPosts: vi.fn().mockReturnValue([mockPost, ...mockRelatedPosts]),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: ['blog', 'futon-care-guide'], to: vi.fn() },
  to: vi.fn(),
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
    el._clickHandler = handler;
    el._a11yOpts = opts;
  }),
}));

vi.mock('public/blogHelpers', () => ({
  estimateReadingTime: vi.fn().mockReturnValue(5),
  formatPublishDate: vi.fn().mockReturnValue('January 15, 2026'),
  buildAuthorBio: vi.fn().mockReturnValue({
    name: 'Carolina Futons',
    description: 'Family-owned furniture store since 1991.',
    location: 'Hendersonville, NC',
    established: '1991',
  }),
  buildShareUrls: vi.fn().mockReturnValue({
    facebook: 'https://facebook.com/share?u=test',
    pinterest: 'https://pinterest.com/pin/create?url=test',
    twitter: 'https://twitter.com/intent/tweet?url=test',
    email: 'mailto:?subject=test',
  }),
  getRelatedPosts: vi.fn().mockReturnValue(mockRelatedPosts),
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

const { trackEvent } = await import('public/engagementTracker');
const { fireCustomEvent } = await import('public/ga4Tracking');
const { makeClickable } = await import('public/a11yHelpers');
const { estimateReadingTime, buildAuthorBio, getRelatedPosts } = await import('public/blogHelpers');
const { getBlogArticleSchema } = await import('backend/seoHelpers.web');
const { initPageSeo } = await import('public/pageSeo.js');

// ── Import Page ─────────────────────────────────────────────────────

describe('Blog Post Page', () => {
  beforeAll(async () => {
    await import('../src/pages/Blog Post.js');
  });

  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    getRelatedPosts.mockReturnValue(mockRelatedPosts);
  });

  // ── onReady basics ──────────────────────────────────────────────

  describe('onReady', () => {
    it('tracks page_view for blog_post', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'blog_post' });
    });

    it('fires GA4 blog_post_view with slug and category', async () => {
      await onReadyHandler();
      expect(fireCustomEvent).toHaveBeenCalledWith('blog_post_view', {
        slug: 'futon-care-guide',
        category: 'Care Tips',
      });
    });

    it('calls initPageSeo with blogPost type and post data', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('blogPost', {
        name: 'How to Care for Your Futon',
        slug: 'futon-care-guide',
        image: 'https://img/futon-care.jpg',
      });
    });
  });

  // ── Reading Time Badge ──────────────────────────────────────────

  describe('reading time badge', () => {
    it('displays reading time in minutes', async () => {
      await onReadyHandler();
      expect(getEl('#postReadTime').text).toBe('5 min read');
    });

    it('displays formatted publish date', async () => {
      await onReadyHandler();
      expect(getEl('#postDate').text).toBe('January 15, 2026');
    });

    it('displays post category', async () => {
      await onReadyHandler();
      expect(getEl('#postCategory').text).toBe('Care Tips');
    });
  });

  // ── Author Bio ──────────────────────────────────────────────────

  describe('author bio', () => {
    it('sets author name, description, and location', async () => {
      await onReadyHandler();
      expect(getEl('#authorName').text).toBe('Carolina Futons');
      expect(getEl('#authorDescription').text).toBe('Family-owned furniture store since 1991.');
      expect(getEl('#authorLocation').text).toBe('Hendersonville, NC');
    });

    it('sets established year', async () => {
      await onReadyHandler();
      expect(getEl('#authorEstablished').text).toBe('Est. 1991');
    });

    it('expands author bio section', async () => {
      await onReadyHandler();
      expect(getEl('#authorBioSection').expand).toHaveBeenCalled();
    });
  });

  // ── Social Share Buttons ────────────────────────────────────────

  describe('social share buttons', () => {
    it('registers makeClickable on all 4 share buttons', async () => {
      await onReadyHandler();
      const registeredEls = makeClickable.mock.calls.map(c => c[0]);
      expect(registeredEls).toContain(getEl('#postShareFacebook'));
      expect(registeredEls).toContain(getEl('#postSharePinterest'));
      expect(registeredEls).toContain(getEl('#postShareTwitter'));
      expect(registeredEls).toContain(getEl('#postShareEmail'));
    });

    it('sets correct ARIA labels on share buttons', async () => {
      await onReadyHandler();
      const fbCall = makeClickable.mock.calls.find(c => c[0] === getEl('#postShareFacebook'));
      expect(fbCall[2].ariaLabel).toBe('Share on Facebook (opens in new window)');

      const emailCall = makeClickable.mock.calls.find(c => c[0] === getEl('#postShareEmail'));
      expect(emailCall[2].ariaLabel).toBe('Share via email');
    });
  });

  // ── Related Posts ───────────────────────────────────────────────

  describe('related posts', () => {
    it('populates relatedPostsRepeater with related post data', async () => {
      await onReadyHandler();
      const repeater = getEl('#relatedPostsRepeater');
      expect(repeater.data).toHaveLength(2);
      expect(repeater.data[0]._id).toBe('choosing-right-mattress');
      expect(repeater.data[1]._id).toBe('futon-vs-sofa-bed');
    });

    it('expands relatedPostsSection when related posts exist', async () => {
      await onReadyHandler();
      expect(getEl('#relatedPostsSection').expand).toHaveBeenCalled();
    });

    it('collapses relatedPostsSection when no related posts', async () => {
      getRelatedPosts.mockReturnValue([]);
      await onReadyHandler();
      expect(getEl('#relatedPostsSection').collapse).toHaveBeenCalled();
    });

    it('onItemReady sets title, category, and reading time', async () => {
      // Pre-create repeater element before onReady so it persists
      const repeater = getEl('#relatedPostsRepeater');
      await onReadyHandler();
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };

      onItemReadyCb($item, mockRelatedPosts[0]);

      expect($item('#relatedTitle').text).toBe('Choosing the Right Mattress');
      expect($item('#relatedCategory').text).toBe('Buying Guide');
    });

    it('onItemReady registers makeClickable for navigation', async () => {
      const repeater = getEl('#relatedPostsRepeater');
      await onReadyHandler();
      const onItemReadyCb = repeater.onItemReady.mock.calls[0][0];

      const itemElements = new Map();
      const $item = (sel) => {
        if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
        return itemElements.get(sel);
      };

      onItemReadyCb($item, mockRelatedPosts[0]);

      const linkCall = makeClickable.mock.calls.find(c => c[0] === $item('#relatedPostLink'));
      expect(linkCall).toBeDefined();
      expect(linkCall[2].ariaLabel).toBe('Read related: Choosing the Right Mattress');
    });
  });

  // ── SEO Schema ──────────────────────────────────────────────────

  describe('SEO schema injection', () => {
    it('posts article schema to postSeoSchema element', async () => {
      await onReadyHandler();
      expect(getBlogArticleSchema).toHaveBeenCalledWith(mockPost);
      expect(getEl('#postSeoSchema').postMessage).toHaveBeenCalled();
      const msg = getEl('#postSeoSchema').postMessage.mock.calls[0][0];
      expect(msg).toContain('application/ld+json');
      expect(msg).toContain('Article');
    });
  });
});
