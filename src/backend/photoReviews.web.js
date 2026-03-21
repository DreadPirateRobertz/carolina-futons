/**
 * @module photoReviews
 * @description Customer photo reviews with moderation and gallery display.
 * Customers submit product photos with star ratings and text reviews.
 * Admin moderation queue for approval. Gallery display on product pages.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `PhotoReviews` with fields:
 *   memberId (Text, indexed) - Reviewer member ID
 *   productId (Text, indexed) - Product being reviewed
 *   productName (Text) - Product display name
 *   productCategory (Text, indexed) - Product category slug
 *   reviewText (Text) - Review text (max 2000 chars)
 *   rating (Number) - 1-5 star rating
 *   photoUrl (Image) - Uploaded photo URL (Wix media)
 *   photoCaption (Text) - Optional photo caption (max 200 chars)
 *   status (Text, indexed) - 'pending'|'approved'|'rejected'|'featured'
 *   submittedAt (Date, indexed) - When review was submitted
 *   moderatedAt (Date) - When review was moderated
 *   moderatedBy (Text) - Admin who moderated
 *   helpfulCount (Number) - How many found this helpful
 *   reportCount (Number) - Abuse reports
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId, isWixMediaUrl } from 'backend/utils/sanitize';

async function requireMember() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return member._id;
}

/**
 * Submit a photo review for a product.
 *
 * @param {Object} data
 * @param {string} data.productId - Product ID being reviewed.
 * @param {string} data.productName - Product display name.
 * @param {string} [data.productCategory] - Product category.
 * @param {string} data.reviewText - Review text (min 10, max 2000 chars).
 * @param {number} data.rating - 1-5 star rating.
 * @param {string} data.photoUrl - Photo URL (Wix media upload).
 * @param {string} [data.photoCaption] - Optional caption.
 * @returns {Promise<{success: boolean, id?: string}>}
 */
export const submitPhotoReview = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      const productId = validateId(data.productId);
      if (!productId) {
        return { success: false, error: 'Valid product ID is required.' };
      }

      const reviewText = sanitize(data.reviewText, 2000);
      if (!reviewText || reviewText.length < 10) {
        return { success: false, error: 'Review must be at least 10 characters.' };
      }

      const photoUrl = sanitize(data.photoUrl || '', 500);
      if (!photoUrl) {
        return { success: false, error: 'Photo is required for photo reviews.' };
      }

      // CF-rr8d: Only accept Wix Media Manager URLs — reject external URLs
      // that could serve malicious content or leak EXIF metadata.
      if (!isWixMediaUrl(photoUrl)) {
        return { success: false, error: 'Photo must be uploaded through the site upload form.' };
      }

      const rating = Math.min(5, Math.max(1, Math.round(Number(data.rating) || 5)));

      const record = {
        memberId,
        productId,
        productName: sanitize(data.productName || '', 200),
        productCategory: sanitize(data.productCategory || '', 100),
        reviewText,
        rating,
        photoUrl,
        photoCaption: sanitize(data.photoCaption || '', 200),
        status: 'pending',
        submittedAt: new Date(),
        moderatedAt: null,
        moderatedBy: '',
        helpfulCount: 0,
        reportCount: 0,
      };

      const inserted = await wixData.insert('PhotoReviews', record);
      return { success: true, id: inserted._id };
    } catch (err) {
      console.error('[photoReviews] Error submitting photo review:', err);
      return { success: false, error: 'Failed to submit photo review.' };
    }
  }
);

/**
 * Get approved photo reviews for a product. Used on product pages.
 *
 * @param {string} productId - Product ID.
 * @param {number} [limit=10] - Max reviews to return.
 * @param {string} [sort='recent'] - Sort order: 'recent'|'helpful'|'highest'
 * @returns {Promise<{success: boolean, reviews: Array, totalCount: number}>}
 */
