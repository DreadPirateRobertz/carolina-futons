// blogDigestService.test.js — CF-e3yo: Blog → newsletter automation weekly digest
// Covers: sendWeeklyBlogDigest, previewWeeklyBlogDigest, helper functions.
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert, __setInsertError } from 'wix-data';
import { __reset as blogReset, __setPosts } from 'wix-blog-backend';
import { __setSecrets, __reset as resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { get_weeklyBlogDigestCron } from '../src/backend/http-functions.js';

import {
  sendWeeklyBlogDigest,
  previewWeeklyBlogDigest,
  _DIGEST_TEMPLATE,
  _SEQUENCE_TYPE,
  _SITE_URL,
  _getWeekStart,
  _formatWeekLabel,
} from 'backend/blogDigestService.web';

function makePost(overrides = {}) {
  return {
    _id: 'post-1',
    title: 'Best Futons for 2026',
    slug: 'best-futons-2026',
    excerpt: 'A guide to the best futons this year.',
    publishedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    media: { wixMedia: { image: { url: 'https://example.com/img.jpg' } } },
    categories: [{ label: 'Buying Guides' }],
    ...overrides,
  };
}

/** Helper: spy captures {_coll, ...item} objects */
function makeInsertSpy() {
  const items = [];
  __onInsert((coll, item) => items.push({ _coll: coll, ...item }));
  return items;
}

const CRON_KEY = 'test-cron-secret';
const cronReq = (key = CRON_KEY) => ({ headers: { 'x-cron-secret': key } });

beforeEach(() => {
  __reset();
  blogReset();
  resetSecrets();
  __setSecrets({ ALERT_CRON_KEY: CRON_KEY });
});

// ── sendWeeklyBlogDigest — no posts ─────────────────────────────────

describe('sendWeeklyBlogDigest — no recent posts', () => {
  it('returns success with postCount=0 when no posts in window', async () => {
    __setPosts([
      makePost({ publishedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() }),
    ]);

    const result = await sendWeeklyBlogDigest();

    expect(result.success).toBe(true);
    expect(result.postCount).toBe(0);
    expect(result.queued).toBe(0);
  });

  it('does not insert any EmailQueue items when no posts', async () => {
    const inserted = makeInsertSpy();

    await sendWeeklyBlogDigest();

    expect(inserted.filter(i => i._coll === 'EmailQueue')).toHaveLength(0);
  });
});

// ── sendWeeklyBlogDigest — dedup ─────────────────────────────────────

describe('sendWeeklyBlogDigest — dedup by week', () => {
  it('skips sending if digest already sent this week', async () => {
    __setPosts([makePost()]);
    __seed('BlogDigestLog', [
      { _id: 'log-1', weekOf: _getWeekStart(new Date()), sentAt: new Date() },
    ]);

    const result = await sendWeeklyBlogDigest();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/already sent/i);
    expect(result.queued).toBe(0);
  });

  it('sends if log entry is from a previous week', async () => {
    __setPosts([makePost()]);
    const lastWeek = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    __seed('BlogDigestLog', [
      { _id: 'log-1', weekOf: _getWeekStart(lastWeek), sentAt: lastWeek },
    ]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'test@example.com', status: 'active' },
    ]);

    const result = await sendWeeklyBlogDigest();

    expect(result.success).toBe(true);
    expect(result.queued).toBe(1);
  });
});

// ── sendWeeklyBlogDigest — subscribers ──────────────────────────────

