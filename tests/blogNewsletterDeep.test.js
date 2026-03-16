// blogNewsletterDeep.test.js — CF-xr0u: Deep coverage for blogNewsletter.web.js
// Edge cases: blog with no excerpt, missing featured image, duplicate notification
// prevention, subscriber pagination, unsubscribe combinations, email validation.
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert } from 'wix-data';

import {
  notifySubscribersOfNewPost,
  previewBlogNewsletter,
  getBlogNewsletterStatus,
  _BLOG_NEWSLETTER_TEMPLATE,
  _SEQUENCE_TYPE,
  _SITE_URL,
} from 'backend/blogNewsletter.web';

beforeEach(() => {
  __reset();
});

// ── notifySubscribersOfNewPost — slug validation ─────────────────────

describe('notifySubscribersOfNewPost — slug validation', () => {
  it('rejects boolean slug', async () => {
    const result = await notifySubscribersOfNewPost(true);
    expect(result.success).toBe(false);
  });

  it('rejects array slug', async () => {
    const result = await notifySubscribersOfNewPost(['slug']);
    expect(result.success).toBe(false);
  });

  it('rejects object slug', async () => {
    const result = await notifySubscribersOfNewPost({ slug: 'test' });
    expect(result.success).toBe(false);
  });

  it('trims whitespace from slug', async () => {
    // Slug with whitespace should be trimmed; if post exists, should work
    const result = await notifySubscribersOfNewPost('  best-futons-for-everyday-sleeping  ');
    // Should find the post after trimming
    expect(result.success).toBe(true);
    expect(result.queued).toBe(0); // no subscribers
  });

  it('rejects whitespace-only slug after trim', async () => {
    const result = await notifySubscribersOfNewPost('   ');
    expect(result.success).toBe(false);
  });
});

// ── notifySubscribersOfNewPost — duplicate prevention ────────────────

describe('notifySubscribersOfNewPost — duplicate prevention', () => {
  it('blocks re-notification for the same slug', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);
    __seed('EmailQueue', [{
      _id: 'eq1',
      templateId: _BLOG_NEWSLETTER_TEMPLATE,
      sequenceType: _SEQUENCE_TYPE,
      variables: { postSlug: 'best-futons-for-everyday-sleeping' },
    }]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(false);
    expect(result.error).toContain('already notified');
  });

  it('allows notification for different slug', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);
    __seed('EmailQueue', [{
      _id: 'eq1',
      templateId: _BLOG_NEWSLETTER_TEMPLATE,
      sequenceType: _SEQUENCE_TYPE,
      variables: { postSlug: 'futon-frame-buying-guide' },
    }]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(1);
  });

  it('dedup only checks items with matching template + sequenceType', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);
    // EmailQueue item with different template
    __seed('EmailQueue', [{
      _id: 'eq1',
      templateId: 'other_template',
      sequenceType: _SEQUENCE_TYPE,
      variables: { postSlug: 'best-futons-for-everyday-sleeping' },
    }]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(1);
  });

  it('dedup with missing variables field does not crash', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);
    __seed('EmailQueue', [{
      _id: 'eq1',
      templateId: _BLOG_NEWSLETTER_TEMPLATE,
      sequenceType: _SEQUENCE_TYPE,
      // no variables field
    }]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(1);
  });
});

// ── notifySubscribersOfNewPost — email validation ────────────────────

describe('notifySubscribersOfNewPost — email edge cases', () => {
  it('normalizes email to lowercase', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'Alice@Example.COM', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(inserted[0].recipientEmail).toBe('alice@example.com');
    expect(inserted[0].variables.email).toBe('alice@example.com');
  });

  it('trims email whitespace', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: '  alice@example.com  ', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(inserted[0].recipientEmail).toBe('alice@example.com');
  });

  it('skips subscriber with only spaces in email', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: '   ', status: 'active' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('handles mix of valid and invalid emails', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'valid@example.com', status: 'active' },
      { _id: 'sub2', email: 'also-valid@test.org', status: 'active' },
      { _id: 'sub3', email: '@missing-local', status: 'active' },
      { _id: 'sub4', email: 'no-domain@', status: 'active' },
      { _id: 'sub5', email: '', status: 'active' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(2);
    expect(result.skipped).toBe(3);
  });
});

// ── notifySubscribersOfNewPost — unsubscribe combinations ────────────

