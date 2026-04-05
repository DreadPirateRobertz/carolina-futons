/**
 * @module reviewsService
 * @description Backend web module for customer product reviews.
 * Provides CRUD operations for product reviews with moderation,
 * verified purchase validation, and aggregate rating calculation.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection "Reviews" in Wix Dashboard with fields:
 * - productId (Text) - Reference to Stores/Products
 * - memberId (Text) - Reference to Members
 * - authorName (Text) - Display name
 * - rating (Number) - 1-5
 * - title (Text) - Review title
 * - body (Text) - Review text
 * - photos (MediaGallery) - Up to 3 review photos
 * - verifiedPurchase (Boolean) - Bought this product
 * - helpful (Number) - Helpful vote count
 * - status (Text) - "pending" | "approved" | "rejected"
 * - _createdDate (DateTime) - Auto
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { mediaManager } from 'wix-media-backend';
import { sanitize, validateId, isWixMediaUrl } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';
import { receiveGamificationEvent } from 'backend/gamificationEventReceiver.web';
import { recordEmailEvent } from 'backend/emailAutomation.web'; // CF-fzsd: conversion tracking

const COLLECTION = 'Reviews';
const MAX_PHOTOS = 3;
const MAX_TITLE_LEN = 150;
const MAX_BODY_LEN = 5000;
const PAGE_SIZE = 10;

// ─── Public Methods ─────────────────────────────────────────────────

/**
 * Get approved reviews for a product, paginated and sorted.
 *
 * @param {string} productId - Product to get reviews for.
 * @param {Object} [options]
 * @param {string} [options.sort="newest"] - "newest" | "highest" | "lowest" | "helpful"
 * @param {number} [options.page=0] - Page number (0-indexed).
 * @returns {Promise<{reviews: Array, total: number, page: number, pageSize: number}>}
 */
export const getProductReviews = webMethod(
  Permissions.Anyone,
  async (productId, options = {}) => {
    const pid = validateId(productId);
    if (!pid) return { reviews: [], total: 0, page: 0, pageSize: PAGE_SIZE };

    const { sort = 'newest', page = 0, filterStars } = options;

    let query = wixData.query(COLLECTION)
      .eq('productId', pid)
      .eq('status', 'approved');

    // Star filter
    if (filterStars >= 1 && filterStars <= 5) {
      query = query.eq('rating', Math.round(filterStars));
    }

    switch (sort) {
      case 'highest':
        query = query.descending('rating');
        break;
      case 'lowest':
        query = query.ascending('rating');
        break;
      case 'helpful':
        query = query.descending('helpful');
        break;
      default:
        query = query.descending('_createdDate');
    }

    const clampedPage = Math.max(0, Math.floor(page));
    const skip = clampedPage * PAGE_SIZE;
    const result = await query.skip(skip).limit(PAGE_SIZE).find();

    return {
      reviews: result.items.map(formatReview),
      total: result.totalCount,
      page: clampedPage,
      pageSize: PAGE_SIZE,
    };
  }
);

/**
 * Get aggregate rating stats for a product.
 *
 * @param {string} productId
 * @returns {Promise<{average: number, total: number, breakdown: Object}>}
 *   breakdown is { 5: count, 4: count, 3: count, 2: count, 1: count }
 */
