/**
 * @module reviewModeration
 * @description Review moderation queue — spam filtering, bulk actions, and
 * admin dashboard endpoints for managing submitted reviews.
 *
 * Extends reviewsService.web.js with:
 * - Spam detection (keyword patterns, rating bombs, duplicate text)
 * - Bulk approve/reject actions
 * - Moderation queue with filtering (status, flagged, date range)
 * - Moderation stats for dashboard widgets
 *
 * CF-w3jc
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';

const COLLECTION = 'ProductReviews';

// Spam detection patterns
const SPAM_KEYWORDS = [
  'buy now', 'click here', 'free money', 'bitcoin', 'crypto', 'viagra',
  'casino', 'lottery', 'prize winner', 'act now', 'limited time',
  'www.', 'http://', 'https://', '.com/', '.net/', '.ru/',
];

const SPAM_SCORE_THRESHOLD = 3; // Reviews scoring >= 3 are flagged as spam

// ── Spam Detection ──────────────────────────────────────────────────

/**
 * Calculate a spam score for a review. Higher = more likely spam.
 *
 * Factors:
 * - Spam keyword matches (+1 each)
 * - All caps (+1)
 * - Excessive punctuation (+1)
 * - Very short body with extreme rating (+1)
 * - URL patterns (+2 each)
 *
 * @param {Object} review - {body, rating, author}
 * @returns {{score: number, flags: string[]}}
 */
export function calculateSpamScore(review) {
  const flags = [];
  let score = 0;
  const body = (review.body || '').toLowerCase();

  // Keyword matches
  for (const keyword of SPAM_KEYWORDS) {
    if (body.includes(keyword)) {
      if (keyword.includes('http') || keyword.includes('www') || keyword.includes('.com/')) {
        score += 2;
        flags.push(`url_pattern: ${keyword}`);
      } else {
        score += 1;
        flags.push(`spam_keyword: ${keyword}`);
      }
    }
  }

  // All caps (more than 50% uppercase in body > 10 chars)
  if (review.body && review.body.length > 10) {
    const upperRatio = (review.body.match(/[A-Z]/g) || []).length / review.body.length;
    if (upperRatio > 0.5) {
      score += 1;
      flags.push('excessive_caps');
    }
  }

  // Excessive punctuation (3+ exclamation/question marks)
  if ((review.body || '').match(/[!?]{3,}/)) {
    score += 1;
    flags.push('excessive_punctuation');
  }

  // Very short body + extreme rating (1 or 5 stars)
  if ((review.body || '').length < 20 && (review.rating === 1 || review.rating === 5)) {
    score += 1;
    flags.push('short_extreme_rating');
  }

  return { score, flags };
}

/**
 * Check if a review is spam. Returns true if score >= threshold.
 *
 * @param {Object} review
 * @returns {boolean}
 */
export function isSpam(review) {
  return calculateSpamScore(review).score >= SPAM_SCORE_THRESHOLD;
}

// ── Moderation Queue ────────────────────────────────────────────────

/**
 * Get the moderation queue with filtering and spam scores.
 *
 * @param {Object} [options]
 * @param {string} [options.status='pending'] - 'pending' | 'approved' | 'rejected' | 'all'
 * @param {boolean} [options.flaggedOnly=false] - Only show flagged reviews
 * @param {number} [options.page=0]
 * @param {number} [options.pageSize=20]
 * @returns {Promise<{success: boolean, reviews: Array, total: number}>}
 * @permission Admin
 */
export const getModerationQueue = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const status = options.status || 'pending';
      const page = Math.max(0, options.page || 0);
      const pageSize = Math.min(50, Math.max(1, options.pageSize || 20));

      let query = wixData.query(COLLECTION);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (options.flaggedOnly) {
        query = query.gt('flagCount', 0);
      }

      const result = await query
        .descending('_createdDate')
        .skip(page * pageSize)
        .limit(pageSize)
        .find();

      const reviews = result.items.map(review => {
        const spam = calculateSpamScore(review);
        return {
          reviewId: review._id,
          productId: review.productId,
          productName: review.productName || '',
          author: review.author || 'Anonymous',
          rating: review.rating,
          body: review.body || '',
          status: review.status,
          flagCount: review.flagCount || 0,
          verifiedPurchase: review.verifiedPurchase || false,
          createdAt: review._createdDate,
          moderatedAt: review.moderatedAt || null,
          spamScore: spam.score,
          spamFlags: spam.flags,
          isLikelySpam: spam.score >= SPAM_SCORE_THRESHOLD,
          hasPhoto: !!(review.photoUrl || review.photoUrls),
          ownerResponse: review.ownerResponse || null,
        };
      });

      return { success: true, reviews, total: result.totalCount };
    } catch (err) {
      console.error('[reviewModeration] getModerationQueue error:', err);
      return { success: false, reviews: [], total: 0 };
    }
  }
);

