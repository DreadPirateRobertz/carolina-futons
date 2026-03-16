/**
 * Tests for blogRssFeed.web.js, blogNewsletter.web.js,
 * and blog-related HTTP functions in http-functions.js
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert } from 'wix-data';

// ── blogRssFeed.web.js ─────────────────────────────────────────────
import {
  generateBlogRssFeed,
  _buildRssXml,
  _FEED_TITLE,
  _FEED_DESCRIPTION,
  _SITE_URL,
} from 'backend/blogRssFeed.web';

// ── blogNewsletter.web.js ───────────────────────────────────────────
import {
  notifySubscribersOfNewPost,
  previewBlogNewsletter,
  getBlogNewsletterStatus,
  _BLOG_NEWSLETTER_TEMPLATE,
  _SEQUENCE_TYPE,
} from 'backend/blogNewsletter.web';

// ── HTTP functions ──────────────────────────────────────────────────
import {
  get_blogSitemap,
  get_blogRssFeed,
  get_productSitemap,
} from 'backend/http-functions';

// ═══════════════════════════════════════════════════════════════════════
// blogRssFeed.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('blogRssFeed — generateBlogRssFeed', () => {
  it('returns success with XML', async () => {
    const result = await generateBlogRssFeed();
    expect(result.success).toBe(true);
    expect(result.xml).toBeDefined();
    expect(result.xml).toContain('<?xml version="1.0"');
    expect(result.xml).toContain('<rss version="2.0"');
  });

  it('contains channel metadata', async () => {
    const result = await generateBlogRssFeed();
    expect(result.xml).toContain(`<title>${_FEED_TITLE}</title>`);
    expect(result.xml).toContain('<link>https://www.carolinafutons.com/blog</link>');
    expect(result.xml).toContain('<language>en-us</language>');
    expect(result.xml).toContain('<ttl>1440</ttl>');
  });

  it('contains atom self-link', async () => {
    const result = await generateBlogRssFeed();
    expect(result.xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(result.xml).toContain('/_functions/blogRssFeed');
    expect(result.xml).toContain('type="application/rss+xml"');
  });

  it('includes blog post items', async () => {
    const result = await generateBlogRssFeed();
    expect(result.xml).toContain('<item>');
    expect(result.xml).toContain('<guid isPermaLink="true">');
  });

  it('includes post title, link, description', async () => {
    const result = await generateBlogRssFeed();
    // Should contain at least one known blog post
    expect(result.xml).toContain('/blog/');
    expect(result.xml).toContain('<title>');
    expect(result.xml).toContain('<description>');
  });

  it('includes pubDate for posts with publishDate', async () => {
    const result = await generateBlogRssFeed();
    expect(result.xml).toContain('<pubDate>');
  });

  it('includes category tags', async () => {
    const result = await generateBlogRssFeed();
    expect(result.xml).toContain('<category>');
  });

  it('sorts posts by publishDate descending', async () => {
    const result = await generateBlogRssFeed();
    const items = result.xml.match(/<pubDate>[^<]+<\/pubDate>/g);
    if (items && items.length >= 2) {
      const dates = items.map(m => new Date(m.replace(/<\/?pubDate>/g, '')));
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i - 1].getTime()).toBeGreaterThanOrEqual(dates[i].getTime());
      }
    }
  });

  it('escapes XML special characters in title', async () => {
    const result = await generateBlogRssFeed();
    // The XML should not contain raw unescaped & in content
    // (check that escapeXml is being applied)
    expect(result.xml).not.toMatch(/<title>[^<]*&[^a][^<]*<\/title>/);
  });
});

describe('blogRssFeed — _buildRssXml', () => {
  it('generates valid RSS for empty array', () => {
    const xml = _buildRssXml([]);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
    expect(xml).not.toContain('<item>');
  });

  it('generates items for posts', () => {
    const posts = [
      {
        slug: 'test-post',
        title: 'Test Post',
        excerpt: 'A test excerpt',
        category: 'guides',
        tags: ['futons', 'buying'],
        publishDate: '2026-01-15',
      },
    ];
    const xml = _buildRssXml(posts);
    expect(xml).toContain('<item>');
    expect(xml).toContain('<title>Test Post</title>');
    expect(xml).toContain('/blog/test-post</link>');
    expect(xml).toContain('<description>A test excerpt</description>');
    expect(xml).toContain('<category>guides</category>');
    expect(xml).toContain('<category>futons</category>');
    expect(xml).toContain('<category>buying</category>');
    expect(xml).toContain('<pubDate>');
  });

  it('uses metaDescription as fallback for excerpt', () => {
    const posts = [{ slug: 'x', title: 'X', metaDescription: 'Meta desc', publishDate: '2026-01-01' }];
    const xml = _buildRssXml(posts);
    expect(xml).toContain('<description>Meta desc</description>');
  });

  it('handles post without publishDate', () => {
    const posts = [{ slug: 'no-date', title: 'No Date' }];
    const xml = _buildRssXml(posts);
    expect(xml).toContain('<title>No Date</title>');
    expect(xml).not.toContain('<pubDate>');
  });

  it('handles post without category', () => {
    const posts = [{ slug: 'no-cat', title: 'No Cat', publishDate: '2026-01-01' }];
    const xml = _buildRssXml(posts);
    expect(xml).toContain('<title>No Cat</title>');
    // Should not have a category element for this post
    const itemXml = xml.split('<item>')[1].split('</item>')[0];
    expect(itemXml).not.toContain('<category>');
  });

  it('handles post without tags', () => {
    const posts = [{ slug: 'no-tags', title: 'No Tags', category: 'cat1', publishDate: '2026-01-01' }];
    const xml = _buildRssXml(posts);
    // Should only have category from the category field, not from tags
    const itemXml = xml.split('<item>')[1].split('</item>')[0];
    const categories = itemXml.match(/<category>/g) || [];
    expect(categories.length).toBe(1);
  });

  it('escapes XML in all fields', () => {
    const posts = [{
      slug: 'test-amp',
      title: 'Futon & More <Sale>',
      excerpt: 'Save "big" with <strong>deals</strong>',
      category: 'R&D',
      tags: ['a&b'],
      publishDate: '2026-01-01',
    }];
    const xml = _buildRssXml(posts);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).not.toContain('<Sale>');
    expect(xml).not.toContain('<strong>');
  });

  it('sets lastBuildDate from first post', () => {
    const posts = [
      { slug: 'a', title: 'A', publishDate: '2026-03-10' },
      { slug: 'b', title: 'B', publishDate: '2026-01-01' },
    ];
    const xml = _buildRssXml(posts);
    expect(xml).toContain('<lastBuildDate>');
    // The lastBuildDate should correspond to the first post's date
    const lastBuild = xml.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)[1];
    expect(new Date(lastBuild).getFullYear()).toBe(2026);
  });

  it('uses current date for lastBuildDate when no posts', () => {
    const xml = _buildRssXml([]);
    const lastBuild = xml.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)[1];
    const d = new Date(lastBuild);
    expect(d.getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  it('generates guid as permalink', () => {
    const posts = [{ slug: 'guid-test', title: 'G', publishDate: '2026-01-01' }];
    const xml = _buildRssXml(posts);
    expect(xml).toContain('<guid isPermaLink="true">https://www.carolinafutons.com/blog/guid-test</guid>');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// blogNewsletter.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('blogNewsletter — notifySubscribersOfNewPost', () => {
  beforeEach(() => {
    __reset();
  });

  it('rejects null slug', async () => {
    const result = await notifySubscribersOfNewPost(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Slug is required');
  });

  it('rejects empty string slug', async () => {
    const result = await notifySubscribersOfNewPost('');
    expect(result.success).toBe(false);
  });

  it('rejects non-string slug', async () => {
    const result = await notifySubscribersOfNewPost(123);
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent post', async () => {
    const result = await notifySubscribersOfNewPost('nonexistent-slug');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns success with 0 queued when no subscribers', async () => {
    // Use a real blog post slug
    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('queues emails for active subscribers', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'alice@example.com', status: 'active' },
      { _id: 'sub2', email: 'bob@example.com', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(2);
    expect(result.skipped).toBe(0);
    expect(inserted.length).toBe(2);
    expect(inserted[0].templateId).toBe(_BLOG_NEWSLETTER_TEMPLATE);
    expect(inserted[0].sequenceType).toBe(_SEQUENCE_TYPE);
    expect(inserted[0].variables.postSlug).toBe('best-futons-for-everyday-sleeping');
    expect(inserted[0].variables.postUrl).toContain('/blog/best-futons-for-everyday-sleeping');
  });

  it('skips unsubscribed subscribers', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'alice@example.com', status: 'active' },
    ]);
    __seed('Unsubscribes', [
      { _id: 'unsub1', email: 'alice@example.com', sequenceType: 'all' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips subscribers unsubscribed from blog_newsletter', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'alice@example.com', status: 'active' },
    ]);
    __seed('Unsubscribes', [
      { _id: 'unsub1', email: 'alice@example.com', sequenceType: 'blog_newsletter' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips invalid emails', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'not-an-email', status: 'active' },
      { _id: 'sub2', email: '', status: 'active' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(2);
  });

  it('prevents duplicate notifications for same post', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'alice@example.com', status: 'active' },
    ]);
    __seed('EmailQueue', [
      {
        _id: 'eq1',
        templateId: _BLOG_NEWSLETTER_TEMPLATE,
        sequenceType: _SEQUENCE_TYPE,
        variables: { postSlug: 'best-futons-for-everyday-sleeping' },
      },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already notified');
  });

  it('excludes unsubscribed subscribers from CMS query', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'active@example.com', status: 'active' },
      { _id: 'sub2', email: 'gone@example.com', status: 'unsubscribed' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(1);
  });

  it('populates email queue item correctly', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'Test@Example.COM', status: 'active', contactId: 'cid1' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(inserted.length).toBe(1);

    const item = inserted[0];
    expect(item.recipientEmail).toBe('test@example.com');
    expect(item.recipientContactId).toBe('cid1');
    expect(item.status).toBe('pending');
    expect(item.sequenceStep).toBe(1);
    expect(item.attempt).toBe(0);
    expect(item.variables.postTitle).toBeTruthy();
    expect(item.variables.email).toBe('test@example.com');
    expect(item.scheduledFor).toBeInstanceOf(Date);
    expect(item.createdAt).toBeInstanceOf(Date);
  });
});

describe('blogNewsletter — previewBlogNewsletter', () => {
  beforeEach(() => {
    __reset();
  });

  it('rejects null slug', async () => {
    const result = await previewBlogNewsletter(null);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Slug is required');
  });

  it('rejects empty string', async () => {
    const result = await previewBlogNewsletter('');
    expect(result.success).toBe(false);
  });

  it('returns error for non-existent post', async () => {
    const result = await previewBlogNewsletter('nonexistent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('returns post preview with subscriber count', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'a@b.com', status: 'active' },
      { _id: 'sub2', email: 'c@d.com', status: 'active' },
    ]);

    const result = await previewBlogNewsletter('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    expect(result.post.title).toBeTruthy();
    expect(result.post.url).toContain('/blog/best-futons-for-everyday-sleeping');
    expect(result.subscriberCount).toBe(2);
  });

  it('excludes unsubscribed from count', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'a@b.com', status: 'active' },
      { _id: 'sub2', email: 'c@d.com', status: 'unsubscribed' },
    ]);

    const result = await previewBlogNewsletter('best-futons-for-everyday-sleeping');
    expect(result.subscriberCount).toBe(1);
  });
});

describe('blogNewsletter — getBlogNewsletterStatus', () => {
  beforeEach(() => {
    __reset();
  });

  it('returns all posts with notified=false when no emails sent', async () => {
    const result = await getBlogNewsletterStatus();
    expect(result.success).toBe(true);
    expect(result.posts.length).toBeGreaterThan(0);
    expect(result.posts.every(p => p.notified === false)).toBe(true);
  });

  it('marks posts as notified when in EmailQueue', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq1',
        sequenceType: _SEQUENCE_TYPE,
        sequenceStep: 1,
        variables: { postSlug: 'best-futons-for-everyday-sleeping' },
      },
    ]);

    const result = await getBlogNewsletterStatus();
    const notified = result.posts.find(p => p.slug === 'best-futons-for-everyday-sleeping');
    expect(notified.notified).toBe(true);

    const other = result.posts.find(p => p.slug !== 'best-futons-for-everyday-sleeping');
    if (other) expect(other.notified).toBe(false);
  });

  it('returns slug, title, and publishDate for each post', async () => {
    const result = await getBlogNewsletterStatus();
    for (const post of result.posts) {
      expect(post.slug).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(post).toHaveProperty('notified');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// HTTP Functions — blog sitemap & RSS feed
// ═══════════════════════════════════════════════════════════════════════

describe('http-functions — get_blogSitemap', () => {
  it('returns 200 with XML content-type', async () => {
    const response = await get_blogSitemap();
    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toContain('application/xml');
  });

  it('contains blog index at priority 0.7', async () => {
    const response = await get_blogSitemap();
    expect(response.body).toContain('<priority>0.7</priority>');
    expect(response.body).toContain('/blog</loc>');
  });

  it('contains blog post URLs at priority 0.7', async () => {
    const response = await get_blogSitemap();
    // Blog posts should now be at 0.7 (upgraded from 0.6)
    const postEntries = response.body.split('<url>').slice(2); // skip header + blog index
    for (const entry of postEntries) {
      if (entry.includes('/blog/')) {
        expect(entry).toContain('<priority>0.7</priority>');
      }
    }
  });

  it('includes lastmod for posts with publishDate', async () => {
    const response = await get_blogSitemap();
    expect(response.body).toContain('<lastmod>');
  });

  it('uses XML escaping', async () => {
    const response = await get_blogSitemap();
    expect(response.body).toContain('<?xml version="1.0"');
    expect(response.body).toContain('<urlset xmlns=');
    expect(response.body).toContain('</urlset>');
  });

  it('sets Cache-Control header', async () => {
    const response = await get_blogSitemap();
    expect(response.headers['Cache-Control']).toContain('public');
    expect(response.headers['Cache-Control']).toContain('max-age=3600');
  });
});

describe('http-functions — get_blogRssFeed', () => {
  it('returns 200 with RSS content-type', async () => {
    const response = await get_blogRssFeed();
    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toContain('application/rss+xml');
  });

  it('returns valid RSS XML', async () => {
    const response = await get_blogRssFeed();
    expect(response.body).toContain('<?xml version="1.0"');
    expect(response.body).toContain('<rss version="2.0"');
    expect(response.body).toContain('</rss>');
  });

  it('contains channel info', async () => {
    const response = await get_blogRssFeed();
    expect(response.body).toContain('<title>Carolina Futons Blog</title>');
    expect(response.body).toContain('<language>en-us</language>');
  });

  it('contains blog post items', async () => {
    const response = await get_blogRssFeed();
    expect(response.body).toContain('<item>');
    expect(response.body).toContain('</item>');
  });

  it('sets Cache-Control header', async () => {
    const response = await get_blogRssFeed();
    expect(response.headers['Cache-Control']).toContain('public');
    expect(response.headers['Cache-Control']).toContain('max-age=3600');
  });
});

describe('http-functions — get_productSitemap blog priorities', () => {
  beforeEach(() => {
    __reset();
    // Seed empty products so the sitemap can render
    __seed('Stores/Products', []);
  });

  it('has blog URLs at priority 0.7', async () => {
    const response = await get_productSitemap();
    expect(response.status).toBe(200);
    // Find blog entries in the sitemap body
    const blogEntries = response.body.split('<url>').filter(entry => entry.includes('/blog'));
    expect(blogEntries.length).toBeGreaterThan(0);
    for (const entry of blogEntries) {
      expect(entry).toContain('<priority>0.7</priority>');
    }
  });
});