export const getAggregateRating = webMethod(
  Permissions.Anyone,
  async (productId) => {
    const pid = validateId(productId);
    if (!pid) return { average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };

    const result = await wixData.query(COLLECTION)
      .eq('productId', pid)
      .eq('status', 'approved')
      .limit(1000)
      .find();

    const reviews = result.items;
    if (reviews.length === 0) {
      return { average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
    }

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;
    let validCount = 0;
    for (const r of reviews) {
      if (r.rating == null || isNaN(Number(r.rating))) {
        console.warn(`[reviewsService] Skipping review ${r._id}: invalid rating (${r.rating})`);
        continue;
      }
      const rating = Math.min(5, Math.max(1, Math.round(Number(r.rating))));
      breakdown[rating]++;
      sum += rating;
      validCount++;
    }

    if (validCount === 0) {
      return { average: 0, total: 0, breakdown };
    }

    return {
      average: Math.round((sum / validCount) * 10) / 10,
      total: validCount,
      breakdown,
    };
  }
);

/**
 * Submit a new product review. Requires logged-in member.
 * Reviews start in "pending" status for moderation.
 * Checks order history for verified purchase badge.
 *
 * @param {Object} data
 * @param {string} data.productId
 * @param {number} data.rating - 1-5
 * @param {string} data.title - Review title
 * @param {string} data.body - Review text
 * @param {string[]} [data.photos] - Up to 3 image URLs
 * @returns {Promise<{success: boolean, reviewId?: string, error?: string}>}
 */
export const submitReview = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Please log in to submit a review.' };

      const memberId = member._id;
      const productId = validateId(data.productId);
      if (!productId) return { success: false, error: 'Invalid product.' };

      // Validate rating
      const rating = Math.round(Number(data.rating));
      if (rating < 1 || rating > 5 || isNaN(rating)) {
        return { success: false, error: 'Rating must be between 1 and 5.' };
      }

      // Sanitize text inputs
      const title = sanitize(data.title, MAX_TITLE_LEN);
      const body = sanitize(data.body, MAX_BODY_LEN);
      if (!body || body.length < 10) {
        return { success: false, error: 'Review must be at least 10 characters.' };
      }

      // Check for duplicate review
      const existing = await wixData.query(COLLECTION)
        .eq('productId', productId)
        .eq('memberId', memberId)
        .find();

      if (existing.items.length > 0) {
        return { success: false, error: 'You have already reviewed this product.' };
      }

      // Check verified purchase
      const verifiedPurchase = await checkVerifiedPurchase(memberId, productId);

      // Sanitize photos
      const photos = Array.isArray(data.photos)
        ? data.photos.filter(p => typeof p === 'string' && p.length > 0).slice(0, MAX_PHOTOS)
        : [];

      // Build author name from member profile
      const authorName = buildAuthorName(member);

      const record = {
        productId,
        memberId,
        authorName,
        rating,
        title: title || '',
        body,
        photos,
        verifiedPurchase,
        helpful: 0,
        status: 'pending',
      };

      const saved = await wixData.insert(COLLECTION, record);

      // Fire gamification event — non-blocking; a failure must never break the submit
      receiveGamificationEvent(
        'gamification_submit_review',
        { has_photo: photos.length > 0 },
        memberId,
      ).catch(err => console.warn('[reviewsService] gamification event failed:', err));

      // CF-fzsd: record email conversion when review came from a review-request email
      const emailQueueId = data.emailQueueId ? sanitize(data.emailQueueId, 50) : '';
      if (emailQueueId) {
        recordEmailEvent({ emailQueueId, eventType: 'conversion' })
          .then(res => { if (!res?.success) console.warn('[reviewsService] email conversion not recorded for queue', emailQueueId); })
          .catch(err => console.warn('[reviewsService] email conversion record failed:', err));
      }

      return { success: true, reviewId: saved._id };
    } catch (err) {
      console.error('[reviewsService] Submit error:', err);
      return { success: false, error: 'Unable to submit review. Please try again.' };
    }
  }
);

/**
 * Mark a review as helpful. Increments the helpful counter.
 * Site members can vote (rate-limited by client to prevent abuse).
 *
 * @param {string} reviewId
 * @returns {Promise<{success: boolean, helpful?: number}>}
 */
export const markHelpful = webMethod(
  Permissions.SiteMember,
  async (reviewId) => {
    const rid = validateId(reviewId);
    if (!rid) return { success: false };

    try {
      const review = await wixData.get(COLLECTION, rid);
      if (!review || review.status !== 'approved') return { success: false };

      review.helpful = (review.helpful || 0) + 1;
      await wixData.update(COLLECTION, review);
      return { success: true, helpful: review.helpful };
    } catch (err) {
      console.error('[reviewsService] markHelpful error:', err);
      return { success: false };
    }
  }
);

/**
 * Flag a review as inappropriate. Creates a moderation record.
 *
 * @param {string} reviewId
 * @param {string} reason - "spam" | "offensive" | "fake" | "other"
 * @returns {Promise<{success: boolean}>}
 */
export const flagReview = webMethod(
  Permissions.SiteMember,
  async (reviewId, reason) => {
    const rid = validateId(reviewId);
    if (!rid) return { success: false, error: 'Invalid review ID' };

    const validReasons = ['spam', 'offensive', 'fake', 'other'];
    const cleanReason = validReasons.includes(reason) ? reason : 'other';

    try {
      const review = await wixData.get(COLLECTION, rid);
      if (!review) return { success: false, error: 'Review not found' };

      // Record the flag
      await wixData.insert('ReviewFlags', {
        reviewId: rid,
        reason: cleanReason,
        flaggedAt: new Date(),
      });

      // Auto-hide if flagged 3+ times
      const flags = await wixData.query('ReviewFlags')
        .eq('reviewId', rid)
        .count();

      if (flags >= 3 && review.status === 'approved') {
        review.status = 'pending'; // Send back for moderation
        await wixData.update(COLLECTION, review);
      }

      return { success: true };
    } catch (err) {
      console.error('[reviewsService] flagReview error:', err);
      return { success: false, error: 'Failed to flag review' };
    }
  }
);