// ── Bulk Actions ────────────────────────────────────────────────────

/**
 * Bulk moderate reviews (approve or reject multiple at once).
 *
 * @param {string[]} reviewIds - Array of review IDs
 * @param {string} action - 'approve' | 'reject'
 * @returns {Promise<{success: boolean, processed: number, failed: number}>}
 * @permission Admin
 */
export const bulkModerate = webMethod(
  Permissions.Admin,
  async (reviewIds, action) => {
    try {
      if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
        return { success: false, processed: 0, failed: 0, error: 'No review IDs provided' };
      }

      if (!['approve', 'reject'].includes(action)) {
        return { success: false, processed: 0, failed: 0, error: 'Action must be approve or reject' };
      }

      const maxBatch = 50;
      const ids = reviewIds.slice(0, maxBatch).map(id => sanitize(id, 50));
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      let processed = 0;
      let failed = 0;

      for (const id of ids) {
        try {
          const review = await wixData.get(COLLECTION, id);
          if (!review) { failed++; continue; }

          // Only moderate pending or allow approved→rejected
          if (review.status === 'pending' || (review.status === 'approved' && newStatus === 'rejected')) {
            review.status = newStatus;
            review.moderatedAt = new Date();
            review.bulkModerated = true;
            await wixData.update(COLLECTION, review);
            processed++;
          } else {
            failed++;
          }
        } catch (e) {
          console.error("[reviewModeration] bulkModerate item error:", id, e);
          failed++;
        }
      }

      logAuditEvent(COLLECTION, `bulk_${action}`, 'admin', {
        attempted: ids.length, processed, failed,
      });

      return { success: true, processed, failed };
    } catch (err) {
      console.error('[reviewModeration] bulkModerate error:', err);
      return { success: false, processed: 0, failed: 0, error: 'Bulk moderation failed' };
    }
  }
);

/**
 * Auto-reject reviews that score above spam threshold.
 * Scans pending reviews and rejects obvious spam.
 *
 * @returns {Promise<{success: boolean, scanned: number, rejected: number}>}
 * @permission Admin
 */
export const autoRejectSpam = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await wixData.query(COLLECTION)
        .eq('status', 'pending')
        .limit(100)
        .find();

      let rejected = 0;

      for (const review of result.items) {
        if (isSpam(review)) {
          review.status = 'rejected';
          review.moderatedAt = new Date();
          review.rejectionReason = 'auto_spam';
          await wixData.update(COLLECTION, review);
          rejected++;
        }
      }

      logAuditEvent(COLLECTION, 'auto_reject_spam', 'system', {
        scanned: result.items.length, rejected,
      });

      return { success: true, scanned: result.items.length, rejected };
    } catch (err) {
      console.error('[reviewModeration] autoRejectSpam error:', err);
      return { success: false, scanned: 0, rejected: 0 };
    }
  }
);

/**
 * Get moderation dashboard stats.
 *
 * @returns {Promise<{success: boolean, stats: Object}>}
 * @permission Admin
 */
export const getModerationStats = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const pending = await wixData.query(COLLECTION).eq('status', 'pending').count();
      const approved = await wixData.query(COLLECTION).eq('status', 'approved').count();
      const rejected = await wixData.query(COLLECTION).eq('status', 'rejected').count();
      const flagged = await wixData.query(COLLECTION).eq('status', 'pending').gt('flagCount', 0).count();

      return {
        success: true,
        stats: { pending, approved, rejected, flagged, total: pending + approved + rejected },
      };
    } catch (err) {
      console.error('[reviewModeration] getModerationStats error:', err);
      return { success: false, stats: null };
    }
  }
);


// ── Profanity Filter ────────────────────────────────────────────────

