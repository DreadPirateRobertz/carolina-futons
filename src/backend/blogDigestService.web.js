/**
 * @module blogDigestService
 * @description Weekly blog digest email service. Every Friday at 9am MT,
 * fetches posts published in the last 7 days and sends a digest email to all
 * active newsletter subscribers. Skips sending if no new posts exist.
 * Prevents duplicate digests via BlogDigestLog CMS collection.
 *
 * @requires wix-web-module
 * @requires wix-blog-backend
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * 1. Create Wix Triggered Email template 'blog_weekly_digest' in Dashboard >
 *    Marketing > Triggered Emails with variables:
 *    postsJson, postCount, weekLabel, siteUrl, email
 * 2. Create 'BlogDigestLog' CMS collection with fields:
 *    weekOf (Date), postCount (Number), subscriberCount (Number), sentAt (Date)
 * 3. Schedule GET https://www.carolinafutons.com/_functions/weeklyBlogDigestCron
 *    every Friday at 9am MT with X-Cron-Secret: <ALERT_CRON_KEY>
 */
import { Permissions, webMethod } from 'wix-web-module';
import { posts as blogPosts } from 'wix-blog-backend';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const DIGEST_TEMPLATE = 'blog_weekly_digest';
const SEQUENCE_TYPE = 'blog_weekly_digest';
const SUBSCRIBER_PAGE_SIZE = 50;
const MAX_POSTS_IN_DIGEST = 5;
const MAX_POSTS_FETCH = 50;

/**
 * Send a weekly digest of recent blog posts to all newsletter subscribers.
 * Skips if no posts in the last 7 days. Deduplicates by week.
 *
 * @function sendWeeklyBlogDigest
 * @param {Object} [options]
 * @param {number} [options.lookbackDays=7] Days to look back for recent posts
 * @returns {Promise<{success: boolean, queued: number, skipped: number, postCount: number, error?: string}>}
 * @permission Admin
 */