/**
 * Get pending reviews for admin moderation queue.
 *
 * @param {number} [limit=20] - Max reviews to return.
 * @returns {Promise<{success: boolean, reviews: Array, total: number}>}
 */
export const getPendingReviews = webMethod(
  Permissions.Admin,
  async (limit = 20) => {
    try {
      const safeLimit = Math.max(1, Math.min(50, Math.round(limit)));
      const result = await wixData.query(COLLECTION)
        .eq('status', 'pending')
        .descending('_createdDate')
        .limit(safeLimit)
        .find();

      return {
        success: true,
        reviews: result.items,
        total: result.totalCount,
      };
    } catch (err) {
      console.error('[reviewsService] getPendingReviews error:', err);
      return { success: false, reviews: [], total: 0 };
    }
  }
);

// Valid status transitions for text review moderation
const REVIEW_STATUS_TRANSITIONS = {
  pending:  ['approved', 'rejected'],
  approved: ['rejected'],
  rejected: ['pending'],  // Can re-queue for another look
};

/**
 * Moderate a review: approve or reject. Admin only.
 * Enforces valid status transitions.
 *
 * @param {string} reviewId
 * @param {string} action - "approve" | "reject"
 * @returns {Promise<{success: boolean, previousStatus?: string, newStatus?: string, error?: string}>}
 */
export const moderateReview = webMethod(
  Permissions.Admin,
  async (reviewId, action) => {
    try {
      const rid = validateId(reviewId);
      if (!rid) return { success: false, error: 'Invalid review ID.' };

      const validActions = ['approve', 'reject'];
      if (!validActions.includes(action)) {
        return { success: false, error: 'Action must be "approve" or "reject".' };
      }

      const review = await wixData.get(COLLECTION, rid);
      if (!review) return { success: false, error: 'Review not found.' };

      const currentStatus = review.status || 'pending';
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const allowed = REVIEW_STATUS_TRANSITIONS[currentStatus];

      if (!allowed || !allowed.includes(newStatus)) {
        console.warn(`[reviewsService] Blocked transition: ${rid} ${currentStatus} → ${newStatus}`);
        return {
          success: false,
          error: `Cannot ${action} a review with status '${currentStatus}'.`,
        };
      }

      const previousStatus = currentStatus;
      review.status = newStatus;
      review.moderatedAt = new Date();
      await wixData.update(COLLECTION, review);

      logAuditEvent(COLLECTION, `moderate_${action}`, rid, { previousStatus, newStatus });
      return { success: true, previousStatus, newStatus };
    } catch (err) {
      console.error('[reviewsService] moderateReview error:', err);
      return { success: false, error: 'Failed to moderate review.' };
    }
  }
);

/**
 * Get review statistics for admin dashboard.
 *
 * @param {number} [days=30] - Period to analyze
 * @returns {Promise<Object>} Review stats
 */
export const getReviewStats = webMethod(
  Permissions.Admin,
  async (days = 30) => {
    try {
      const safeDays = Math.min(Math.max(1, days), 365);
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

      const total = await wixData.query(COLLECTION).ge('_createdDate', since).count();
      const approved = await wixData.query(COLLECTION).ge('_createdDate', since).eq('status', 'approved').count();
      const pending = await wixData.query(COLLECTION).ge('_createdDate', since).eq('status', 'pending').count();
      const rejected = await wixData.query(COLLECTION).ge('_createdDate', since).eq('status', 'rejected').count();

      // Average rating of approved reviews
      const approvedReviews = await wixData.query(COLLECTION)
        .ge('_createdDate', since)
        .eq('status', 'approved')
        .limit(1000)
        .find();

      let avgRating = 0;
      if (approvedReviews.items.length > 0) {
        const sum = approvedReviews.items.reduce((acc, r) => acc + (r.rating || 0), 0);
        avgRating = Math.round((sum / approvedReviews.items.length) * 10) / 10;
      }

      // Verified purchase rate
      const verified = approvedReviews.items.filter(r => r.verifiedPurchase).length;

      return {
        success: true,
        period: `${safeDays} days`,
        total,
        approved,
        pending,
        rejected,
        avgRating,
        verifiedPurchaseRate: approved > 0 ? Math.round((verified / approved) * 100) : 0,
        withPhotos: approvedReviews.items.filter(r => r.photos && r.photos.length > 0).length,
      };
    } catch (err) {
      console.error('[reviewsService] getReviewStats error:', err);
      return { success: false, error: 'Failed to fetch stats' };
    }
  }
);