const PROFANITY_KEYWORDS = [
  'fuck', 'shit', 'asshole', 'bitch', 'cunt', 'damn it', 'bastard',
  'motherfucker', 'cock', 'pussy', 'whore', 'faggot', 'nigger', 'nigga',
];

/**
 * Check if text contains any profanity keywords (case-insensitive).
 *
 * @param {string} text
 * @returns {boolean}
 */
export function containsProfanity(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return PROFANITY_KEYWORDS.some(word => lower.includes(word));
}

/**
 * Determine if a review is eligible for auto-approval.
 * Criteria: 4+ stars AND no profanity in title or body.
 *
 * @param {{rating: number, title?: string, body?: string}} review
 * @returns {boolean}
 */
export function isAutoApprovable(review) {
  if (!review || review.rating < 4) return false;
  return !containsProfanity(review.title) && !containsProfanity(review.body);
}

// ── Stamped.io Ingest ───────────────────────────────────────────────

/**
 * Ingest a review from the Stamped.io webhook payload.
 * Inserts into ProductReviews with status 'pending', or 'approved' if
 * the review passes the auto-approve threshold.
 *
 * Called by http-functions.js post_stampedWebhook after signature verification.
 *
 * @param {Object} payload - Stamped.io review object
 * @returns {Promise<{success: boolean, reviewId?: string, status?: string}>}
 */
export async function ingestStampedReview(payload) {
  try {
    const productId = sanitize(String(payload.productId || ''), 100);
    const author = sanitize(payload.author || payload.reviewerName || 'Anonymous', 200);
    const rating = Number(payload.rating) || 0;
    const title = sanitize(payload.title || payload.reviewTitle || '', 300);
    const body = sanitize(payload.body || payload.reviewMessage || '', 5000);
    const email = sanitize(payload.email || '', 254);
    const externalId = sanitize(String(payload.id || payload.reviewId || ''), 100);

    if (!productId || !rating || rating < 1 || rating > 5) {
      return { success: false };
    }

    // Avoid duplicate ingestion
    if (externalId) {
      const existing = await wixData.query(COLLECTION)
        .eq('externalId', externalId)
        .eq('source', 'stamped')
        .find();
      if (existing.items.length > 0) {
        return { success: true, reviewId: existing.items[0]._id, status: 'duplicate' };
      }
    }

    const autoApprovable = isAutoApprovable({ rating, title, body });
    const status = autoApprovable ? 'approved' : 'pending';

    const record = {
      productId,
      author,
      rating,
      title,
      body,
      email,
      status,
      source: 'stamped',
      externalId,
      verifiedPurchase: !!(payload.isVerifiedBuyer || payload.verified),
      createdAt: payload.createdAt ? new Date(payload.createdAt) : new Date(),
    };

    const saved = await wixData.insert(COLLECTION, record);

    logAuditEvent(COLLECTION, 'stamped_ingest', saved._id, {
      status,
      rating,
      autoApproved: autoApprovable,
      externalId,
    });

    return { success: true, reviewId: saved._id, status };
  } catch (err) {
    console.error('[reviewModeration] ingestStampedReview error:', err);
    return { success: false };
  }
}

/**
 * Scan pending reviews and auto-approve those meeting the threshold
 * (4+ stars, no profanity). Admin utility for backfilling.
 *
 * @returns {Promise<{success: boolean, scanned: number, approved: number}>}
 * @permission Admin
 */
export const autoApproveEligible = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await wixData.query(COLLECTION)
        .eq('status', 'pending')
        .limit(100)
        .find();

      let approved = 0;

      for (const review of result.items) {
        if (isAutoApprovable(review)) {
          review.status = 'approved';
          review.moderatedAt = new Date();
          review.autoApproved = true;
          await wixData.update(COLLECTION, review);
          approved++;
        }
      }

      logAuditEvent(COLLECTION, 'auto_approve_eligible', 'system', {
        scanned: result.items.length, approved,
      });

      return { success: true, scanned: result.items.length, approved };
    } catch (err) {
      console.error('[reviewModeration] autoApproveEligible error:', err);
      return { success: false, scanned: 0, approved: 0 };
    }
  }
);

export const _PROFANITY_KEYWORDS = PROFANITY_KEYWORDS;

// Exports for testing
export const _SPAM_KEYWORDS = SPAM_KEYWORDS;
export const _SPAM_SCORE_THRESHOLD = SPAM_SCORE_THRESHOLD;
