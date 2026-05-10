/**
 * @module dataService
 * @description Post-purchase review-request pipeline: schedule a review
 * request when an order completes (Day 7 default), surface pending
 * requests to admin tooling, and accept the customer's submission via
 * the email link.
 *
 * cf-4x7e Pass 2 chunk 6 retired the unrelated webMethods that used
 * to share this file (getBundlesForProduct, getActivePromotions,
 * trackEngagementEvent, getMyEngagementHistory, getVideos —
 * never wired; generateReferralCode + redeemReferralCode —
 * superseded by referralService.web.js). The remaining 3 methods
 * form a single review-request pipeline and stay together.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend - For member authentication
 * @requires backend/utils/rateLimit - Rate-limit submitReview per customerEmail
 * @requires backend/utils/auditLog  - Audit trail on review submission
 *
 * @setup
 * Requires CMS collection `ReviewRequests` with fields:
 *   orderId (Text), customerEmail (Text), productIds (Text),
 *   scheduledDate (Date), status (Text: 'pending' | 'completed'),
 *   rating (Number, nullable), reviewText (Text, nullable).
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logAuditEvent } from 'backend/utils/auditLog';

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

// ── scheduleReviewRequest ─────────────────────────────────────────────

/**
 * Schedule a review request to be sent to a customer some days after
 * order delivery. Called from `src/pages/Thank You Page.js`.
 *
 * @function scheduleReviewRequest
 * @param {Object} requestData
 * @param {string} requestData.orderId        — order id this request is for
 * @param {string} requestData.customerEmail  — recipient
 * @param {string} [requestData.productIds]   — products in the order (CSV)
 * @param {string} [requestData.scheduledDate] — ISO date; defaults to T+7d
 * @returns {Promise<{success: boolean, requestId?: string}>}
 * @permission SiteMember
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

// ── getPendingReviewRequests ──────────────────────────────────────────

/**
 * Get pending review requests with a scheduledDate in the past
 * (i.e. ready to be sent). For admin batch-send processing.
 *
 * @function getPendingReviewRequests
 * @returns {Promise<Array>}
 * @permission Admin
 */
export const getPendingReviewRequests = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await wixData.query('ReviewRequests')
        .eq('status', 'pending')
        .le('scheduledDate', new Date())
        .find();
      return result.items;
    } catch (err) {
      console.error('Error fetching pending review requests:', err);
      return [];
    }
  }
);

// ── submitReview ──────────────────────────────────────────────────────

/**
 * Customer submission for a previously-scheduled review request.
 * Looks up the request by id, records the rating + reviewText, and
 * marks the request completed. Permission is `Anyone` because the
 * customer hits this from a tokenized email link, not while logged in.
 *
 * @function submitReview
 * @param {string} requestId    — ReviewRequests record id
 * @param {number} rating       — 1–5
 * @param {string} reviewText   — body, sanitized + length-capped
 * @returns {Promise<{success: boolean, error?: string}>}
 * @permission Anyone
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

      if (!record.customerEmail) throw new Error('Review request has no customer email.');

      // Rate-limit by the customer email on the review request record
      const { allowed } = await checkRateLimit('ReviewRateLimit', record.customerEmail);
      if (!allowed) return { success: false, error: 'Too many submissions. Please try again later.' };

      record.status = 'completed';
      record.rating = rating;
      record.reviewText = sanitize(reviewText, 5000);
      await wixData.update('ReviewRequests', record);

      logAuditEvent('ReviewRequests', 'submit_review', record.customerEmail, { rating });
      return { success: true };
    } catch (err) {
      console.error('Error submitting review:', err);
      return { success: false };
    }
  }
);