/**
 * Add an owner response to a review. Admin only.
 *
 * @param {string} reviewId
 * @param {string} responseText - Owner's response
 * @returns {Promise<{success: boolean}>}
 */
export const addOwnerResponse = webMethod(
  Permissions.Admin,
  async (reviewId, responseText) => {
    try {
      const rid = validateId(reviewId);
      if (!rid) return { success: false, error: 'Invalid review ID' };

      const text = sanitize(responseText, 2000);
      if (!text || text.length < 5) {
        return { success: false, error: 'Response must be at least 5 characters.' };
      }

      const review = await wixData.get(COLLECTION, rid);
      if (!review) return { success: false, error: 'Review not found' };

      review.ownerResponse = text;
      review.ownerResponseDate = new Date();
      await wixData.update(COLLECTION, review);

      return { success: true };
    } catch (err) {
      console.error('[reviewsService] addOwnerResponse error:', err);
      return { success: false, error: 'Failed to add response' };
    }
  }
);

/**
 * Get review summaries for multiple products (category grid).
 * Returns average rating and total count for each product.
 *
 * @param {string[]} productIds - Array of product IDs.
 * @returns {Promise<Object>} Map of productId -> { average, total }
 */
export const getCategoryReviewSummaries = webMethod(
  Permissions.Anyone,
  async (productIds) => {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) return {};

      const cleanIds = productIds
        .map(id => validateId(id))
        .filter(Boolean)
        .slice(0, 100);

      if (cleanIds.length === 0) return {};

      const result = await wixData.query(COLLECTION)
        .eq('status', 'approved')
        .hasSome('productId', cleanIds)
        .limit(1000)
        .find();

      const summaries = {};
      for (const id of cleanIds) {
        summaries[id] = { average: 0, total: 0 };
      }

      for (const review of result.items) {
        const pid = review.productId;
        if (!summaries[pid]) continue;
        if (review.rating == null || isNaN(Number(review.rating))) {
          console.warn(`[reviewsService] Skipping review ${review._id}: invalid rating (${review.rating})`);
          continue;
        }
        const raw = Number(review.rating);
        summaries[pid].total++;
        summaries[pid]._sum = (summaries[pid]._sum || 0) + Math.min(5, Math.max(1, Math.round(raw)));
      }

      for (const id of cleanIds) {
        if (summaries[id].total > 0) {
          summaries[id].average = Math.round((summaries[id]._sum / summaries[id].total) * 10) / 10;
        }
        delete summaries[id]._sum;
      }

      return summaries;
    } catch (err) {
      console.error('[reviewsService] getCategoryReviewSummaries error:', err);
      return {};
    }
  }
);

/**
 * Check if a member has purchased a specific product.
 * Used for "Verified Purchase" badge.
 *
 * @param {string} memberId
 * @param {string} productId
 * @returns {Promise<boolean>}
 */
