import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('public/blogHelpers', () => ({
  estimateReadingTime: vi.fn((text) => {
    if (!text || typeof text !== 'string') return 1;
    return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));
  }),
  getFeaturedPost: vi.fn(),
}));
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));
vi.mock('public/designTokens.js', () => ({
  colors: {
    espresso: '#1E3A5F',
    espressoLight: '#3D5A80',
    mountainBlue: '#5B8FA8',
    sunsetCoral: '#4A7D94',
    sandBase: '#F0F4F8',
    sandDark: '#E2E8F0',
    muted: '#646C79',
  },
  spacing: { xs: '6px', sm: '8px', md: '16px', lg: '24px' },
}));

import {
  buildTeaserData,
  buildTeaserCardHtml,
  buildBlogTeaserSection,
  initHomeBlogTeasers,
  initBlogTeaserRepeater,
  MAX_TEASERS,
  EXCERPT_MAX_LENGTH,
  truncateExcerpt,
} from '../src/public/HomeBlogTeasers.js';
import { trackEvent } from 'public/engagementTracker';

// ── Fixtures ────────────────────────────────────────────────────────
const MOCK_POSTS = [
  {
    title: 'Best Futons for Everyday Sleeping',
    slug: 'best-futons-everyday-sleeping',
    excerpt: 'Yes, you can sleep on a futon every night. Here is how to choose the right one for your needs and budget.',
    plainContent: 'Yes, you can sleep on a futon every night...',
    category: 'Buying Guides',
    publishDate: '2026-03-10',
    coverImage: 'https://example.com/image1.jpg',
  },
  {
    title: 'Futon vs Sofa Bed: The Honest Comparison',
    slug: 'futon-vs-sofa-bed',
    excerpt: 'We sell futons, but we will tell you when a sofa bed might be better.',
    plainContent: 'We sell futons, but we will tell you...',
    category: 'Comparisons',
    publishDate: '2026-03-08',
    coverImage: 'https://example.com/image2.jpg',
  },
  {
    title: 'Small Space Furniture Solutions',
    slug: 'small-space-furniture',
    excerpt: 'Futons, Murphy beds, and platform beds compared for apartments, studios, and guest rooms.',
    plainContent: 'Futons, Murphy beds, and platform beds...',
    category: 'Room Ideas',
    publishDate: '2026-03-05',
    coverImage: null,
  },
  {
    title: 'Old Post That Should Not Appear',
    slug: 'old-post',
    excerpt: 'This is an older post.',
    plainContent: 'This is an older post...',
    category: 'Archive',
    publishDate: '2025-01-01',
    coverImage: null,
  },
];

function create$w(elementMap = {}) {
  return (selector) => elementMap[selector] || null;
}

function mockHtmlElement(id) {
  return {
    _id: id,
    html: '',
    accessibility: {},
    collapsed: false,
    collapse: vi.fn(function () { this.collapsed = true; }),
  };
}