export const getPhotoReviews = webMethod(
  Permissions.Anyone,
  async (productId, limit = 10, sort = 'recent') => {
    try {
      const cleanId = validateId(productId);
      if (!cleanId) {
        return { success: false, error: 'Valid product ID is required.', reviews: [], totalCount: 0 };
      }

      const maxResults = Math.max(1, Math.min(50, Math.round(Number(limit) || 10)));

      let query = wixData.query('PhotoReviews')
        .eq('productId', cleanId)
        .hasSome('status', ['approved', 'featured']);

      const sortType = sanitize(sort, 20);
      if (sortType === 'helpful') {
        query = query.descending('helpfulCount');
      } else if (sortType === 'highest') {
        query = query.descending('rating');
      } else {
        query = query.descending('submittedAt');
      }

      const result = await query.limit(maxResults).find();

      const reviews = result.items.map(item => ({
        _id: item._id,
        productId: item.productId,
        reviewText: item.reviewText,
        rating: item.rating,
        photoUrl: item.photoUrl,
        photoCaption: item.photoCaption,
        status: item.status,
        submittedAt: item.submittedAt,
        helpfulCount: item.helpfulCount || 0,
      }));

      return { success: true, reviews, totalCount: result.totalCount || result.items.length };
    } catch (err) {
      console.error('[photoReviews] Error getting photo reviews:', err);
      return { success: false, error: 'Failed to load reviews.', reviews: [], totalCount: 0 };
    }
  }
);

// Valid status transitions for photo review moderation
const PHOTO_STATUS_TRANSITIONS = {
  pending:  ['approved', 'rejected', 'featured'],
  approved: ['featured', 'rejected'],
  featured: ['approved', 'rejected'],
  rejected: ['pending'],  // Can re-queue rejected reviews for another look
};

/**
 * Moderate a photo review (approve, reject, or feature).
 * Enforces valid status transitions to prevent workflow corruption.
 * Admin only.
 *
 * @param {string} reviewId - Review ID to moderate.
 * @param {string} action - 'approve'|'reject'|'feature'
 * @returns {Promise<{success: boolean, previousStatus?: string, newStatus?: string, error?: string}>}
 */
export const moderatePhotoReview = webMethod(
  Permissions.Admin,
  async (reviewId, action) => {
    try {
      const memberId = await requireMember();

      const cleanId = validateId(reviewId);
      if (!cleanId) {
        return { success: false, error: 'Valid review ID is required.' };
      }

      const validActions = ['approve', 'reject', 'feature'];
      const cleanAction = sanitize(action, 20);
      if (!validActions.includes(cleanAction)) {
        return { success: false, error: 'Invalid action. Must be approve, reject, or feature.' };
      }

      const statusMap = { approve: 'approved', reject: 'rejected', feature: 'featured' };

      const existing = await wixData.get('PhotoReviews', cleanId);
      if (!existing) {
        return { success: false, error: 'Review not found.' };
      }

      const currentStatus = existing.status || 'pending';
      const newStatus = statusMap[cleanAction];
      const allowed = PHOTO_STATUS_TRANSITIONS[currentStatus];

      if (!allowed || !allowed.includes(newStatus)) {
        console.warn(`[photoReviews] Blocked transition: ${cleanId} ${currentStatus} → ${newStatus} by ${memberId}`);
        return {
          success: false,
          error: `Cannot ${cleanAction} a review with status '${currentStatus}'.`,
        };
      }

      const previousStatus = currentStatus;
      existing.status = newStatus;
      existing.moderatedAt = new Date();
      existing.moderatedBy = memberId;

      await wixData.update('PhotoReviews', existing);
      return { success: true, previousStatus, newStatus };
    } catch (err) {
      console.error('[photoReviews] Error moderating review:', err);
      return { success: false, error: 'Failed to moderate review.' };
    }
  }
);