async function checkVerifiedPurchase(memberId, productId) {
  try {
    const orders = await wixData.query('Stores/Orders')
      .eq('buyerInfo.id', memberId)
      .find();

    for (const order of orders.items) {
      const lineItems = order.lineItems || [];
      if (lineItems.some(li => li.productId === productId)) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('[reviewsService] Verified purchase check error:', err);
    return false;
  }
}

/**
 * Build a display name from member profile.
 * Shows "FirstName L." format for privacy.
 */
function buildAuthorName(member) {
  const first = member.contactDetails?.firstName || '';
  const last = member.contactDetails?.lastName || '';
  if (first && last) return `${first} ${last.charAt(0)}.`;
  if (first) return first;
  return 'Customer';
}

/**
 * Format a review record for frontend display.
 * Strips internal fields and formats dates.
 */
function formatReview(review) {
  return {
    _id: review._id,
    authorName: review.authorName || 'Customer',
    rating: review.rating,
    title: review.title || '',
    body: review.body || '',
    photos: review.photos || [],
    verifiedPurchase: review.verifiedPurchase || false,
    helpful: review.helpful || 0,
    ownerResponse: review.ownerResponse || null,
    ownerResponseDate: review.ownerResponseDate
      ? new Date(review.ownerResponseDate).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : null,
    date: review._createdDate
      ? new Date(review._createdDate).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : '',
  };
}

// ── Video Review Methods (CF-ou66.1) ──────────────────────────────────────

const VIDEO_REVIEWS_COLLECTION = 'VideoReviews';
const MAX_CAPTION_LEN = 200;

/**
 * Submit a video review for a product.
 * Called after the member has uploaded the video via Wix UploadButton.
 * The videoFileId is a Wix Media Manager reference returned by the upload element.
 *
 * @function submitVideoReview
 * @param {string} productId - Product being reviewed.
 * @param {string} videoFileId - Wix Media Manager fileId (e.g., "video:wix:video://v1/...").
 * @param {string} [caption] - Optional caption (max 200 chars).
 * @returns {Promise<{success: boolean, reviewId?: string, error?: string}>}
 * @permission SiteMember
 *
 * @setup VideoReviews CMS collection fields:
 *   productId (text, indexed), memberId (text, indexed), videoFileId (text),
 *   caption (text), status (text: pending|approved|rejected), submittedAt (dateTime)
 */
export const submitVideoReview = webMethod(
  Permissions.SiteMember,
  async (productId, videoFileId, caption) => {
    try {
      const cleanProductId = validateId(productId);
      if (!cleanProductId) return { success: false, error: 'Valid product ID is required.' };

      if (!videoFileId || typeof videoFileId !== 'string') {
        return { success: false, error: 'Video file ID is required.' };
      }
      const cleanFileId = sanitize(videoFileId, 500);
      if (!cleanFileId || !isWixMediaUrl(cleanFileId)) {
        return { success: false, error: 'Invalid video file reference.' };
      }

      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Member not found.' };

      const cleanCaption = sanitize(caption || '', MAX_CAPTION_LEN);

      const inserted = await wixData.insert(VIDEO_REVIEWS_COLLECTION, {
        productId: cleanProductId,
        memberId: member._id,
        videoFileId: cleanFileId,
        caption: cleanCaption,
        status: 'pending',
        submittedAt: new Date(),
      });

      return { success: true, reviewId: inserted._id };
    } catch (err) {
      console.error('[reviewsService] submitVideoReview error:', err);
      return { success: false, error: 'Failed to submit video review.' };
    }
  }
);

/**
 * Get approved video reviews for a product.
 *
 * @function getVideoReviews
 * @param {string} productId
 * @param {Object} [opts]
 * @param {number} [opts.limit=12] - Max results (1–50).
 * @returns {Promise<{success: boolean, reviews: Array, totalCount?: number}>}
 * @permission Anyone
 */
export const getVideoReviews = webMethod(
  Permissions.Anyone,
  async (productId, opts = {}) => {
    try {
      const cleanId = validateId(productId);
      if (!cleanId) return { success: false, error: 'Valid product ID is required.', reviews: [] };

      const limit = Math.max(1, Math.min(50, Math.round(Number((opts || {}).limit) || 12)));

      const result = await wixData.query(VIDEO_REVIEWS_COLLECTION)
        .eq('productId', cleanId)
        .eq('status', 'approved')
        .descending('submittedAt')
        .limit(limit)
        .find();

      const reviews = result.items.map(r => ({
        _id: r._id,
        productId: r.productId,
        videoFileId: r.videoFileId,
        caption: r.caption || '',
        submittedAt: r.submittedAt,
      }));

      return { success: true, reviews, totalCount: result.totalCount };
    } catch (err) {
      console.error('[reviewsService] getVideoReviews error:', err);
      return { success: false, error: 'Failed to load video reviews.', reviews: [] };
    }
  }
);

// ── New video upload / fetch methods (CF-ou66.1) ─────────────────────────────

const MAX_VIDEO_DURATION_MS = 30_000; // 30 seconds
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

/**
 * Upload a video blob to Wix Media Manager and insert a VideoReviews record
 * with status=pending_moderation. Ownership is enforced via currentMember —
 * the caller-supplied memberId hint is overridden by the authenticated session ID.
 *
 * @param {string} productId
 * @param {string} _memberIdHint - Ignored; retained for backwards-compat call sites.
 * @param {Buffer|Blob} videoBlob - Raw video binary.
 * @param {number} durationMs - Video duration in ms. Must be ≤ 30 000.
 * @returns {Promise<{success: boolean, reviewId?: string, error?: string}>}
 */
export const uploadVideoReview = webMethod(
  Permissions.SiteMember,
  async (productId, _memberIdHint, videoBlob, durationMs) => {
    try {
      const cleanProductId = validateId(productId);
      if (!cleanProductId) return { success: false, error: 'Valid product ID is required.' };

      // Ownership guard — always derive memberId from the authenticated session
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Member not found.' };
      const memberId = member._id;

      if (typeof durationMs !== 'number' || isNaN(durationMs) || durationMs > MAX_VIDEO_DURATION_MS) {
        return { success: false, error: 'Video must be 30 seconds or less.' };
      }

      const blobSize = videoBlob?.size ?? videoBlob?.byteLength ?? 0;
      if (blobSize > MAX_VIDEO_BYTES) {
        return { success: false, error: 'Video file exceeds the 100 MB size limit.' };
      }

      // Duplicate check — one video review per member per product
      const existing = await wixData.query(VIDEO_REVIEWS_COLLECTION)
        .eq('productId', cleanProductId)
        .eq('memberId', memberId)
        .find();
      if (existing.items.length > 0) {
        return { success: false, error: 'A video review for this product already exists.' };
      }

      // Upload blob to Wix Media Manager
      let uploadResult;
      try {
        uploadResult = await mediaManager.upload(
          '/video-reviews/',
          videoBlob,
          `video_review_${cleanProductId}_${memberId}.mp4`,
        );
      } catch (uploadErr) {
        console.error('[reviewsService] uploadVideoReview upload failed:', uploadErr);
        return { success: false, error: 'Video upload failed. Please try again.' };
      }

      const inserted = await wixData.insert(VIDEO_REVIEWS_COLLECTION, {
        productId: cleanProductId,
        memberId,
        videoFileId: uploadResult.fileName,
        durationMs,
        status: 'pending_moderation',
        submittedAt: new Date(),
      });

      return { success: true, reviewId: inserted._id };
    } catch (err) {
      console.error('[reviewsService] uploadVideoReview error:', err);
      return { success: false, error: 'Failed to submit video review.' };
    }
  }
);

/**
 * Get approved video reviews for a product.
 *
 * @param {string} productId
 * @returns {Promise<{success: boolean, reviews: Array, error?: string}>}
 */
export const getVideoReviewsForProduct = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = validateId(productId);
      if (!cleanId) return { success: false, error: 'Valid product ID is required.', reviews: [] };

      const result = await wixData.query(VIDEO_REVIEWS_COLLECTION)
        .eq('productId', cleanId)
        .eq('status', 'approved')
        .descending('submittedAt')
        .find();

      return { success: true, reviews: result.items };
    } catch (err) {
      console.error('[reviewsService] getVideoReviewsForProduct error:', err);
      return { success: false, error: 'Failed to load video reviews.', reviews: [] };
    }
  }
);

