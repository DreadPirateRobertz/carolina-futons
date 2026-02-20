/**
 * @module dataService
 * @description Centralized backend data access layer for custom CMS collections.
 * All engagement data (bundles, promotions, customer events, reviews, referrals,
 * videos) flows through this module's server-side web methods.
 *
 * SECURITY: Frontend code imports these methods — it never queries CMS directly.
 * Write operations require site member authentication. All string inputs are
 * sanitized before CMS writes.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend - For member authentication on write operations
 *
 * @setup
 * Create these CMS collections in Wix Dashboard before use:
 * - ProductBundles, Promotions, CustomerEngagement, ReviewRequests,
 *   ReferralCodes, Videos
 * See field definitions in the bead spec (cf-7sr).
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

// ─── Input Sanitization ────────────────────────────────────────────

/**
 * Strip HTML tags and limit string length to prevent injection and abuse.
 * @param {string} str - Raw input string.
 * @param {number} [maxLen=1000] - Maximum allowed length.
 * @returns {string} Sanitized string.
 */
function sanitize(str, maxLen = 1000) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
}

/**
 * Get the currently logged-in member's ID.
 * Throws if no member is authenticated.
 * @returns {Promise<string>} The member ID.
 */
async function requireMember() {
  const member = await currentMember.getMember();
  if (!member || !member._id) {
    throw new Error('Authentication required.');
  }
  return member._id;
}

// ═══════════════════════════════════════════════════════════════════
// PRODUCT BUNDLES
// Powers "Frequently Bought Together" on PDP
// ═══════════════════════════════════════════════════════════════════

/**
 * Get active bundles for a product.
 * @param {string} productId - The product to find bundles for.
 * @returns {Promise<Array>} Active bundles with bundled product IDs.
 */