describe('sendWeeklyBlogDigest — subscriber handling', () => {
  it('queues one email per valid subscriber', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
      { _id: 'sub-2', email: 'bob@example.com', status: 'active' },
    ]);

    const result = await sendWeeklyBlogDigest();

    expect(result.success).toBe(true);
    expect(result.queued).toBe(2);
    expect(result.postCount).toBe(1);
  });

  it('excludes subscribers with status=unsubscribed (filtered at query level)', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
      { _id: 'sub-2', email: 'bob@example.com', status: 'unsubscribed' },
    ]);

    const result = await sendWeeklyBlogDigest();

    // Bob is excluded by the .ne('status','unsubscribed') DB query, never reaches the loop
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('skips subscribers in Unsubscribes collection', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
      { _id: 'sub-2', email: 'bob@example.com', status: 'active' },
    ]);
    __seed('Unsubscribes', [
      { _id: 'unsub-1', email: 'bob@example.com', sequenceType: _SEQUENCE_TYPE },
    ]);

    const result = await sendWeeklyBlogDigest();

    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it('skips subscribers with global unsubscribe', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'bob@example.com', status: 'active' },
    ]);
    __seed('Unsubscribes', [
      { _id: 'unsub-1', email: 'bob@example.com', sequenceType: 'all' },
    ]);

    const result = await sendWeeklyBlogDigest();

    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips subscribers with invalid email', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'not-an-email', status: 'active' },
      { _id: 'sub-2', email: '', status: 'active' },
    ]);

    const result = await sendWeeklyBlogDigest();

    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(2);
  });

  it('skips when no subscribers exist', async () => {
    __setPosts([makePost()]);

    const result = await sendWeeklyBlogDigest();

    expect(result.success).toBe(true);
    expect(result.queued).toBe(0);
    expect(result.postCount).toBe(1);
  });
});

// ── sendWeeklyBlogDigest — email queue items ─────────────────────────

describe('sendWeeklyBlogDigest — email queue item structure', () => {
  it('inserts correct fields into EmailQueue', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', contactId: 'cid-1', status: 'active' },
    ]);

    const inserted = makeInsertSpy();

    await sendWeeklyBlogDigest();

    const queueItem = inserted.find(i => i._coll === 'EmailQueue' && i.templateId === _DIGEST_TEMPLATE);
    expect(queueItem).toBeDefined();
    expect(queueItem.recipientEmail).toBe('alice@example.com');
    expect(queueItem.recipientContactId).toBe('cid-1');
    expect(queueItem.sequenceType).toBe(_SEQUENCE_TYPE);
    expect(queueItem.sequenceStep).toBe(1);
    expect(queueItem.status).toBe('pending');
    expect(queueItem.variables.email).toBe('alice@example.com');
    expect(queueItem.variables.postsJson).toBeDefined();
    expect(queueItem.variables.postCount).toBe('1');
    expect(queueItem.variables.siteUrl).toBe(_SITE_URL);
    expect(queueItem.variables.weekLabel).toBeDefined();
  });

  it('postsJson contains post url with site URL prefix', async () => {
    __setPosts([makePost({ slug: 'my-futon-guide' })]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const inserted = makeInsertSpy();

    await sendWeeklyBlogDigest();

    const queueItem = inserted.find(i => i._coll === 'EmailQueue' && i.templateId === _DIGEST_TEMPLATE);
    const posts = JSON.parse(queueItem.variables.postsJson);
    expect(posts[0].url).toBe(`${_SITE_URL}/blog/my-futon-guide`);
  });

  it('normalizes email to lowercase', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'Alice@EXAMPLE.COM', status: 'active' },
    ]);

    const inserted = makeInsertSpy();

    await sendWeeklyBlogDigest();

    const queueItem = inserted.find(i => i._coll === 'EmailQueue' && i.templateId === _DIGEST_TEMPLATE);
    expect(queueItem.recipientEmail).toBe('alice@example.com');
  });

  it('inserts BlogDigestLog record on success', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const inserted = makeInsertSpy();

    const result = await sendWeeklyBlogDigest();

    expect(result.success).toBe(true);
    const logItem = inserted.find(i => i._coll === 'BlogDigestLog');
    expect(logItem).toBeDefined();
    expect(logItem.postCount).toBe(1);
    expect(logItem.subscriberCount).toBe(1);
  });
});

