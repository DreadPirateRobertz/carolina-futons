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
  getBusinessSchema: vi.fn(() => Promise.resolve('{}')),
}));

vi.mock('backend/productRecommendations.web', () => ({
  getFeaturedProducts: vi.fn(() => Promise.resolve([
    { _id: 'p1', name: 'Futon', slug: 'futon', mainMedia: 'img.jpg', formattedPrice: '$499' },
  ])),
}));

vi.mock('backend/blogContent', () => ({
  getAllBlogPosts: vi.fn(() => [
    { title: 'Post 1', slug: 'post-1', excerpt: 'Excerpt', category: 'Guides', publishDate: '2026-01-15' },
  ]),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: [], url: 'https://carolinafutons.com/blog' },
}));

vi.mock('public/mobileHelpers', () => ({
  limitForViewport: vi.fn((items) => items),
  initBackToTop: vi.fn(),
  onViewportChange: vi.fn(),
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

vi.mock('public/designTokens.js', () => ({
  colors: {
    mountainBlue: '#2B5B84',
    sandLight: '#F5F0EB',
    white: '#fff',
    espresso: '#3B2F2F',
    success: '#4A7C59',
  },
}));

vi.mock('public/blogHelpers', () => ({
  getCategories: vi.fn(() => ['Guides', 'News']),
  filterPostsByCategory: vi.fn((posts) => posts),
  getFeaturedPost: vi.fn(() => ({
    title: 'Featured',
    slug: 'featured',
    excerpt: 'Exc',
    category: 'Guides',
    publishDate: '2026-01-15',
  })),
  estimateReadingTime: vi.fn(() => 5),
  formatPublishDate: vi.fn(() => 'Jan 15, 2026'),
  buildAuthorBio: vi.fn(() => ({ name: 'CF Team' })),
}));

vi.mock('public/pageSeo.js', () => ({
  initPageSeo: vi.fn(),
}));

vi.mock('backend/newsletterService.web', () => ({
  subscribeToNewsletter: vi.fn(() => Promise.resolve({ success: true })),
}));

// ── Import mock refs ─────────────────────────────────────────────────

let initBackToTop, trackEvent, fireCustomEvent, makeClickable, announce,
  initPageSeo, getBusinessSchema, getFeaturedProducts, getAllBlogPosts,
  getFeaturedPost, getCategories, filterPostsByCategory, estimateReadingTime,
  formatPublishDate, buildAuthorBio, limitForViewport, subscribeToNewsletter;

beforeAll(async () => {
  ({ initBackToTop } = await import('public/mobileHelpers'));
  ({ trackEvent } = await import('public/engagementTracker'));
  ({ fireCustomEvent } = await import('public/ga4Tracking'));
  ({ makeClickable, announce } = await import('public/a11yHelpers'));
  ({ initPageSeo } = await import('public/pageSeo.js'));
  ({ getBusinessSchema } = await import('backend/seoHelpers.web'));
  ({ getFeaturedProducts } = await import('backend/productRecommendations.web'));
  ({ getAllBlogPosts } = await import('backend/blogContent'));
  ({ getFeaturedPost, getCategories, filterPostsByCategory, estimateReadingTime, formatPublishDate, buildAuthorBio } = await import('public/blogHelpers'));
  ({ limitForViewport } = await import('public/mobileHelpers'));
  ({ subscribeToNewsletter } = await import('backend/newsletterService.web'));

  await import('../src/pages/Blog.js');
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('Blog page handlers', () => {

  // ── Initialization ────────────────────────────────────────────────

  describe('onReady initialization', () => {
    it('calls initBackToTop with $w', async () => {
      await onReadyHandler();
      expect(initBackToTop).toHaveBeenCalledWith($w);
    });

    it('calls initPageSeo with blog', async () => {
      await onReadyHandler();
      expect(initPageSeo).toHaveBeenCalledWith('blog');
    });

    it('tracks page_view event', async () => {
      await onReadyHandler();
      expect(trackEvent).toHaveBeenCalledWith('page_view', { page: 'blog' });
    });

    it('calls getAllBlogPosts', async () => {
      await onReadyHandler();
      expect(getAllBlogPosts).toHaveBeenCalled();
    });

    it('posts SEO schema to #blogSeoSchema', async () => {
      await onReadyHandler();
      expect(getEl('#blogSeoSchema').postMessage).toHaveBeenCalledWith(
        expect.stringContaining('<script type="application/ld+json">')
      );
    });
  });

  // ── Featured Hero ─────────────────────────────────────────────────

  describe('initFeaturedHero', () => {
    it('sets #featuredTitle text from featured post', async () => {
      await onReadyHandler();
      expect(getEl('#featuredTitle').text).toBe('Featured');
    });

    it('sets #featuredExcerpt text from featured post', async () => {
      await onReadyHandler();
      expect(getEl('#featuredExcerpt').text).toBe('Exc');
    });

    it('sets #featuredCategory text from featured post', async () => {
      await onReadyHandler();
      expect(getEl('#featuredCategory').text).toBe('Guides');
    });

    it('sets #featuredDate text via formatPublishDate', async () => {
      await onReadyHandler();
      expect(getEl('#featuredDate').text).toBe('Jan 15, 2026');
    });

    it('sets #featuredReadTime with estimated read time', async () => {
      await onReadyHandler();
      expect(getEl('#featuredReadTime').text).toBe('5 min read');
    });

    it('sets #featuredAuthor text from buildAuthorBio', async () => {
      await onReadyHandler();
      expect(getEl('#featuredAuthor').text).toBe('CF Team');
    });

    it('calls makeClickable on #featuredHeroLink', async () => {
      await onReadyHandler();
      const calls = makeClickable.mock.calls.map(c => c[0]);
      expect(calls).toContain(getEl('#featuredHeroLink'));
    });

    it('expands #featuredHeroSection when featured post exists', async () => {
      await onReadyHandler();
      expect(getEl('#featuredHeroSection').expand).toHaveBeenCalled();
    });

    it('fires blog_featured_view custom event', async () => {
      await onReadyHandler();
      expect(fireCustomEvent).toHaveBeenCalledWith('blog_featured_view', { slug: 'featured' });
    });

    it('collapses #featuredHeroSection when no featured post', async () => {
      getFeaturedPost.mockReturnValueOnce(null);
      await onReadyHandler();
      expect(getEl('#featuredHeroSection').collapse).toHaveBeenCalled();
    });
  });

  // ── Category Filters ──────────────────────────────────────────────

  describe('initCategoryFilters', () => {
    it('sets data on #categoryFilterRepeater including All item', async () => {
      await onReadyHandler();
      const data = getEl('#categoryFilterRepeater').data;
      expect(data.length).toBeGreaterThanOrEqual(3); // All + Guides + News
      expect(data[0].label).toBe('All');
      expect(data[0].value).toBeNull();
    });

    it('registers onItemReady on #categoryFilterRepeater', async () => {
      await onReadyHandler();
      expect(getEl('#categoryFilterRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets #filterLabel text', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryFilterRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'cat-0', label: 'Guides', value: 'Guides' });
      expect($item('#filterLabel').text).toBe('Guides');
    });

    it('onItemReady calls makeClickable on #filterChip', async () => {
      await onReadyHandler();
      const repeater = getEl('#categoryFilterRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'cat-0', label: 'Guides', value: 'Guides' });
      expect(makeClickable).toHaveBeenCalledWith(
        $item('#filterChip'),
        expect.any(Function),
        expect.objectContaining({ ariaLabel: expect.stringContaining('Guides') })
      );
    });
  });

  // ── Blog Card Grid ────────────────────────────────────────────────

  describe('renderBlogGrid', () => {
    it('sets data on #blogGridRepeater', async () => {
      await onReadyHandler();
      expect(getEl('#blogGridRepeater').data.length).toBeGreaterThan(0);
    });

    it('registers onItemReady on #blogGridRepeater', async () => {
      await onReadyHandler();
      expect(getEl('#blogGridRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets #cardTitle text', async () => {
      await onReadyHandler();
      const repeater = getEl('#blogGridRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'post-1', title: 'Post 1', excerpt: 'Excerpt', category: 'Guides', publishDate: '2026-01-15', slug: 'post-1' });
      expect($item('#cardTitle').text).toBe('Post 1');
    });

    it('onItemReady sets #cardExcerpt text', async () => {
      await onReadyHandler();
      const repeater = getEl('#blogGridRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'post-1', title: 'Post 1', excerpt: 'Excerpt', category: 'Guides', publishDate: '2026-01-15', slug: 'post-1' });
      expect($item('#cardExcerpt').text).toBe('Excerpt');
    });

    it('onItemReady sets #cardCategory text', async () => {
      await onReadyHandler();
      const repeater = getEl('#blogGridRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'post-1', title: 'Post 1', excerpt: 'Excerpt', category: 'Guides', publishDate: '2026-01-15', slug: 'post-1' });
      expect($item('#cardCategory').text).toBe('Guides');
    });

    it('onItemReady sets #cardReadTime with min read suffix', async () => {
      await onReadyHandler();
      const repeater = getEl('#blogGridRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'post-1', title: 'Post 1', excerpt: 'Excerpt', category: 'Guides', publishDate: '2026-01-15', slug: 'post-1' });
      expect($item('#cardReadTime').text).toMatch(/min read$/);
    });

    it('onItemReady calls makeClickable on #blogCardLink', async () => {
      await onReadyHandler();
      const repeater = getEl('#blogGridRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'post-1', title: 'Post 1', excerpt: 'Excerpt', category: 'Guides', publishDate: '2026-01-15', slug: 'post-1' });
      expect(makeClickable).toHaveBeenCalledWith(
        $item('#blogCardLink'),
        expect.any(Function),
        expect.objectContaining({ ariaLabel: expect.stringContaining('Post 1') })
      );
    });

    it('collapses grid and expands empty state when no posts', async () => {
      getAllBlogPosts.mockReturnValueOnce([]);
      await onReadyHandler();
      expect(getEl('#blogEmptyState').expand).toHaveBeenCalled();
      expect(getEl('#blogGridRepeater').collapse).toHaveBeenCalled();
    });
  });

  // ── Related Products Sidebar ──────────────────────────────────────

  describe('initRelatedProductsSidebar', () => {
    it('sets data on #blogProductsRepeater', async () => {
      await onReadyHandler();
      expect(getEl('#blogProductsRepeater').data.length).toBeGreaterThan(0);
    });

    it('registers onItemReady on #blogProductsRepeater', async () => {
      await onReadyHandler();
      expect(getEl('#blogProductsRepeater').onItemReady).toHaveBeenCalled();
    });

    it('onItemReady sets #sidebarProductImage src and alt', async () => {
      await onReadyHandler();
      const repeater = getEl('#blogProductsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'p1', name: 'Futon', slug: 'futon', mainMedia: 'img.jpg', formattedPrice: '$499' });
      expect($item('#sidebarProductImage').src).toBe('img.jpg');
      expect($item('#sidebarProductImage').alt).toBe('Futon');
    });

    it('onItemReady sets #sidebarProductName and #sidebarProductPrice', async () => {
      await onReadyHandler();
      const repeater = getEl('#blogProductsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'p1', name: 'Futon', slug: 'futon', mainMedia: 'img.jpg', formattedPrice: '$499' });
      expect($item('#sidebarProductName').text).toBe('Futon');
      expect($item('#sidebarProductPrice').text).toBe('$499');
    });

    it('onItemReady calls makeClickable on #sidebarProductLink', async () => {
      await onReadyHandler();
      const repeater = getEl('#blogProductsRepeater');
      const cb = repeater.onItemReady.mock.calls[0][0];
      const itemEls = new Map();
      const $item = (sel) => {
        if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
        return itemEls.get(sel);
      };
      cb($item, { _id: 'p1', name: 'Futon', slug: 'futon', mainMedia: 'img.jpg', formattedPrice: '$499' });
      expect(makeClickable).toHaveBeenCalledWith(
        $item('#sidebarProductLink'),
        expect.any(Function),
        expect.objectContaining({ ariaLabel: expect.stringContaining('Futon') })
      );
    });

    it('collapses #blogProductsSection when no featured products', async () => {
      getFeaturedProducts.mockResolvedValueOnce([]);
      await onReadyHandler();
      expect(getEl('#blogProductsSection').collapse).toHaveBeenCalled();
    });
  });

  // ── Social Share Buttons ──────────────────────────────────────────

  describe('initSocialShareButtons', () => {
    it('calls makeClickable on #shareFacebook', async () => {
      await onReadyHandler();
      const calls = makeClickable.mock.calls.map(c => c[0]);
      expect(calls).toContain(getEl('#shareFacebook'));
    });

    it('calls makeClickable on #sharePinterest', async () => {
      await onReadyHandler();
      const calls = makeClickable.mock.calls.map(c => c[0]);
      expect(calls).toContain(getEl('#sharePinterest'));
    });

    it('calls makeClickable on #shareTwitter', async () => {
      await onReadyHandler();
      const calls = makeClickable.mock.calls.map(c => c[0]);
      expect(calls).toContain(getEl('#shareTwitter'));
    });

    it('calls makeClickable on #shareEmail', async () => {
      await onReadyHandler();
      const calls = makeClickable.mock.calls.map(c => c[0]);
      expect(calls).toContain(getEl('#shareEmail'));
    });

    it('Facebook aria label mentions Facebook', async () => {
      await onReadyHandler();
      const facebookCall = makeClickable.mock.calls.find(c => c[0] === getEl('#shareFacebook'));
      expect(facebookCall[2].ariaLabel).toMatch(/Facebook/i);
    });
  });

  // ── Newsletter ────────────────────────────────────────────────────

  describe('initBlogNewsletter', () => {
    it('registers onClick on #blogNewsletterSubmit', async () => {
      await onReadyHandler();
      expect(getEl('#blogNewsletterSubmit').onClick).toHaveBeenCalled();
    });

    it('sets ariaLabel on email input via accessibility', async () => {
      await onReadyHandler();
      expect(getEl('#blogNewsletterEmail').accessibility.ariaLabel).toBeTruthy();
    });

    it('shows error when email is empty on submit', async () => {
      await onReadyHandler();
      getEl('#blogNewsletterEmail').value = '';
      const clickHandler = getEl('#blogNewsletterSubmit').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#blogNewsletterError').show).toHaveBeenCalled();
    });

    it('shows error when email is invalid on submit', async () => {
      await onReadyHandler();
      getEl('#blogNewsletterEmail').value = 'not-an-email';
      const clickHandler = getEl('#blogNewsletterSubmit').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#blogNewsletterError').show).toHaveBeenCalled();
    });

    it('calls subscribeToNewsletter with valid email', async () => {
      await onReadyHandler();
      getEl('#blogNewsletterEmail').value = 'test@example.com';
      const clickHandler = getEl('#blogNewsletterSubmit').onClick.mock.calls[0][0];
      await clickHandler();
      expect(subscribeToNewsletter).toHaveBeenCalledWith(
        'test@example.com',
        expect.objectContaining({ source: 'blog_newsletter' })
      );
    });

    it('shows success element on successful subscription', async () => {
      await onReadyHandler();
      getEl('#blogNewsletterEmail').value = 'test@example.com';
      const clickHandler = getEl('#blogNewsletterSubmit').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#blogNewsletterSuccess').show).toHaveBeenCalled();
    });

    it('fires newsletter_signup custom event on success', async () => {
      await onReadyHandler();
      getEl('#blogNewsletterEmail').value = 'test@example.com';
      const clickHandler = getEl('#blogNewsletterSubmit').onClick.mock.calls[0][0];
      await clickHandler();
      expect(fireCustomEvent).toHaveBeenCalledWith('newsletter_signup', { source: 'blog' });
    });

    it('re-enables submit button after successful subscription', async () => {
      await onReadyHandler();
      getEl('#blogNewsletterEmail').value = 'test@example.com';
      const clickHandler = getEl('#blogNewsletterSubmit').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#blogNewsletterSubmit').enable).toHaveBeenCalled();
    });

    it('shows error when subscription returns failure', async () => {
      subscribeToNewsletter.mockResolvedValueOnce({ success: false, message: 'Already subscribed' });
      await onReadyHandler();
      getEl('#blogNewsletterEmail').value = 'test@example.com';
      const clickHandler = getEl('#blogNewsletterSubmit').onClick.mock.calls[0][0];
      await clickHandler();
      expect(getEl('#blogNewsletterError').show).toHaveBeenCalled();
    });
  });
});