/**
 * Get photo gallery across all products or a specific category.
 * Returns featured/approved photos for a masonry-style gallery display.
 *
 * @param {string} [category] - Optional category filter.
 * @param {number} [limit=20] - Max photos to return.
 * @returns {Promise<{success: boolean, photos: Array}>}
 */
export const getPhotoGallery = webMethod(
  Permissions.Anyone,
  async (category, limit = 20) => {
    try {
      const maxResults = Math.max(1, Math.min(50, Math.round(Number(limit) || 20)));

      let query = wixData.query('PhotoReviews')
        .hasSome('status', ['approved', 'featured'])
        .descending('submittedAt')
        .limit(maxResults);

      if (category) {
        query = query.eq('productCategory', sanitize(category, 100));
      }

      const result = await query.find();

      const photos = result.items.map(item => ({
        _id: item._id,
        photoUrl: item.photoUrl,
        photoCaption: item.photoCaption,
        productId: item.productId,
        productName: item.productName,
        productCategory: item.productCategory,
        rating: item.rating,
        reviewText: (item.reviewText || '').slice(0, 100),
        featured: item.status === 'featured',
      }));

      return { success: true, photos };
    } catch (err) {
      console.error('[photoReviews] Error getting photo gallery:', err);
      return { success: false, error: 'Failed to load gallery.', photos: [] };
    }
  }
);

// ── UGC engagement helpers ──────────────────────────────────────────────────

// Closed set prevents arbitrary strings reaching the DB and enables future UI localization.
const VALID_REPORT_REASONS = ['inappropriate', 'spam', 'fake', 'offensive', 'other'];
// Number of reports required to automatically demote a review back to pending for re-moderation.
const REPORT_ESCALATION_THRESHOLD = 5;

/**
 * Mark a photo review as helpful. Requires authentication; cannot vote on own review.
 * Only approved/featured reviews are eligible.
 *
 * @param {string} reviewId - Review ID.
 * @returns {Promise<{success: boolean, helpfulCount?: number, error?: string}>}
 */
export const markHelpful = webMethod(
  Permissions.SiteMember,
  async (reviewId) => {
    try {
      const memberId = await requireMember();

      const cleanId = validateId(reviewId);
      if (!cleanId) {
        return { success: false, error: 'Valid review ID is required.' };
      }

      const review = await wixData.get('PhotoReviews', cleanId);
      if (!review) {
        return { success: false, error: 'Review not found.' };
      }

      if (review.memberId === memberId) {
        return { success: false, error: 'Cannot mark own review as helpful.' };
      }

      if (!['approved', 'featured'].includes(review.status)) {
        return { success: false, error: 'Review not available for helpful votes.' };
      }

      const helpfulCount = (review.helpfulCount || 0) + 1;
      await wixData.update('PhotoReviews', { ...review, helpfulCount });
      return { success: true, helpfulCount };
    } catch (err) {
      console.error('[photoReviews] Error marking review helpful:', err);
      return { success: false, error: 'Failed to mark review helpful.' };
    }
  }
);

/**
 * Report a photo review for moderation. Escalates to pending when report threshold is reached.
 *
 * @param {string} reviewId - Review ID.
 * @param {string} reason - Report reason: inappropriate|spam|fake|offensive|other
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const reportPhotoReview = webMethod(
  Permissions.SiteMember,
  async (reviewId, reason) => {
    try {
      await requireMember();

      const cleanId = validateId(reviewId);
      if (!cleanId) {
        return { success: false, error: 'Valid review ID is required.' };
      }

      const cleanReason = typeof reason === 'string' ? reason.trim() : '';
      if (!VALID_REPORT_REASONS.includes(cleanReason)) {
        return { success: false, error: `Invalid reason. Must be one of: ${VALID_REPORT_REASONS.join(', ')}.` };
      }

      const review = await wixData.get('PhotoReviews', cleanId);
      if (!review) {
        return { success: false, error: 'Review not found.' };
      }

      const reportCount = (review.reportCount || 0) + 1;
      const update = { ...review, reportCount };

      if (reportCount >= REPORT_ESCALATION_THRESHOLD) {
        update.status = 'pending';
      }

      await wixData.update('PhotoReviews', update);
      return { success: true };
    } catch (err) {
      console.error('[photoReviews] Error reporting review:', err);
      return { success: false, error: 'Failed to report review.' };
    }
  }
);

/**
 * Get pending photo reviews for admin moderation queue.
 * Returns oldest first (submittedAt ascending) so oldest reviews get attention first.
 * Access is enforced by Permissions.Admin at the Wix platform level.
 *
 * @param {number} [limit=50] - Max reviews to return (clamped 1–200).
 * @returns {Promise<{success: boolean, reviews: Array, totalCount: number, error?: string}>}
 */