export const getBundlesForProduct = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      if (!productId) return [];

      const results = await wixData.query('ProductBundles')
        .eq('primaryProductId', sanitize(productId, 100))
        .eq('isActive', true)
        .find();

      return results.items.map(item => ({
        bundleId: item.bundleId,
        bundleName: item.bundleName,
        bundledProductIds: (item.bundledProductIds || '').split(',').map(id => id.trim()).filter(Boolean),
        discountPercent: item.discountPercent || 5,
      }));
    } catch (err) {
      console.error('Error fetching bundles:', err);
      return [];
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// PROMOTIONS
// Powers holiday/event lightboxes
// ═══════════════════════════════════════════════════════════════════

/**
 * Get currently active promotions (start <= now <= end, isActive).
 * @returns {Promise<Array>} Active promotions sorted by startDate descending.
 */
export const getActivePromotions = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const now = new Date();

      const results = await wixData.query('Promotions')
        .eq('isActive', true)
        .le('startDate', now)
        .ge('endDate', now)
        .descending('startDate')
        .find();

      return results.items.map(item => ({
        title: item.title,
        subtitle: item.subtitle,
        theme: item.theme,
        heroImage: item.heroImage,
        discountCode: item.discountCode,
        discountPercent: item.discountPercent,
        ctaUrl: item.ctaUrl,
        ctaText: item.ctaText,
        productIds: (item.productIds || '').split(',').map(id => id.trim()).filter(Boolean),
        startDate: item.startDate,
        endDate: item.endDate,
      }));
    } catch (err) {
      console.error('Error fetching promotions:', err);
      return [];
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// CUSTOMER ENGAGEMENT
// Unified engagement tracking for personalization
// ═══════════════════════════════════════════════════════════════════

/**
 * Track a customer engagement event. Write-only — requires site member.
 * @param {Object} eventData - The engagement event.
 * @param {string} eventData.eventType - One of: page_view, add_to_cart, wishlist_add, quiz_complete, swatch_request.
 * @param {string} [eventData.productId] - Associated product ID.
 * @param {string} [eventData.metadata] - JSON string of additional event data.
 * @param {string} [eventData.sessionId] - Browser session identifier.
 * @returns {Promise<{success: boolean}>}
 */
export const trackEngagementEvent = webMethod(
  Permissions.SiteMember,
  async (eventData) => {
    try {
      const memberId = await requireMember();

      const validTypes = ['page_view', 'add_to_cart', 'wishlist_add', 'quiz_complete', 'swatch_request'];
      const eventType = sanitize(eventData?.eventType, 50);
      if (!validTypes.includes(eventType)) {
        throw new Error(`Invalid event type: ${eventType}`);
      }

      await wixData.insert('CustomerEngagement', {
        memberId,
        eventType,
        productId: eventData?.productId ? sanitize(eventData.productId, 100) : '',
        metadata: sanitize(eventData?.metadata, 2000),
        timestamp: new Date(),
        sessionId: sanitize(eventData?.sessionId, 100),
      });

      return { success: true };
    } catch (err) {
      console.error('Error tracking engagement:', err);
      return { success: false };
    }
  }
);

/**
 * Get engagement history for the current member. Read — requires site member.
 * @param {string} [eventType] - Filter by event type (optional).
 * @param {number} [limit=20] - Max results.
 * @returns {Promise<Array>} Engagement events sorted by timestamp descending.
 */
export const getMyEngagementHistory = webMethod(
  Permissions.SiteMember,
  async (eventType, limit = 20) => {
    try {
      const memberId = await requireMember();

      let query = wixData.query('CustomerEngagement')
        .eq('memberId', memberId)
        .descending('timestamp')
        .limit(Math.min(limit, 100));

      if (eventType) {
        query = query.eq('eventType', sanitize(eventType, 50));
      }

      const results = await query.find();

      return results.items.map(item => ({
        eventType: item.eventType,
        productId: item.productId,
        metadata: item.metadata,
        timestamp: item.timestamp,
        sessionId: item.sessionId,
      }));
    } catch (err) {
      console.error('Error fetching engagement history:', err);
      return [];
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// REVIEW REQUESTS
// Review request scheduling and collection
// ═══════════════════════════════════════════════════════════════════

/**
 * Schedule a review request for a completed order (admin/backend use).
 * @param {Object} requestData
 * @param {string} requestData.orderId
 * @param {string} requestData.customerEmail
 * @param {string} requestData.productIds - Comma-separated product IDs.
 * @param {Date} [requestData.scheduledDate] - When to send (defaults to 7 days out).
 * @returns {Promise<{success: boolean, requestId?: string}>}
 */
export const scheduleReviewRequest = webMethod(
  Permissions.SiteMember,
  async (requestData) => {
    try {
      await requireMember();

      if (!requestData?.orderId || !requestData?.customerEmail) {
        throw new Error('orderId and customerEmail are required.');
      }

      const scheduledDate = requestData.scheduledDate
        ? new Date(requestData.scheduledDate)
        : new Date(Date.now() + 7 * 86400000);

      const inserted = await wixData.insert('ReviewRequests', {
        orderId: sanitize(requestData.orderId, 100),
        customerEmail: sanitize(requestData.customerEmail, 254),
        productIds: sanitize(requestData.productIds, 500),
        scheduledDate,
        status: 'pending',
        rating: null,
        reviewText: null,
      });

      return { success: true, requestId: inserted._id };
    } catch (err) {
      console.error('Error scheduling review request:', err);
      return { success: false };
    }
  }
);

/**
 * Get pending review requests (for admin batch-send processing).
 * @returns {Promise<Array>} Pending requests with scheduledDate <= now.
 */
export const getPendingReviewRequests = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      await requireMember();

      const now = new Date();
      const results = await wixData.query('ReviewRequests')
        .eq('status', 'pending')
        .le('scheduledDate', now)
        .find();

      return results.items.map(item => ({
        _id: item._id,
        orderId: item.orderId,
        customerEmail: item.customerEmail,
        productIds: item.productIds,
        scheduledDate: item.scheduledDate,
      }));
    } catch (err) {
      console.error('Error fetching pending reviews:', err);
      return [];
    }
  }
);

/**
 * Submit a review for a review request.
 * @param {string} requestId - The ReviewRequests record ID.
 * @param {number} rating - Rating 1-5.
 * @param {string} reviewText - The review content.
 * @returns {Promise<{success: boolean}>}
 */
export const submitReview = webMethod(
  Permissions.Anyone,
  async (requestId, rating, reviewText) => {
    try {
      if (!requestId) throw new Error('requestId is required.');

      // Sanitize requestId — only allow valid Wix ID characters
      const cleanId = sanitize(requestId, 50).replace(/[^a-zA-Z0-9_-]/g, '');
      if (!cleanId) throw new Error('Invalid requestId format.');

      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5.');
      }

      const record = await wixData.get('ReviewRequests', cleanId);
      if (!record) throw new Error('Review request not found.');

      record.status = 'completed';
      record.rating = rating;
      record.reviewText = sanitize(reviewText, 5000);
      await wixData.update('ReviewRequests', record);

      return { success: true };
    } catch (err) {
      console.error('Error submitting review:', err);
      return { success: false };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// REFERRAL CODES
// Referral program tracking
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate a referral code for the current member.
 * @returns {Promise<{success: boolean, code?: string}>}
 */
export const generateReferralCode = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const memberId = await requireMember();

      // Check if member already has a code
      const existing = await wixData.query('ReferralCodes')
        .eq('memberId', memberId)
        .find();

      if (existing.items.length > 0) {
        return { success: true, code: existing.items[0].code };
      }

      // Generate unique code: CF-<first 8 chars of memberId uppercase>
      const code = 'CF-' + memberId.replace(/-/g, '').slice(0, 8).toUpperCase();

      await wixData.insert('ReferralCodes', {
        code,
        memberId,
        discountPercent: 10,
        usedBy: '',
        usedAt: null,
        creditAmount: 25,
      });

      return { success: true, code };
    } catch (err) {
      console.error('Error generating referral code:', err);
      return { success: false };
    }
  }
);