describe('notifySubscribersOfNewPost — unsubscribe logic', () => {
  it('skips subscriber with "all" unsubscribe', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);
    __seed('Unsubscribes', [
      { _id: 'u1', email: 'test@example.com', sequenceType: 'all' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('skips subscriber with blog_newsletter unsubscribe', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);
    __seed('Unsubscribes', [
      { _id: 'u1', email: 'test@example.com', sequenceType: 'blog_newsletter' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('does NOT skip subscriber with different sequenceType unsubscribe', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);
    __seed('Unsubscribes', [
      { _id: 'u1', email: 'test@example.com', sequenceType: 'promotional' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(1);
  });

  it('handles multiple unsubscribes for same email', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);
    __seed('Unsubscribes', [
      { _id: 'u1', email: 'test@example.com', sequenceType: 'promotional' },
      { _id: 'u2', email: 'test@example.com', sequenceType: 'blog_newsletter' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('unsubscribe for different email does not affect other subscribers', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'alice@example.com', status: 'active' },
      { _id: 'sub2', email: 'bob@example.com', status: 'active' },
    ]);
    __seed('Unsubscribes', [
      { _id: 'u1', email: 'bob@example.com', sequenceType: 'all' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(1);
    expect(result.skipped).toBe(1);
  });
});

// ── notifySubscribersOfNewPost — subscriber status ───────────────────

describe('notifySubscribersOfNewPost — subscriber filtering', () => {
  it('excludes unsubscribed subscribers from CMS query', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'active@test.com', status: 'active' },
      { _id: 'sub2', email: 'gone@test.com', status: 'unsubscribed' },
      { _id: 'sub3', email: 'pending@test.com', status: 'pending' },
    ]);

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    // 'unsubscribed' should be filtered by CMS query (ne status)
    // 'pending' is NOT unsubscribed so should be included
    expect(result.queued).toBe(2); // active + pending
  });

  it('handles subscriber with no contactId', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(inserted[0].recipientContactId).toBe('');
  });

  it('handles subscriber with contactId', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active', contactId: 'cid-123' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(inserted[0].recipientContactId).toBe('cid-123');
  });
});

// ── notifySubscribersOfNewPost — email queue item structure ──────────

describe('notifySubscribersOfNewPost — queue item structure', () => {
  it('sets correct template and sequence fields', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    const item = inserted[0];
    expect(item.templateId).toBe(_BLOG_NEWSLETTER_TEMPLATE);
    expect(item.sequenceType).toBe(_SEQUENCE_TYPE);
    expect(item.sequenceStep).toBe(1);
    expect(item.status).toBe('pending');
    expect(item.attempt).toBe(0);
    expect(item.lastError).toBe('');
  });

  it('includes post URL in variables', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(inserted[0].variables.postUrl).toBe(`${_SITE_URL}/blog/best-futons-for-everyday-sleeping`);
  });

  it('sanitizes post title in variables', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(inserted[0].variables.postTitle).toBeTruthy();
    expect(typeof inserted[0].variables.postTitle).toBe('string');
  });

  it('includes excerpt or metaDescription as postExcerpt', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(inserted[0].variables.postExcerpt).toBeTruthy();
  });

  it('sets scheduledFor and createdAt as Date objects', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'test@example.com', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(inserted[0].scheduledFor).toBeInstanceOf(Date);
    expect(inserted[0].createdAt).toBeInstanceOf(Date);
  });
});

// ── notifySubscribersOfNewPost — multiple subscribers ────────────────

describe('notifySubscribersOfNewPost — batch behavior', () => {
  it('creates one queue item per subscriber', async () => {
    const subs = Array.from({ length: 10 }, (_, i) => ({
      _id: `sub-${i}`,
      email: `user${i}@example.com`,
      status: 'active',
    }));
    __seed('NewsletterSubscribers', subs);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    const result = await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    expect(result.queued).toBe(10);
    expect(inserted.length).toBe(10);
  });

  it('each queue item has unique email', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'alice@example.com', status: 'active' },
      { _id: 'sub2', email: 'bob@example.com', status: 'active' },
      { _id: 'sub3', email: 'carol@example.com', status: 'active' },
    ]);

    const inserted = [];
    __onInsert((coll, item) => {
      if (coll === 'EmailQueue') inserted.push(item);
    });

    await notifySubscribersOfNewPost('best-futons-for-everyday-sleeping');
    const emails = inserted.map(i => i.recipientEmail);
    expect(new Set(emails).size).toBe(3);
  });
});