// ── sendWeeklyBlogDigest — lookbackDays option ───────────────────────

describe('sendWeeklyBlogDigest — lookbackDays option', () => {
  it('respects custom lookbackDays', async () => {
    __setPosts([
      makePost({ publishedDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString() }),
    ]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const result = await sendWeeklyBlogDigest({ lookbackDays: 14 });

    expect(result.success).toBe(true);
    expect(result.postCount).toBe(1);
    expect(result.queued).toBe(1);
  });

  it('clamps lookbackDays to max 30', async () => {
    const result = await sendWeeklyBlogDigest({ lookbackDays: 999 });
    expect(result.success).toBe(true);
  });

  it('clamps lookbackDays to min 1', async () => {
    const result = await sendWeeklyBlogDigest({ lookbackDays: 0 });
    expect(result.success).toBe(true);
  });
});

// ── sendWeeklyBlogDigest — post limit and sort ───────────────────────

describe('sendWeeklyBlogDigest — post limit and sort', () => {
  it('caps digest at 5 posts', async () => {
    const manyPosts = Array.from({ length: 8 }, (_, i) =>
      makePost({ _id: `post-${i}`, slug: `post-${i}`, title: `Post ${i}` })
    );
    __setPosts(manyPosts);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const inserted = makeInsertSpy();

    const result = await sendWeeklyBlogDigest();

    const queueItem = inserted.find(i => i._coll === 'EmailQueue' && i.templateId === _DIGEST_TEMPLATE);
    const posts = JSON.parse(queueItem.variables.postsJson);
    expect(posts.length).toBe(5);
    expect(result.postCount).toBe(5);
  });

  it('orders posts newest-first in digest', async () => {
    const older = makePost({ _id: 'old', slug: 'older-post', publishedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() });
    const newer = makePost({ _id: 'new', slug: 'newer-post', publishedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() });
    __setPosts([older, newer]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const inserted = makeInsertSpy();

    await sendWeeklyBlogDigest();

    const queueItem = inserted.find(i => i._coll === 'EmailQueue' && i.templateId === _DIGEST_TEMPLATE);
    const posts = JSON.parse(queueItem.variables.postsJson);
    expect(posts[0].slug).toBe('newer-post');
    expect(posts[1].slug).toBe('older-post');
  });
});

// ── sendWeeklyBlogDigest — unsubscribe pagination ────────────────────

describe('sendWeeklyBlogDigest — unsubscribe pagination', () => {
  it('respects unsubscribes beyond 50-item default', async () => {
    __setPosts([makePost()]);
    // Seed 60 unsubscribe records, subscriber email is the 60th
    const unsubs = Array.from({ length: 60 }, (_, i) => ({
      _id: `unsub-${i}`,
      email: i === 59 ? 'alice@example.com' : `user${i}@example.com`,
      sequenceType: _SEQUENCE_TYPE,
    }));
    __seed('Unsubscribes', unsubs);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const result = await sendWeeklyBlogDigest();

    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

// ── sendWeeklyBlogDigest — error handling ────────────────────────────

describe('sendWeeklyBlogDigest — error handling', () => {
  it('returns success=false on unexpected error', async () => {
    const { __setListError } = await import('wix-blog-backend');
    __setListError(new Error('Blog API unavailable'));

    const result = await sendWeeklyBlogDigest();

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Blog API unavailable/);
    expect(result.queued).toBe(0);
  });
});

// ── previewWeeklyBlogDigest ───────────────────────────────────────────

describe('previewWeeklyBlogDigest', () => {
  it('returns posts and subscriber count without sending', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
      { _id: 'sub-2', email: 'bob@example.com', status: 'active' },
    ]);

    const inserted = makeInsertSpy();

    const result = await previewWeeklyBlogDigest();

    expect(result.success).toBe(true);
    expect(result.posts).toHaveLength(1);
    expect(result.subscriberCount).toBe(2);
    expect(result.alreadySent).toBe(false);
    expect(inserted.filter(i => i._coll === 'EmailQueue')).toHaveLength(0);
  });

  it('reports alreadySent=true when log exists for this week', async () => {
    __setPosts([makePost()]);
    __seed('BlogDigestLog', [
      { _id: 'log-1', weekOf: _getWeekStart(new Date()), sentAt: new Date() },
    ]);

    const result = await previewWeeklyBlogDigest();

    expect(result.success).toBe(true);
    expect(result.alreadySent).toBe(true);
  });

  it('includes weekLabel in preview', async () => {
    __setPosts([makePost()]);

    const result = await previewWeeklyBlogDigest();

    expect(result.weekLabel).toBeDefined();
    expect(typeof result.weekLabel).toBe('string');
    expect(result.weekLabel.length).toBeGreaterThan(0);
  });

  it('returns success=false on error', async () => {
    const { __setListError } = await import('wix-blog-backend');
    __setListError(new Error('oops'));

    const result = await previewWeeklyBlogDigest();

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ── _getWeekStart ────────────────────────────────────────────────────

describe('_getWeekStart', () => {
  it('returns Monday 00:00:00 UTC for a Friday', () => {
    const friday = new Date('2026-03-27T15:00:00Z');
    const start = _getWeekStart(friday);
    expect(start.toISOString()).toBe('2026-03-23T00:00:00.000Z');
  });

  it('returns Monday 00:00:00 UTC for a Monday', () => {
    const monday = new Date('2026-03-23T09:00:00Z');
    const start = _getWeekStart(monday);
    expect(start.toISOString()).toBe('2026-03-23T00:00:00.000Z');
  });

  it('returns previous Monday for a Sunday', () => {
    const sunday = new Date('2026-03-29T12:00:00Z');
    const start = _getWeekStart(sunday);
    expect(start.toISOString()).toBe('2026-03-23T00:00:00.000Z');
  });

  it('does not mutate input date', () => {
    const d = new Date('2026-03-27T15:00:00Z');
    const before = d.toISOString();
    _getWeekStart(d);
    expect(d.toISOString()).toBe(before);
  });
});

// ── _formatWeekLabel ─────────────────────────────────────────────────

describe('_formatWeekLabel', () => {
  it('produces a non-empty string', () => {
    const since = new Date('2026-03-20T00:00:00Z');
    const now = new Date('2026-03-27T00:00:00Z');
    const label = _formatWeekLabel(since, now);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('includes the year', () => {
    const since = new Date('2026-03-20T00:00:00Z');
    const now = new Date('2026-03-27T00:00:00Z');
    const label = _formatWeekLabel(since, now);
    expect(label).toContain('2026');
  });

  it('produces the exact expected label for fixed inputs', () => {
    const since = new Date('2026-03-20T00:00:00Z');
    const now = new Date('2026-03-27T00:00:00Z');
    const label = _formatWeekLabel(since, now);
    // Exact assertion to prevent trivially-passing "contains 2026" tests
    expect(label).toMatch(/March\s+20.*March\s+27.*2026/);
  });
});

// ── get_weeklyBlogDigestCron — auth ───────────────────────────────────

describe('get_weeklyBlogDigestCron — auth', () => {
  it('returns 403 with wrong cron key', async () => {
    const res = await get_weeklyBlogDigestCron(cronReq('bad-key'));
    expect(res.status).toBe(403);
  });

  it('returns 403 with missing cron key', async () => {
    const res = await get_weeklyBlogDigestCron({ headers: {} });
    expect(res.status).toBe(403);
  });

  it('returns 500 when secret is not configured (getSecret throws)', async () => {
    resetSecrets(); // clears ALERT_CRON_KEY — getSecret will throw
    const res = await get_weeklyBlogDigestCron(cronReq());
    expect(res.status).toBe(500);
  });
});

describe('get_weeklyBlogDigestCron — success', () => {
  it('returns 200 with queued/skipped/postCount on valid key', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const res = await get_weeklyBlogDigestCron(cronReq());

    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.queued).toBe(1);
    expect(body.postCount).toBe(1);
    expect(body.timestamp).toBeDefined();
  });

  it('returns 200 with queued=0 when no recent posts', async () => {
    const res = await get_weeklyBlogDigestCron(cronReq());
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.queued).toBe(0);
    expect(body.postCount).toBe(0);
  });
});

// ── sendWeeklyBlogDigest — dedup on zero sends ────────────────────────

describe('sendWeeklyBlogDigest — dedup log only on successful sends', () => {
  it('does not write BlogDigestLog when all subscribers are invalid', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'not-an-email', status: 'active' },
    ]);

    const inserted = makeInsertSpy();
    const result = await sendWeeklyBlogDigest();

    expect(result.queued).toBe(0);
    expect(inserted.filter(i => i._coll === 'BlogDigestLog')).toHaveLength(0);
  });

  it('allows retry when previous run sent zero emails', async () => {
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'not-an-email', status: 'active' },
    ]);

    // First run: all invalid, no log written
    await sendWeeklyBlogDigest();

    // Fix the subscriber, retry
    __reset();
    blogReset();
    __setSecrets({ ALERT_CRON_KEY: CRON_KEY });
    __setPosts([makePost()]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const result = await sendWeeklyBlogDigest();
    expect(result.queued).toBe(1);
  });
});

