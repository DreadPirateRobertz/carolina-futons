/**
 * @module tradeInService
 * @description Trade-in / Trade-up program backend for Carolina Futons.
 * Customers submit trade-in requests online; staff confirms condition
 * in-store and issues store credit toward a new purchase.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires backend/utils/sanitize
 * @requires backend/storeCreditService.web
 *
 * @setup
 * Create 'TradeInRequests' CMS collection with fields:
 *   memberId (Text, indexed), firstName (Text), lastName (Text),
 *   email (Text, indexed), phone (Text),
 *   itemType (Text: 'frame'|'mattress'), itemAge (Number),
 *   submittedCondition (Text: 'good'|'fair'|'poor'),
 *   photoUrls (Text — JSON array of upload URLs),
 *   estimatedCreditMin (Number), estimatedCreditMax (Number),
 *   status (Text: 'pending'|'confirmed'|'rejected'|'credited'),
 *   confirmedCondition (Text), issuedCreditAmount (Number),
 *   storeCreditId (Text), staffNotes (Text),
 *   submittedAt (Date), confirmedAt (Date)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateEmail, validateId } from 'backend/utils/sanitize';
import { issueStoreCredit } from 'backend/storeCreditService.web';

// ── Constants ──────────────────────────────────────────────────────

const COLLECTION = 'TradeInRequests';

/**
 * Condition-based credit values per item type.
 * Mattress in 'poor' condition is ineligible for hygiene reasons.
 */
const VALUATION_MATRIX = {
  frame:    { good: 75, fair: 50, poor: 25 },
  mattress: { good: 40, fair: 25, poor: 0 },
};

const VALID_ITEM_TYPES  = Object.keys(VALUATION_MATRIX);
const VALID_CONDITIONS  = ['good', 'fair', 'poor'];
const VALID_STATUSES    = ['pending', 'confirmed', 'rejected', 'credited'];
const MAX_PHOTOS        = 5;
const MAX_PHOTO_URL_LEN = 500;
const MAX_AGE_YEARS     = 50;
const MAX_STAFF_NOTES   = 1000;
const MSG_MATTRESS_HYGIENE = 'Mattresses in poor condition are not eligible for trade-in due to hygiene requirements.';
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 50;

// ── Helpers ────────────────────────────────────────────────────────

function getValuation(itemType, condition) {
  const row = VALUATION_MATRIX[itemType];
  if (!row) return { creditMin: 0, creditMax: 0, eligible: false };

  const credit = row[condition] ?? 0;
  if (credit === 0) return { creditMin: 0, creditMax: 0, eligible: false };

  // Show a small range: exact value ± 10% (rounded to nearest $5) as estimate
  const offset = Math.round((credit * 0.1) / 5) * 5;
  return {
    creditMin: Math.max(0, credit - offset),
    creditMax: credit + offset,
    eligible: true,
    baseCredit: credit,
  };
}

async function getMember() {
  try {
    return await currentMember.getMember();
  } catch {
    return null;
  }
}

// ── Public API (Anyone) ────────────────────────────────────────────

/**
 * Get the estimated credit range for a trade-in item.
 * Called client-side on the trade-in form to show live estimates.
 *
 * @function getTradeInValuation
 * @param {string} itemType - 'frame' or 'mattress'
 * @param {string} condition - 'good', 'fair', or 'poor'
 * @returns {Promise<{success: boolean, eligible?: boolean, creditMin?: number, creditMax?: number, message?: string}>}
 * @permission Anyone
 */