/**
 * Validate and redeem a referral code.
 * @param {string} code - The referral code to redeem.
 * @returns {Promise<{valid: boolean, discountPercent?: number}>}
 */
export const redeemReferralCode = webMethod(
  Permissions.SiteMember,
  async (code) => {
    try {
      const memberId = await requireMember();

      if (!code) return { valid: false };

      const results = await wixData.query('ReferralCodes')
        .eq('code', sanitize(code, 20))
        .find();

      if (results.items.length === 0) return { valid: false };

      const referral = results.items[0];

      // Can't use your own code
      if (referral.memberId === memberId) return { valid: false };

      // Already redeemed
      if (referral.usedBy) return { valid: false };

      // Mark as redeemed
      referral.usedBy = memberId;
      referral.usedAt = new Date();
      await wixData.update('ReferralCodes', referral);

      return { valid: true, discountPercent: referral.discountPercent };
    } catch (err) {
      console.error('Error redeeming referral code:', err);
      return { valid: false };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════
// VIDEOS
// Video content management for embedded players
// ═══════════════════════════════════════════════════════════════════

/**
 * Get videos, optionally filtered by category or product.
 * @param {Object} [filters]
 * @param {string} [filters.category] - Filter by category (futon/murphy/platform/general).
 * @param {string} [filters.productId] - Filter by associated product.
 * @param {boolean} [filters.featuredOnly] - Only return featured videos.
 * @param {number} [filters.limit=12] - Max results.
 * @returns {Promise<Array>} Videos sorted by viewCount descending.
 */
export const getVideos = webMethod(
  Permissions.Anyone,
  async (filters) => {
    try {
      let query = wixData.query('Videos')
        .descending('viewCount');

      if (filters?.category) {
        query = query.eq('category', sanitize(filters.category, 50));
      }
      if (filters?.productId) {
        query = query.eq('productId', sanitize(filters.productId, 100));
      }
      if (filters?.featuredOnly) {
        query = query.eq('isFeatured', true);
      }

      query = query.limit(Math.min(filters?.limit || 12, 50));

      const results = await query.find();

      return results.items.map(item => ({
        _id: item._id,
        title: item.title,
        videoUrl: item.videoUrl,
        thumbnail: item.thumbnail,
        productId: item.productId,
        category: item.category,
        duration: item.duration,
        viewCount: item.viewCount,
        isFeatured: item.isFeatured,
      }));
    } catch (err) {
      console.error('Error fetching videos:', err);
      return [];
    }
  }
);

/**
 * Increment a video's view count.
 * @param {string} videoId - The Videos record ID.
 * @returns {Promise<void>}
 */
export const trackVideoView = webMethod(
  Permissions.Anyone,
  async (videoId) => {
    try {
      if (!videoId) return;

      const record = await wixData.get('Videos', videoId);
      if (!record) return;

      record.viewCount = (record.viewCount || 0) + 1;
      await wixData.update('Videos', record);
    } catch (err) {
      console.error('Error tracking video view:', err);
    }
  }
);
