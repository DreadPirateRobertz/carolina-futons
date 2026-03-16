/**
 * @module blogNewsletter
 * @description Blog-to-newsletter integration. When a new blog post is published,
 * queues a newsletter email to all active subscribers with the post summary.
 * Uses the existing EmailQueue infrastructure from emailAutomation.web.js.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/blogContent
 * @requires backend/utils/sanitize
 *
 * @setup
 * 1. Create triggered email template 'blog_newsletter' in Dashboard > Marketing
 *    with variables: postTitle, postExcerpt, postUrl, postCategory, email
 * 2. Call notifySubscribersOfNewPost() after publishing a new blog post.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { getBlogPost, getAllBlogPosts } from 'backend/blogContent';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const BLOG_NEWSLETTER_TEMPLATE = 'blog_newsletter';
const SEQUENCE_TYPE = 'blog_newsletter';

/**
 * Queue newsletter emails to all active subscribers for a new blog post.
 *
 * @function notifySubscribersOfNewPost
 * @param {string} slug - Blog post slug from blogContent.js
 * @returns {Promise<{success: boolean, queued: number, skipped: number, error?: string}>}
 * @permission Admin
 */
export const notifySubscribersOfNewPost = webMethod(
  Permissions.Admin,
  async (slug) => {
    try {
      if (!slug || typeof slug !== 'string') {
        return { success: false, queued: 0, skipped: 0, error: 'Slug is required' };
      }

      const cleanSlug = sanitize(slug.trim(), 200);
      const post = getBlogPost(cleanSlug);

      if (!post) {
        return { success: false, queued: 0, skipped: 0, error: 'Blog post not found' };
      }

      // Check for duplicate: don't re-notify for the same post
      const alreadySent = await wixData.query('EmailQueue')
        .eq('sequenceType', SEQUENCE_TYPE)
        .eq('templateId', BLOG_NEWSLETTER_TEMPLATE)
        .find();

      const alreadyNotified = alreadySent.items.some(
        item => item.variables?.postSlug === cleanSlug
      );

      if (alreadyNotified) {
        return { success: false, queued: 0, skipped: 0, error: 'Subscribers already notified for this post' };
      }

      // Fetch all active newsletter subscribers
      const subscribers = await fetchActiveSubscribers();

      if (subscribers.length === 0) {
        return { success: true, queued: 0, skipped: 0 };
      }

      const postUrl = `${SITE_URL}/blog/${cleanSlug}`;
      let queued = 0;
      let skipped = 0;

      // Pre-fetch all unsubscribes to avoid N+1 queries in the subscriber loop
      const allUnsubs = await wixData.query('Unsubscribes')
        .hasSome('sequenceType', ['all', SEQUENCE_TYPE])
        .find();
      const unsubEmails = new Set(allUnsubs.items.map(u => u.email));

      for (const sub of subscribers) {
        const email = (sub.email || '').toLowerCase().trim();
        if (!email || !validateEmail(email)) {
          skipped++;
          continue;
        }

        if (unsubEmails.has(email)) {
          skipped++;
          continue;
        }

        await wixData.insert('EmailQueue', {
          templateId: BLOG_NEWSLETTER_TEMPLATE,
          recipientEmail: email,
          recipientContactId: sub.contactId || '',
          variables: {
            postTitle: sanitize(post.title || '', 200),
            postExcerpt: sanitize(post.excerpt || post.metaDescription || '', 500),
            postUrl,
            postSlug: cleanSlug,
            postCategory: sanitize(post.category || '', 100),
            email,
          },
          sequenceType: SEQUENCE_TYPE,
          sequenceStep: 1,
          status: 'pending',
          scheduledFor: new Date(),
          attempt: 0,
          lastError: '',
          createdAt: new Date(),
        });
        queued++;
      }

      return { success: true, queued, skipped };
    } catch (err) {
      console.error('[blogNewsletter] Error notifying subscribers:', err);
      return { success: false, queued: 0, skipped: 0, error: err.message };
    }
  }
);

/**
 * Get a preview of what the blog newsletter would send.
 *
 * @function previewBlogNewsletter
 * @param {string} slug - Blog post slug
 * @returns {Promise<{success: boolean, post?: Object, subscriberCount?: number, error?: string}>}
 * @permission Admin
 */
export const previewBlogNewsletter = webMethod(
  Permissions.Admin,
  async (slug) => {
    try {
      if (!slug || typeof slug !== 'string') {
        return { success: false, error: 'Slug is required' };
      }

      const cleanSlug = sanitize(slug.trim(), 200);
      const post = getBlogPost(cleanSlug);

      if (!post) {
        return { success: false, error: 'Blog post not found' };
      }

      const subscribers = await fetchActiveSubscribers();

      return {
        success: true,
        post: {
          title: post.title,
          excerpt: post.excerpt || post.metaDescription,
          url: `${SITE_URL}/blog/${cleanSlug}`,
          category: post.category,
          publishDate: post.publishDate,
        },
        subscriberCount: subscribers.length,
      };
    } catch (err) {
      console.error('[blogNewsletter] Error previewing newsletter:', err);
      return { success: false, error: err.message };
    }
  }
);

/**
 * Get all blog posts available for newsletter notification,
 * marking which ones have already been sent.
 *
 * @function getBlogNewsletterStatus
 * @returns {Promise<{success: boolean, posts?: Array}>}
 * @permission Admin
 */
export const getBlogNewsletterStatus = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const posts = getAllBlogPosts();

      // Get all blog newsletter queue items
      const queueItems = await wixData.query('EmailQueue')
        .eq('sequenceType', SEQUENCE_TYPE)
        .eq('sequenceStep', 1)
        .find();

      const notifiedSlugs = new Set(
        queueItems.items
          .map(item => item.variables?.postSlug)
          .filter(Boolean)
      );

      const result = posts.map(post => ({
        slug: post.slug,
        title: post.title,
        publishDate: post.publishDate,
        notified: notifiedSlugs.has(post.slug),
      }));

      return { success: true, posts: result };
    } catch (err) {
      console.error('[blogNewsletter] Error getting status:', err);
      return { success: false, posts: [], error: err.message };
    }
  }
);

/**
 * Fetch all active newsletter subscribers from CMS.
 * @returns {Promise<Array<{email: string, contactId?: string}>>}
 */
async function fetchActiveSubscribers() {
  const PAGE_SIZE = 50;
  let allSubs = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await wixData.query('NewsletterSubscribers')
      .ne('status', 'unsubscribed')
      .limit(PAGE_SIZE)
      .skip(skip)
      .find();

    allSubs = allSubs.concat(result.items);
    skip += PAGE_SIZE;
    hasMore = result.items.length === PAGE_SIZE;
  }

  return allSubs;
}

// Export for testing
export const _BLOG_NEWSLETTER_TEMPLATE = BLOG_NEWSLETTER_TEMPLATE;
export const _SEQUENCE_TYPE = SEQUENCE_TYPE;
export const _SITE_URL = SITE_URL;