export const getTradeInValuation = webMethod(
  Permissions.Anyone,
  async (itemType, condition) => {
    try {
      const type = sanitize(itemType || '', 20).toLowerCase();
      const cond = sanitize(condition || '', 10).toLowerCase();

      if (!VALID_ITEM_TYPES.includes(type)) {
        return { success: false, message: `Item type must be one of: ${VALID_ITEM_TYPES.join(', ')}` };
      }
      if (!VALID_CONDITIONS.includes(cond)) {
        return { success: false, message: `Condition must be one of: ${VALID_CONDITIONS.join(', ')}` };
      }

      const val = getValuation(type, cond);

      if (!val.eligible) {
        return {
          success: true,
          eligible: false,
          message: type === 'mattress' && cond === 'poor'
            ? MSG_MATTRESS_HYGIENE
            : 'This item is not eligible for trade-in.',
        };
      }

      return {
        success: true,
        eligible: true,
        creditMin: val.creditMin,
        creditMax: val.creditMax,
        message: `Estimated trade-in credit: $${val.creditMin}–$${val.creditMax}. Final value confirmed in-store.`,
      };
    } catch (err) {
      console.error('[tradeInService] Error getting valuation:', err);
      return { success: false, message: 'Failed to calculate valuation.' };
    }
  }
);

/**
 * Submit a trade-in request. Can be submitted by guests (anyone) or members.
 * If a member is logged in, their memberId is attached automatically.
 *
 * @function submitTradeInRequest
 * @param {Object} data
 * @param {string} data.firstName
 * @param {string} data.lastName
 * @param {string} data.email
 * @param {string} [data.phone]
 * @param {string} data.itemType - 'frame' or 'mattress'
 * @param {string} data.submittedCondition - 'good', 'fair', or 'poor'
 * @param {number} [data.itemAge] - Item age in years
 * @param {string[]} [data.photoUrls] - Upload URLs for item photos
 * @returns {Promise<{success: boolean, requestId?: string, creditMin?: number, creditMax?: number, message?: string}>}
 * @permission Anyone
 */
export const submitTradeInRequest = webMethod(
  Permissions.Anyone,
  async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Request data is required.' };
      }

      const firstName = sanitize(data.firstName || '', 100).trim();
      const lastName  = sanitize(data.lastName  || '', 100).trim();
      const email     = sanitize(data.email || '', 254).toLowerCase().trim();
      const phone     = sanitize(data.phone || '', 30).trim();

      if (!firstName) return { success: false, message: 'First name is required.' };
      if (!lastName)  return { success: false, message: 'Last name is required.' };
      if (!validateEmail(email)) return { success: false, message: 'Valid email address is required.' };

      const itemType = sanitize(data.itemType || '', 20).toLowerCase();
      const condition = sanitize(data.submittedCondition || '', 10).toLowerCase();

      if (!VALID_ITEM_TYPES.includes(itemType)) {
        return { success: false, message: `Item type must be one of: ${VALID_ITEM_TYPES.join(', ')}` };
      }
      if (!VALID_CONDITIONS.includes(condition)) {
        return { success: false, message: `Condition must be one of: ${VALID_CONDITIONS.join(', ')}` };
      }

      const val = getValuation(itemType, condition);
      if (!val.eligible) {
        return {
          success: false,
          eligible: false,
          message: itemType === 'mattress' && condition === 'poor'
            ? MSG_MATTRESS_HYGIENE
            : 'This item is not eligible for trade-in.',
        };
      }

      const itemAge = Math.max(0, Math.min(MAX_AGE_YEARS, Math.round(Number(data.itemAge) || 0)));

      // Validate and sanitize photo URLs — reject non-https schemes to prevent stored XSS
      const rawPhotos = Array.isArray(data.photoUrls) ? data.photoUrls : [];
      const photoUrls = rawPhotos
        .slice(0, MAX_PHOTOS)
        .map(url => sanitize(String(url || ''), MAX_PHOTO_URL_LEN).trim())
        .filter(url => url.startsWith('https://'));

      // Attach member ID if logged in (best-effort — getMember returns null for guests)
      const sessionMember = await getMember();
      const memberId = sessionMember ? sessionMember._id : null;

      const now = new Date();
      const record = await wixData.insert(COLLECTION, {
        memberId,
        firstName,
        lastName,
        email,
        phone,
        itemType,
        submittedCondition: condition,
        itemAge,
        photoUrls: JSON.stringify(photoUrls),
        estimatedCreditMin: val.creditMin,
        estimatedCreditMax: val.creditMax,
        status: 'pending',
        confirmedCondition: null,
        issuedCreditAmount: null,
        storeCreditId: null,
        staffNotes: '',
        submittedAt: now,
        confirmedAt: null,
      });

      return {
        success: true,
        requestId: record._id,
        creditMin: val.creditMin,
        creditMax: val.creditMax,
        message: `Trade-in request submitted! Bring your ${itemType} in-store for confirmation. Estimated credit: $${val.creditMin}–$${val.creditMax}.`,
      };
    } catch (err) {
      console.error('[tradeInService] Error submitting trade-in request:', err);
      return { success: false, message: 'Failed to submit trade-in request.' };
    }
  }
);