// ── previewBlogNewsletter — edge cases ───────────────────────────────

describe('previewBlogNewsletter — edge cases', () => {
  it('rejects non-string slug', async () => {
    const result = await previewBlogNewsletter(42);
    expect(result.success).toBe(false);
  });

  it('returns post data with correct URL', async () => {
    const result = await previewBlogNewsletter('best-futons-for-everyday-sleeping');
    expect(result.success).toBe(true);
    expect(result.post.url).toBe(`${_SITE_URL}/blog/best-futons-for-everyday-sleeping`);
  });

  it('returns 0 subscriber count when none exist', async () => {
    const result = await previewBlogNewsletter('best-futons-for-everyday-sleeping');
    expect(result.subscriberCount).toBe(0);
  });

  it('does not count unsubscribed in subscriber count', async () => {
    __seed('NewsletterSubscribers', [
      { _id: 'sub1', email: 'a@b.com', status: 'active' },
      { _id: 'sub2', email: 'c@d.com', status: 'unsubscribed' },
      { _id: 'sub3', email: 'e@f.com', status: 'active' },
    ]);

    const result = await previewBlogNewsletter('best-futons-for-everyday-sleeping');
    expect(result.subscriberCount).toBe(2);
  });

  it('returns post title', async () => {
    const result = await previewBlogNewsletter('best-futons-for-everyday-sleeping');
    expect(result.post.title).toBeTruthy();
    expect(typeof result.post.title).toBe('string');
  });

  it('returns post category', async () => {
    const result = await previewBlogNewsletter('best-futons-for-everyday-sleeping');
    expect(result.post).toHaveProperty('category');
  });

  it('returns post publishDate', async () => {
    const result = await previewBlogNewsletter('best-futons-for-everyday-sleeping');
    expect(result.post).toHaveProperty('publishDate');
  });
});

// ── getBlogNewsletterStatus — edge cases ─────────────────────────────

describe('getBlogNewsletterStatus — edge cases', () => {
  it('returns all posts from blog content', async () => {
    const result = await getBlogNewsletterStatus();
    expect(result.success).toBe(true);
    expect(result.posts.length).toBeGreaterThan(0);
  });

  it('each post has slug, title, and notified fields', async () => {
    const result = await getBlogNewsletterStatus();
    for (const post of result.posts) {
      expect(post).toHaveProperty('slug');
      expect(post).toHaveProperty('title');
      expect(post).toHaveProperty('notified');
      expect(typeof post.notified).toBe('boolean');
    }
  });

  it('posts not in queue are marked notified=false', async () => {
    const result = await getBlogNewsletterStatus();
    expect(result.posts.every(p => p.notified === false)).toBe(true);
  });

  it('multiple notified slugs are tracked correctly', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq1',
        sequenceType: _SEQUENCE_TYPE,
        sequenceStep: 1,
        variables: { postSlug: 'best-futons-for-everyday-sleeping' },
      },
      {
        _id: 'eq2',
        sequenceType: _SEQUENCE_TYPE,
        sequenceStep: 1,
        variables: { postSlug: 'futon-frame-buying-guide' },
      },
    ]);

    const result = await getBlogNewsletterStatus();
    const notifiedPosts = result.posts.filter(p => p.notified);
    expect(notifiedPosts.length).toBe(2);
  });

  it('ignores EmailQueue items with different sequenceType', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq1',
        sequenceType: 'promotional',
        sequenceStep: 1,
        variables: { postSlug: 'best-futons-for-everyday-sleeping' },
      },
    ]);

    const result = await getBlogNewsletterStatus();
    const sleeping = result.posts.find(p => p.slug === 'best-futons-for-everyday-sleeping');
    expect(sleeping).toBeDefined();
    expect(sleeping.notified).toBe(false);
  });

  it('ignores EmailQueue items with different sequenceStep', async () => {
    __seed('EmailQueue', [
      {
        _id: 'eq1',
        sequenceType: _SEQUENCE_TYPE,
        sequenceStep: 2, // not step 1
        variables: { postSlug: 'best-futons-for-everyday-sleeping' },
      },
    ]);

    const result = await getBlogNewsletterStatus();
    const sleeping = result.posts.find(p => p.slug === 'best-futons-for-everyday-sleeping');
    expect(sleeping).toBeDefined();
    expect(sleeping.notified).toBe(false);
  });
});