export const getPendingReviews = webMethod(
  Permissions.Admin,
  async (limit = 50) => {
    try {
      const maxResults = Math.max(1, Math.min(200, Math.round(Number(limit) || 50)));

      const result = await wixData.query('PhotoReviews')
        .eq('status', 'pending')
        .ascending('submittedAt')
        .limit(maxResults)
        .find();

      const reviews = result.items.map(item => ({
        _id: item._id,
        productId: item.productId,
        productName: item.productName,
        reviewText: item.reviewText,
        rating: item.rating,
        photoUrl: item.photoUrl,
        status: item.status,
        submittedAt: item.submittedAt,
        reportCount: item.reportCount || 0,
      }));

      return { success: true, reviews, totalCount: result.totalCount };
    } catch (err) {
      console.error('[photoReviews] Error getting pending reviews:', err);
      return { success: false, error: 'Failed to load pending reviews.', reviews: [], totalCount: 0 };
    }
  }
);

/**
 * Get review statistics for a product (average rating, count by star, photo count).
 *
 * @param {string} productId - Product ID.
 * @returns {Promise<{success: boolean, stats: Object}>}
 */
export const getPhotoReviewStats = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = validateId(productId);
      if (!cleanId) {
        return { success: false, error: 'Valid product ID is required.', stats: null };
      }

      const result = await wixData.query('PhotoReviews')
        .eq('productId', cleanId)
        .hasSome('status', ['approved', 'featured'])
        .limit(200)
        .find();

      const reviews = result.items;
      if (reviews.length === 0) {
        return {
          success: true,
          stats: {
            totalReviews: 0,
            averageRating: 0,
            photoCount: 0,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            featuredCount: 0,
          },
        };
      }

      // Skip null/NaN ratings to prevent corrupted aggregation
      const validReviews = reviews.filter(r => r.rating != null && !isNaN(Number(r.rating)));
      if (validReviews.length < reviews.length) {
        console.warn(`[photoReviews] Skipped ${reviews.length - validReviews.length} photo reviews with invalid ratings for product ${cleanId}`);
      }

      const photoCount = reviews.filter(r => r.photoUrl).length;
      const featuredCount = reviews.filter(r => r.status === 'featured').length;

      if (validReviews.length === 0) {
        return {
          success: true,
          stats: {
            totalReviews: 0, averageRating: 0, photoCount,
            ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, featuredCount,
          },
        };
      }

      const totalRating = validReviews.reduce((sum, r) => sum + Math.min(5, Math.max(1, Math.round(Number(r.rating)))), 0);

      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of validReviews) {
        const star = Math.min(5, Math.max(1, Math.round(Number(r.rating))));
        distribution[star]++;
      }

      return {
        success: true,
        stats: {
          totalReviews: validReviews.length,
          averageRating: Math.round((totalRating / validReviews.length) * 10) / 10,
          photoCount,
          ratingDistribution: distribution,
          featuredCount,
        },
      };
    } catch (err) {
      console.error('[photoReviews] Error getting review stats:', err);
      return { success: false, error: 'Failed to load review stats.', stats: null };
    }
  }
);