/**
 * Get all trade-in requests for the current logged-in member.
 *
 * @function getMyTradeInRequests
 * @returns {Promise<{success: boolean, requests?: Array}>}
 * @permission SiteMember
 */
export const getMyTradeInRequests = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await getMember();
      if (!member) return { success: false, message: 'Not authenticated.' };

      const result = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .descending('submittedAt')
        .find();

      const requests = result.items.map(r => ({
        _id: r._id,
        itemType: r.itemType,
        submittedCondition: r.submittedCondition,
        estimatedCreditMin: r.estimatedCreditMin,
        estimatedCreditMax: r.estimatedCreditMax,
        status: r.status,
        confirmedCondition: r.confirmedCondition,
        issuedCreditAmount: r.issuedCreditAmount,
        submittedAt: r.submittedAt,
        confirmedAt: r.confirmedAt,
      }));

      return { success: true, requests };
    } catch (err) {
      console.error('[tradeInService] Error getting member requests:', err);
      return { success: false, message: 'Failed to retrieve trade-in requests.' };
    }
  }
);

// ── Admin API ──────────────────────────────────────────────────────

/**
 * Get paginated trade-in requests for staff review.
 *
 * @function getTradeInRequests
 * @param {Object} [options]
 * @param {string} [options.status] - Filter by status
 * @param {number} [options.pageSize=20]
 * @param {number} [options.skip=0]
 * @returns {Promise<{success: boolean, requests?: Array, totalCount?: number}>}
 * @permission Admin
 */
export const getTradeInRequests = webMethod(
  Permissions.Admin,
  async (options = {}) => {
    try {
      const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(options.pageSize) || DEFAULT_PAGE_SIZE));
      const skip     = Math.max(0, Number(options.skip) || 0);

      let query = wixData.query(COLLECTION).descending('submittedAt');

      if (options.status && VALID_STATUSES.includes(options.status)) {
        query = query.eq('status', options.status);
      }

      const result = await query.limit(pageSize).skip(skip).find();

      return {
        success: true,
        requests: result.items || [],
        totalCount: result.totalCount || 0,
      };
    } catch (err) {
      console.error('[tradeInService] Error getting trade-in requests:', err);
      return { success: false, message: 'Failed to retrieve requests.' };
    }
  }
);

/**
 * Confirm a trade-in in-store: verify actual condition, issue store credit.
 * Staff calls this when the customer brings the item in.
 *
 * @function confirmTradeIn
 * @param {string} requestId - TradeInRequests CMS record ID
 * @param {string} confirmedCondition - Actual condition verified by staff: 'good'|'fair'|'poor'
 * @param {Object} [options]
 * @param {string} [options.staffNotes] - Optional staff notes
 * @returns {Promise<{success: boolean, issuedCreditAmount?: number, storeCreditId?: string, message?: string}>}
 * @permission Admin
 */