/**
 * Approve or reject a video review. On approval, triggers badge award via gamification.
 *
 * @function moderateVideoReview
 * @param {string} reviewId - VideoReviews record ID.
 * @param {'approved'|'rejected'} action
 * @returns {Promise<{success: boolean, error?: string}>}
 * @permission Admin
 */
export const moderateVideoReview = webMethod(
  Permissions.Admin,
  async (reviewId, action) => {
    try {
      const cleanId = validateId(reviewId);
      if (!cleanId) return { success: false, error: 'Valid review ID is required.' };
      if (action !== 'approved' && action !== 'rejected') {
        return { success: false, error: "Action must be 'approved' or 'rejected'." };
      }

      const review = await wixData.get(VIDEO_REVIEWS_COLLECTION, cleanId);
      if (!review) return { success: false, error: 'Video review not found.' };

      await wixData.update(VIDEO_REVIEWS_COLLECTION, { ...review, status: action });

      if (action === 'approved' && review.memberId) {
        try {
          await receiveGamificationEvent('video_review_approved', { memberId: review.memberId });
        } catch (e) {
          console.error('[reviewsService] moderateVideoReview gamification trigger failed:', e?.message);
        }
      }

      return { success: true };
    } catch (err) {
      console.error('[reviewsService] moderateVideoReview error:', err);
      return { success: false, error: 'Failed to moderate video review.' };
    }
  }
);
