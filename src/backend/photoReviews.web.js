/**
 * @module photoReviews
 * @description Customer photo reviews with moderation and gallery display.
 * Customers submit product photos with star ratings and text reviews.
 * Admin moderation queue for approval. Gallery display on product pages.
 *
 * cf-4x7e Pass 2 chunk 15 retired the read / engagement / dashboard
 * surface (getPhotoReviews, markHelpful, reportPhotoReview,
 * getPendingReviews, getPhotoReviewStats — all PATH-ONLY per detector
 * v3.2; markHelpful + getPendingReviews were also cross-file
 * name-collision FPs against reviewsService.web.js's own webMethods of
 * the same name). Kept the live submit endpoint and the two
 * gallery/moderation methods Stilgar flagged for the unfinished UGC
 * gallery feature.
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
import { receiveGamificationEvent } from 'backend/gamificationEventReceiver.web';

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

      const rawPhotoUrl = (data.photoUrl || '').trim();
      if (!rawPhotoUrl) {
        return { success: false, error: 'Photo is required for photo reviews.' };
      }

      // CF-rr8d: Validate BEFORE sanitize — sanitize() strips HTML tags which
      // could transform a crafted URL into one that passes validation.
      if (!isWixMediaUrl(rawPhotoUrl)) {
        return { success: false, error: 'Photo must be uploaded through the site upload form.' };
      }

      const photoUrl = sanitize(rawPhotoUrl, 500);

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

      // Fire gamification event — non-blocking; failure must never break the submit
      receiveGamificationEvent(
        'gamification_submit_review',
        { has_photo: true },
        memberId,
      ).catch(err => console.warn('[photoReviews] gamification event failed:', err));

      return { success: true, id: inserted._id };
    } catch (err) {
      console.error('[photoReviews] Error submitting photo review:', err);
      return { success: false, error: 'Failed to submit photo review.' };
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