export const confirmTradeIn = webMethod(
  Permissions.Admin,
  async (requestId, confirmedCondition, options = {}) => {
    try {
      const cleanId = validateId(requestId);
      if (!cleanId) return { success: false, message: 'Valid request ID is required.' };

      const cond = sanitize(confirmedCondition || '', 10).toLowerCase();
      if (!VALID_CONDITIONS.includes(cond)) {
        return { success: false, message: `Condition must be one of: ${VALID_CONDITIONS.join(', ')}` };
      }

      const request = await wixData.get(COLLECTION, cleanId);
      if (!request) return { success: false, message: 'Trade-in request not found.' };

      if (request.status !== 'pending' && request.status !== 'confirmed') {
        return { success: false, message: `Request is already ${request.status}.` };
      }

      // Calculate credit based on confirmed (in-store) condition
      const val = getValuation(request.itemType, cond);
      const staffNotes = sanitize(options.staffNotes || '', MAX_STAFF_NOTES);
      const confirmedAt = new Date();
      const baseUpdate = { ...request, confirmedCondition: cond, staffNotes, confirmedAt };

      if (!val.eligible) {
        // Item failed inspection — reject it
        await wixData.update(COLLECTION, { ...baseUpdate, status: 'rejected' });
        return {
          success: false,
          message: `Item not eligible for trade-in at confirmed condition '${cond}'.`,
        };
      }

      const creditAmount = val.baseCredit;

      // Stage 1: Write 'confirmed' before issuing credit.
      // If credit issuance or the final update fails on retry, this status
      // prevents double-issuance (idempotency guard).
      if (request.status === 'pending') {
        await wixData.update(COLLECTION, { ...baseUpdate, status: 'confirmed', issuedCreditAmount: creditAmount });
      }

      // Stage 2: Issue store credit if we have a member ID and haven't already.
      // On retry (status=confirmed), request.storeCreditId may already be set from
      // a prior successful Stage 2 whose Stage 3 write failed — skip re-issuance.
      let storeCreditId = request.storeCreditId || null;
      if (!storeCreditId && request.memberId) {
        const creditResult = await issueStoreCredit({
          memberId: request.memberId,
          amount: creditAmount,
          reason: 'trade_in',
          orderReference: `trade-in:${cleanId}`,
        });

        if (!creditResult.success) {
          console.error('[tradeInService] Failed to issue store credit:', creditResult.message);
          // Record remains 'confirmed' — staff can see the confirmation happened
          // and manually issue credit if needed
          return { success: false, message: 'Trade-in confirmed but store credit issuance failed. Contact admin.' };
        }
        storeCreditId = creditResult.creditId;
      }

      // Stage 3: Mark as fully credited with credit ID
      await wixData.update(COLLECTION, { ...baseUpdate, status: 'credited', issuedCreditAmount: creditAmount, storeCreditId });

      return {
        success: true,
        issuedCreditAmount: creditAmount,
        storeCreditId,
        message: storeCreditId
          ? `Store credit of $${creditAmount} issued to member's account.`
          : `Trade-in confirmed. Issue $${creditAmount} store credit manually (guest customer).`,
      };
    } catch (err) {
      console.error('[tradeInService] Error confirming trade-in:', err);
      return { success: false, message: 'Failed to confirm trade-in.' };
    }
  }
);

/**
 * Reject a trade-in request (staff decision).
 *
 * @function rejectTradeIn
 * @param {string} requestId
 * @param {string} [reason] - Staff reason for rejection
 * @returns {Promise<{success: boolean, message?: string}>}
 * @permission Admin
 */
export const rejectTradeIn = webMethod(
  Permissions.Admin,
  async (requestId, reason) => {
    try {
      const cleanId = validateId(requestId);
      if (!cleanId) return { success: false, message: 'Valid request ID is required.' };

      const request = await wixData.get(COLLECTION, cleanId);
      if (!request) return { success: false, message: 'Trade-in request not found.' };

      if (request.status !== 'pending') {
        return { success: false, message: `Request is already ${request.status}.` };
      }

      await wixData.update(COLLECTION, {
        ...request,
        status: 'rejected',
        staffNotes: sanitize(reason || '', MAX_STAFF_NOTES),
        confirmedAt: new Date(),
      });

      return { success: true, message: 'Trade-in request rejected.' };
    } catch (err) {
      console.error('[tradeInService] Error rejecting trade-in:', err);
      return { success: false, message: 'Failed to reject trade-in.' };
    }
  }
);