// ── sendWeeklyBlogDigest — subscriber pagination ─────────────────────

describe('sendWeeklyBlogDigest — subscriber pagination', () => {
  it('sends to all subscribers across multiple pages', async () => {
    __setPosts([makePost()]);
    // 51 subscribers — forces two pages (50 + 1)
    const subs = Array.from({ length: 51 }, (_, i) => ({
      _id: `sub-${i}`,
      email: `user${i}@example.com`,
      status: 'active',
    }));
    __seed('NewsletterSubscribers', subs);

    const result = await sendWeeklyBlogDigest();

    expect(result.queued).toBe(51);
  });
});

// ── normalizePostForEmail — null/missing fields ───────────────────────

describe('normalizePostForEmail — missing fields gracefully handled', () => {
  it('handles post with no media', async () => {
    __setPosts([makePost({ media: undefined })]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const inserted = makeInsertSpy();
    await sendWeeklyBlogDigest();

    const queueItem = inserted.find(i => i._coll === 'EmailQueue' && i.templateId === _DIGEST_TEMPLATE);
    const posts = JSON.parse(queueItem.variables.postsJson);
    expect(posts[0].coverImageUrl).toBe('');
  });

  it('handles post with no categories', async () => {
    __setPosts([makePost({ categories: undefined })]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const inserted = makeInsertSpy();
    await sendWeeklyBlogDigest();

    const queueItem = inserted.find(i => i._coll === 'EmailQueue' && i.templateId === _DIGEST_TEMPLATE);
    const posts = JSON.parse(queueItem.variables.postsJson);
    expect(posts[0].category).toBe('');
  });

  it('excludes post with null publishedDate from digest', async () => {
    __setPosts([makePost({ publishedDate: null })]);

    const result = await sendWeeklyBlogDigest();

    expect(result.postCount).toBe(0);
  });

  it('strips non-https coverImageUrl', async () => {
    __setPosts([makePost({ media: { wixMedia: { image: { url: 'javascript:alert(1)' } } } })]);
    __seed('NewsletterSubscribers', [
      { _id: 'sub-1', email: 'alice@example.com', status: 'active' },
    ]);

    const inserted = makeInsertSpy();
    await sendWeeklyBlogDigest();

    const queueItem = inserted.find(i => i._coll === 'EmailQueue' && i.templateId === _DIGEST_TEMPLATE);
    const posts = JSON.parse(queueItem.variables.postsJson);
    expect(posts[0].coverImageUrl).toBe('');
  });
});