export const sendWeeklyBlogDigest = webMethod(
  Permissions.Admin,
  async ({ lookbackDays = 7 } = {}) => {
    try {
      const safeDays = Math.max(1, Math.min(30, Math.floor(lookbackDays)));
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
      const weekOf = getWeekStart(new Date());

      // Dedup: claim this week's slot early to prevent concurrent cron double-sends
      const alreadySent = await wixData.query('BlogDigestLog')
        .ge('weekOf', weekOf)
        .find();
      if (alreadySent.items.length > 0) {
        return { success: false, queued: 0, skipped: 0, postCount: 0, error: 'Digest already sent this week' };
      }

      const recentPosts = await fetchRecentPosts(since);
      if (recentPosts.length === 0) {
        return { success: true, queued: 0, skipped: 0, postCount: 0 };
      }

      const subscribers = await fetchActiveSubscribers();
      if (subscribers.length === 0) {
        return { success: true, queued: 0, skipped: 0, postCount: recentPosts.length };
      }

      // Paginate unsubscribes to avoid the default 50-item truncation (CAN-SPAM)
      const unsubEmails = await fetchUnsubscribeEmails();

      const weekLabel = formatWeekLabel(since, new Date());
      const postsJson = JSON.stringify(recentPosts.map(normalizePostForEmail));
      let queued = 0;
      let skipped = 0;

      for (const sub of subscribers) {
        const email = (sub.email || '').toLowerCase().trim();
        if (!email || !validateEmail(email) || unsubEmails.has(email)) {
          skipped++;
          continue;
        }

        await wixData.insert('EmailQueue', {
          templateId: DIGEST_TEMPLATE,
          recipientEmail: email,
          recipientContactId: sub.contactId || '',
          variables: {
            postsJson,
            postCount: String(recentPosts.length),
            weekLabel,
            siteUrl: SITE_URL,
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

      // Record that we sent this week's digest
      await wixData.insert('BlogDigestLog', {
        weekOf,
        postCount: recentPosts.length,
        subscriberCount: queued,
        sentAt: new Date(),
      });

      return { success: true, queued, skipped, postCount: recentPosts.length };
    } catch (err) {
      console.error('[blogDigestService] sendWeeklyBlogDigest error:', err);
      return { success: false, queued: 0, skipped: 0, postCount: 0, error: err.message };
    }
  }
);

/**
 * Preview what this week's digest would include without sending.
 *
 * @function previewWeeklyBlogDigest
 * @param {number} [lookbackDays=7]
 * @returns {Promise<{success: boolean, posts?: Array, subscriberCount?: number, weekLabel?: string, alreadySent?: boolean, error?: string}>}
 * @permission Admin
 */
export const previewWeeklyBlogDigest = webMethod(
  Permissions.Admin,
  async (lookbackDays = 7) => {
    try {
      const safeDays = Math.max(1, Math.min(30, Math.floor(lookbackDays)));
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
      const weekOf = getWeekStart(new Date());

      const alreadySent = await wixData.query('BlogDigestLog')
        .ge('weekOf', weekOf)
        .find();

      const recentPosts = await fetchRecentPosts(since);
      const subscribers = await fetchActiveSubscribers();

      return {
        success: true,
        posts: recentPosts.map(normalizePostForEmail),
        subscriberCount: subscribers.length,
        weekLabel: formatWeekLabel(since, new Date()),
        alreadySent: alreadySent.items.length > 0,
      };
    } catch (err) {
      console.error('[blogDigestService] previewWeeklyBlogDigest error:', err);
      return { success: false, error: err.message };
    }
  }
);

/**
 * Fetch posts published on or after `since`, up to MAX_POSTS_IN_DIGEST.
 * @param {Date} since
 * @returns {Promise<Array>}
 */
async function fetchRecentPosts(since) {
  const response = await blogPosts.listPosts({
    paging: { limit: MAX_POSTS_FETCH, offset: 0 },
  });
  const all = response.posts ?? [];
  return all
    .filter(p => {
      const pub = p.publishedDate ? new Date(p.publishedDate) : null;
      return pub && pub >= since;
    })
    .sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate))
    .slice(0, MAX_POSTS_IN_DIGEST);
}

/**
 * Paginate through all Unsubscribes for this sequence and return a Set of emails.
 * Pagination is required — wix-data defaults to 50 items; missing unsubscribes
 * would cause CAN-SPAM violations.
 * @returns {Promise<Set<string>>}
 */
async function fetchUnsubscribeEmails() {
  const emails = new Set();
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await wixData.query('Unsubscribes')
      .hasSome('sequenceType', ['all', SEQUENCE_TYPE])
      .limit(SUBSCRIBER_PAGE_SIZE)
      .skip(skip)
      .find();

    for (const u of result.items) {
      if (u.email) emails.add(u.email);
    }
    skip += SUBSCRIBER_PAGE_SIZE;
    hasMore = result.items.length === SUBSCRIBER_PAGE_SIZE;
  }

  return emails;
}

/**
 * Paginate through NewsletterSubscribers, excluding unsubscribed.
 * @returns {Promise<Array<{email: string, contactId?: string}>>}
 */
async function fetchActiveSubscribers() {
  let all = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await wixData.query('NewsletterSubscribers')
      .ne('status', 'unsubscribed')
      .limit(SUBSCRIBER_PAGE_SIZE)
      .skip(skip)
      .find();

    all.push(...result.items);
    skip += SUBSCRIBER_PAGE_SIZE;
    hasMore = result.items.length === SUBSCRIBER_PAGE_SIZE;
  }

  return all;
}

/**
 * Normalize a raw Wix Blog post for email template variables.
 * @param {Object} raw
 * @returns {Object}
 */
function normalizePostForEmail(raw) {
  const slug = sanitize(raw.slug || '', 200);
  const rawImageUrl = raw.media?.wixMedia?.image?.url ?? '';
  const coverImageUrl = /^https?:\/\//.test(rawImageUrl) ? sanitize(rawImageUrl, 500) : '';
  return {
    title: sanitize(raw.title || '', 200),
    slug,
    excerpt: sanitize(raw.excerpt || '', 400),
    url: `${SITE_URL}/blog/${slug}`,
    coverImageUrl,
    category: sanitize(raw.categories?.[0]?.label ?? '', 100),
    publishedDate: sanitize(raw.publishedDate || '', 30),
  };
}

/**
 * Get Monday 00:00:00 UTC of the week containing `date`.
 * Used as a stable dedup key so we send at most one digest per calendar week.
 * @param {Date} date
 * @returns {Date}
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Format a human-readable week label for the email subject line.
 * @param {Date} since
 * @param {Date} now
 * @returns {string} e.g. "March 21–28, 2026"
 */
function formatWeekLabel(since, now) {
  const opts = { month: 'long', day: 'numeric', timeZone: 'UTC' };
  const yearOpts = { year: 'numeric', timeZone: 'UTC' };
  const start = since.toLocaleDateString('en-US', opts);
  const end = now.toLocaleDateString('en-US', opts);
  const year = now.toLocaleDateString('en-US', yearOpts);
  return `${start}–${end}, ${year}`;
}

// Exports for testing
export const _DIGEST_TEMPLATE = DIGEST_TEMPLATE;
export const _SEQUENCE_TYPE = SEQUENCE_TYPE;
export const _SITE_URL = SITE_URL;
export const _getWeekStart = getWeekStart;
export const _formatWeekLabel = formatWeekLabel;
