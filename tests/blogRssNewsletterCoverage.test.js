/**
 * Tests for blogNewsletter.web.js and blog-related HTTP functions
 * in http-functions.js. (blogRssFeed.web.js was retired in cf-66ne
 * chunk 3 — its only consumer get_blogRssFeed inlined the logic.)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert } from 'wix-data';

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

// ═══════════════════════════════════════════════════════════════════════
// Additional edge cases (review-agent findings)
// ═══════════════════════════════════════════════════════════════════════

describe('blogNewsletter — dedup allows different slugs', () => {
  beforeEach(() => {
    __reset();
  });

  it('does NOT block notification for a different slug', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'alice@example.com', status: 'active' },
    ]);
    // A different post was already notified
    __seed('EmailQueue', [
      {
        _id: 'eq1',
        templateId: _BLOG_NEWSLETTER_TEMPLATE,
        sequenceType: _SEQUENCE_TYPE,
        variables: { postSlug: 'futon-frame-buying-guide' },
      },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(1);
  });
});

describe('blogNewsletter — getBlogNewsletterStatus error field', () => {
  beforeEach(() => {
    __reset();
  });

  it('returns error field on failure', async () => {
    // Force a query error
    const { __setQueryError } = await import('wix-data');
    __setQueryError('EmailQueue', new Error('DB down'));

    const result = await getBlogNewsletterStatus();
    expect(result.success).toBe(false);
    expect(result.posts).toEqual([]);
    expect(result.error).toBe('DB down');

    __reset();
  });
});

describe('blogNewsletter — previewBlogNewsletter excerpt fallback', () => {
  beforeEach(() => {
    __reset();
  });

  it('returns excerpt when available', async () => {
    const result = await previewBlogNewsletter('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    // The post should have an excerpt or metaDescription
    expect(result.post.excerpt).toBeTruthy();
  });
});

describe('blogNewsletter — subscriber with null email', () => {
  beforeEach(() => {
    __reset();
  });

  it('skips subscribers with null/undefined email', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: null, status: 'active' },
      { _id: 'sub2', status: 'active' },
      { _id: 'sub3', email: 'good@example.com', status: 'active' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(2);
  });
});