describe('HomeBlogTeasers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── truncateExcerpt ──────────────────────────────────────────────
  describe('truncateExcerpt', () => {
    it('returns empty string for null/undefined', () => {
      expect(truncateExcerpt(null, 100)).toBe('');
      expect(truncateExcerpt(undefined, 100)).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(truncateExcerpt(42, 100)).toBe('');
    });

    it('returns text as-is if shorter than max', () => {
      expect(truncateExcerpt('Short text', 100)).toBe('Short text');
    });

    it('truncates at word boundary with ellipsis', () => {
      const text = 'This is a longer sentence that needs to be truncated at a reasonable point';
      const result = truncateExcerpt(text, 40);
      expect(result.length).toBeLessThanOrEqual(43); // 40 + "..."
      expect(result).toMatch(/\.\.\.$/);
    });

    it('trims whitespace before processing', () => {
      expect(truncateExcerpt('  hello  ', 100)).toBe('hello');
    });

    it('handles text exactly at max length', () => {
      const text = 'x'.repeat(120);
      expect(truncateExcerpt(text, 120)).toBe(text);
    });
  });

  // ── buildTeaserData ──────────────────────────────────────────────
  describe('buildTeaserData', () => {
    it('returns null for null/undefined post', () => {
      expect(buildTeaserData(null)).toBeNull();
      expect(buildTeaserData(undefined)).toBeNull();
    });

    it('extracts title, excerpt, category, slug from post', () => {
      const result = buildTeaserData(MOCK_POSTS[0]);
      expect(result.title).toBe('Best Futons for Everyday Sleeping');
      expect(result.slug).toBe('best-futons-everyday-sleeping');
      expect(result.category).toBe('Buying Guides');
    });

    it('truncates excerpt to EXCERPT_MAX_LENGTH', () => {
      const longPost = {
        ...MOCK_POSTS[0],
        excerpt: 'A'.repeat(200) + ' word boundary here',
      };
      const result = buildTeaserData(longPost);
      expect(result.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_LENGTH + 3);
    });

    it('computes reading time from plainContent', () => {
      const result = buildTeaserData(MOCK_POSTS[0]);
      expect(result.readingTime).toBeGreaterThanOrEqual(1);
    });

    it('includes cover image when available', () => {
      const result = buildTeaserData(MOCK_POSTS[0]);
      expect(result.image).toBe('https://example.com/image1.jpg');
    });

    it('sets image to null when no coverImage', () => {
      const result = buildTeaserData(MOCK_POSTS[2]);
      expect(result.image).toBeNull();
    });

    it('defaults title to Untitled for missing title', () => {
      const result = buildTeaserData({ slug: 'test' });
      expect(result.title).toBe('Untitled');
    });

    it('defaults category to empty string for missing category', () => {
      const result = buildTeaserData({ title: 'Test' });
      expect(result.category).toBe('');
    });

    it('falls back to plainContent when excerpt is missing', () => {
      const post = { title: 'No Excerpt', plainContent: 'Some content here' };
      const result = buildTeaserData(post);
      expect(result.excerpt).toBe('Some content here');
    });
  });

  // ── buildTeaserCardHtml ──────────────────────────────────────────
  describe('buildTeaserCardHtml', () => {
    it('returns empty string for null teaser', () => {
      expect(buildTeaserCardHtml(null)).toBe('');
    });

    it('includes the post title', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('Best Futons for Everyday Sleeping');
    });

    it('includes the excerpt', () => {
      const teaser = buildTeaserData(MOCK_POSTS[1]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('sofa bed');
    });

    it('includes reading time', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('min read');
    });

    it('includes a Read more link to the blog post', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('/blog/best-futons-everyday-sleeping');
      expect(html).toContain('Read more');
    });

    it('includes category badge when category is present', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('Buying Guides');
    });

    it('omits category badge when category is empty', () => {
      const teaser = buildTeaserData({ title: 'No Cat', slug: 'test' });
      const html = buildTeaserCardHtml(teaser);
      expect(html).not.toContain('text-transform:uppercase');
    });

    it('includes cover image when available', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('<img');
      expect(html).toContain('https://example.com/image1.jpg');
    });

    it('omits image when not available', () => {
      const teaser = buildTeaserData(MOCK_POSTS[2]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).not.toContain('<img');
    });

    it('includes lazy loading for images', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('loading="lazy"');
    });

    it('wraps in article element with role', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('<article');
      expect(html).toContain('role="article"');
    });

    it('includes accessible aria-label on read more link', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('aria-label="Read Best Futons for Everyday Sleeping"');
    });
  });

  // ── buildBlogTeaserSection ───────────────────────────────────────
  describe('buildBlogTeaserSection', () => {
    it('returns empty string for null/undefined posts', () => {
      expect(buildBlogTeaserSection(null)).toBe('');
      expect(buildBlogTeaserSection(undefined)).toBe('');
    });

    it('returns empty string for empty array', () => {
      expect(buildBlogTeaserSection([])).toBe('');
    });

    it('includes section header with "From Our Blog"', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      expect(html).toContain('From Our Blog');
    });

    it('limits to MAX_TEASERS (3) posts', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      // 4 posts in fixture, but only 3 should appear (MAX_TEASERS = 3)
      expect(html).toContain('Best Futons');
      expect(html).toContain('Futon vs Sofa Bed');
      expect(html).toContain('Small Space');
      expect(html).not.toContain('Old Post That Should Not Appear');
    });

    it('sorts posts by publishDate descending (newest first)', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      const bestIdx = html.indexOf('Best Futons');
      const vsIdx = html.indexOf('Futon vs Sofa Bed');
      const smallIdx = html.indexOf('Small Space');
      expect(bestIdx).toBeLessThan(vsIdx);
      expect(vsIdx).toBeLessThan(smallIdx);
    });

    it('includes "View all posts" link to /blog', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      expect(html).toContain('/blog');
      expect(html).toContain('View all posts');
    });

    it('uses grid layout with role="feed"', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      expect(html).toContain('display:grid');
      expect(html).toContain('role="feed"');
    });

    it('handles single post gracefully', () => {
      const html = buildBlogTeaserSection([MOCK_POSTS[0]]);
      expect(html).toContain('Best Futons');
      expect(html).toContain('From Our Blog');
    });
  });

  // ── initHomeBlogTeasers ──────────────────────────────────────────
  describe('initHomeBlogTeasers', () => {
    it('collapses container when no posts returned', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        getAllBlogPosts: vi.fn().mockResolvedValue([]),
      }));

      const container = mockHtmlElement('blogTeaserSection');
      const $w = create$w({ '#blogTeaserSection': container });

      await initHomeBlogTeasers($w);

      expect(container.collapse).toHaveBeenCalled();
    });

    it('does nothing when container element is missing', async () => {
      const $w = create$w({});
      await expect(initHomeBlogTeasers($w)).resolves.toBeUndefined();
    });

    it('collapses container on error', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        getAllBlogPosts: vi.fn().mockRejectedValue(new Error('CMS offline')),
      }));

      const container = mockHtmlElement('blogTeaserSection');
      const $w = create$w({ '#blogTeaserSection': container });

      await initHomeBlogTeasers($w);

      expect(container.collapse).toHaveBeenCalled();
    });
  });

  // ── Constants ────────────────────────────────────────────────────
  describe('constants', () => {
    it('MAX_TEASERS is 3', () => {
      expect(MAX_TEASERS).toBe(3);
    });

    it('EXCERPT_MAX_LENGTH is 120', () => {
      expect(EXCERPT_MAX_LENGTH).toBe(120);
    });
  });

  // ── initBlogTeaserRepeater ───────────────────────────────────────
  describe('initBlogTeaserRepeater', () => {
    function mockSection(id) {
      return {
        _id: id,
        html: '',
        accessibility: {},
        collapsed: false,
        collapse: vi.fn(function () { this.collapsed = true; }),
      };
    }

    function mockRepeater() {
      const rep = {
        data: null,
        _itemReadyCb: null,
        onItemReady: vi.fn(function (cb) { rep._itemReadyCb = cb; }),
      };
      return rep;
    }

    function mockItemEl() {
      return {
        text: '',
        src: '',
        alt: '',
        link: '',
        accessibility: {},
        show: vi.fn(),
        hide: vi.fn(),
      };
    }

    function createItemSelector(elements) {
      return (id) => elements[id] || null;
    }

    it('does nothing when #blogTeaserSection is missing', async () => {
      const $w = create$w({});
      await expect(initBlogTeaserRepeater($w)).resolves.toBeUndefined();
    });

    it('collapses section when no posts returned', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue([]),
      }));
      const section = mockSection('blogTeaserSection');
      const $w = create$w({ '#blogTeaserSection': section });

      await initBlogTeaserRepeater($w);

      expect(section.collapse).toHaveBeenCalled();
    });

    it('collapses section on fetch error', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockRejectedValue(new Error('CMS offline')),
      }));
      const section = mockSection('blogTeaserSection');
      const $w = create$w({ '#blogTeaserSection': section });

      await initBlogTeaserRepeater($w);

      expect(section.collapse).toHaveBeenCalled();
    });

    it('sets repeater data with at most MAX_TEASERS items', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue(MOCK_POSTS),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      expect(repeater.data).toHaveLength(3);
      expect(repeater.onItemReady).toHaveBeenCalled();
    });

    it('sorts repeater data newest-first by publishDate', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue(MOCK_POSTS),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      expect(repeater.data[0].slug).toBe('best-futons-everyday-sleeping');
      expect(repeater.data[1].slug).toBe('futon-vs-sofa-bed');
      expect(repeater.data[2].slug).toBe('small-space-furniture');
    });

    it('adds _id field to each repeater item', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue(MOCK_POSTS),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      for (const item of repeater.data) {
        expect(item._id).toBeDefined();
        expect(typeof item._id).toBe('string');
      }
    });

    it('onItemReady sets title and excerpt', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue([MOCK_POSTS[0]]),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      const titleEl = mockItemEl();
      const excerptEl = mockItemEl();
      const catEl = mockItemEl();
      const readEl = mockItemEl();
      const imgEl = mockItemEl();
      const linkEl = mockItemEl();
      const $item = createItemSelector({
        '#blogTeaserTitle': titleEl,
        '#blogTeaserExcerpt': excerptEl,
        '#blogTeaserCategory': catEl,
        '#blogTeaserReadTime': readEl,
        '#blogTeaserImage': imgEl,
        '#blogTeaserLink': linkEl,
      });

      repeater._itemReadyCb($item, repeater.data[0]);

      expect(titleEl.text).toBe('Best Futons for Everyday Sleeping');
      expect(excerptEl.text).toContain('sleep on a futon');
    });

    it('onItemReady sets cover image src and alt', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue([MOCK_POSTS[0]]),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      const imgEl = mockItemEl();
      const $item = createItemSelector({ '#blogTeaserImage': imgEl });
      repeater._itemReadyCb($item, repeater.data[0]);

      expect(imgEl.src).toBe('https://example.com/image1.jpg');
      expect(imgEl.alt).toBe('Best Futons for Everyday Sleeping');
      expect(imgEl.show).toHaveBeenCalled();
    });

    it('onItemReady hides image element when no cover image', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue([MOCK_POSTS[2]]),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      const imgEl = mockItemEl();
      const $item = createItemSelector({ '#blogTeaserImage': imgEl });
      repeater._itemReadyCb($item, repeater.data[0]);

      expect(imgEl.hide).toHaveBeenCalled();
    });

    it('onItemReady shows category when present', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue([MOCK_POSTS[0]]),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      const catEl = mockItemEl();
      const $item = createItemSelector({ '#blogTeaserCategory': catEl });
      repeater._itemReadyCb($item, repeater.data[0]);

      expect(catEl.text).toBe('Buying Guides');
      expect(catEl.show).toHaveBeenCalled();
    });

    it('onItemReady hides category when absent', async () => {
      const noCategory = { ...MOCK_POSTS[0], category: '' };
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue([noCategory]),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      const catEl = mockItemEl();
      const $item = createItemSelector({ '#blogTeaserCategory': catEl });
      repeater._itemReadyCb($item, repeater.data[0]);

      expect(catEl.hide).toHaveBeenCalled();
    });

    it('onItemReady sets reading time text', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue([MOCK_POSTS[0]]),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      const readEl = mockItemEl();
      const $item = createItemSelector({ '#blogTeaserReadTime': readEl });
      repeater._itemReadyCb($item, repeater.data[0]);

      expect(readEl.text).toMatch(/\d+ min read/);
    });

    it('onItemReady sets blog link on the link element', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue([MOCK_POSTS[0]]),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      const linkEl = mockItemEl();
      const $item = createItemSelector({ '#blogTeaserLink': linkEl });
      repeater._itemReadyCb($item, repeater.data[0]);

      expect(linkEl.link).toBe('/blog/best-futons-everyday-sleeping');
    });

    it('wires up See All Posts CTA to /blog', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue(MOCK_POSTS),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const ctaBtn = mockItemEl();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
        '#blogSeeAllPosts': ctaBtn,
      });

      await initBlogTeaserRepeater($w);

      expect(ctaBtn.link).toBe('/blog');
    });

    it('fires blog_teasers_loaded tracking event', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue(MOCK_POSTS),
      }));
      const section = mockSection('blogTeaserSection');
      const repeater = mockRepeater();
      const $w = create$w({
        '#blogTeaserSection': section,
        '#blogTeaserRepeater': repeater,
      });

      await initBlogTeaserRepeater($w);

      expect(trackEvent).toHaveBeenCalledWith(
        'blog_teasers_loaded',
        expect.objectContaining({ location: 'homepage' }),
      );
    });

    it('falls back to HTML container when repeater element is absent', async () => {
      vi.doMock('backend/blogService.web', () => ({  // vi-domock-legacy
        fetchAllBlogPosts: vi.fn().mockResolvedValue(MOCK_POSTS),
      }));
      const section = mockSection('blogTeaserSection');
      const $w = create$w({ '#blogTeaserSection': section });

      await initBlogTeaserRepeater($w);

      // No repeater → falls back to html injection
      expect(typeof section.html).toBe('string');
      expect(section.html).toContain('From Our Blog');
    });
  });
});
