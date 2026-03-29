/**
 * @module tradeInService
 * @description Trade-In / Trade-Up program backend.
 *
 * Customers submit their old furniture (futon frame, mattress, murphy bed, etc.)
 * and receive an estimated store credit range. Staff confirm in-store condition
 * and issue the actual credit via storeCreditService.
 *
 * @setup (manual steps required)
 * CMS collections:
 *   TradeInRequests (
 *     requestId Text indexed, email Text, name Text, phone Text,
 *     productType Text, condition Text, description Text,
 *     photoUrls Text (JSON array), estimatedCredit Number,
 *     status Text: 'pending'|'confirmed'|'declined'|'expired',
 *     staffNotes Text, actualCondition Text, creditId Text,
 *     createdAt Date, updatedAt Date
 *   )
 *   TradeInRateLimit (email Text, count Number, windowStart Date)
 * Secrets: none required — uses existing ANTHROPIC_API_KEY indirectly via storeCreditService
 *
 * @note Condition credit values are starting points — Stilgar to confirm final numbers.
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail, validateId } from 'backend/utils/sanitize';

const TRADE_IN_REQUESTS = 'TradeInRequests';
const RATE_LIMIT_COLLECTION = 'TradeInRateLimit';

// Rate limiting: max 3 submissions per email per 24h
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Requests expire after 30 days if not confirmed
const REQUEST_EXPIRY_DAYS = 30;

// Credit ranges by product type and condition.
// Each value is the BASE credit amount. A ±15% range is shown to customers
// to reflect that final assessment happens in-store.
// Values in dollars — Stilgar to confirm before go-live.
export const CONDITION_MATRIX = {
  'futon-frame':   { good: 75,  fair: 50,  poor: 25 },
  'futon-mattress':{ good: 40,  fair: 25,  poor: 0  }, // poor = hygiene, no credit
  'murphy-bed':    { good: 100, fair: 65,  poor: 30 },
  'platform-bed':  { good: 80,  fair: 55,  poor: 25 },
  'sofa':          { good: 60,  fair: 40,  poor: 15 },
};

export const VALID_PRODUCT_TYPES = Object.keys(CONDITION_MATRIX);
export const VALID_CONDITIONS = ['good', 'fair', 'poor'];

/** Credit range shown to customers: base ±15%, floored at 0. */
export function creditRange(base) {
  if (base <= 0) return { min: 0, max: 0 };
  const delta = Math.round(base * 0.15);
  return { min: Math.max(0, base - delta), max: base + delta };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function checkRateLimit(email, nowMs = Date.now()) {
  try {
    const res = await wixData.query(RATE_LIMIT_COLLECTION)
      .eq('email', email)
      .limit(1)
      .find();
    const record = res.items[0] || null;

    if (!record) {
      await wixData.insert(RATE_LIMIT_COLLECTION, {
        email,
        count: 1,
        windowStart: new Date(nowMs),
      });
      return { allowed: true };
    }

    const windowAge = nowMs - new Date(record.windowStart).getTime();
    if (windowAge > RATE_LIMIT_WINDOW_MS) {
      await wixData.update(RATE_LIMIT_COLLECTION, {
        ...record,
        count: 1,
        windowStart: new Date(nowMs),
      });
      return { allowed: true };
    }

    if (record.count >= RATE_LIMIT_MAX) {
      return { allowed: false, reason: 'rate_limited' };
    }

    await wixData.update(RATE_LIMIT_COLLECTION, { ...record, count: record.count + 1 });
    return { allowed: true };
  } catch (err) {
    console.warn('[tradeInService] rate limit check failed, allowing request:', err?.message);
    return { allowed: true }; // Fail open
  }
}

// ---------------------------------------------------------------------------
// Public webMethods
// ---------------------------------------------------------------------------

/**
 * Get the estimated store credit range for a given product type and condition.
 * Returns { eligible: false } for unsupported product types.
 * Returns { eligible: true, min, max, base } when credit is available.
 * Returns { eligible: true, min: 0, max: 0, ineligible: true } for poor-condition mattresses.
 *
 * @param {string} productType
 * @param {string} condition — 'good' | 'fair' | 'poor'
 */
export const estimateTradeIn = webMethod(
  Permissions.Anyone,
  async (productType, condition) => {
    const type = sanitize(productType || '', 50).toLowerCase();
    const cond = sanitize(condition || '', 20).toLowerCase();

    if (!VALID_PRODUCT_TYPES.includes(type)) {
      return { eligible: false };
    }
    if (!VALID_CONDITIONS.includes(cond)) {
      return { eligible: false, error: 'invalid_condition' };
    }

    const base = CONDITION_MATRIX[type][cond];
    const { min, max } = creditRange(base);
    return { eligible: true, min, max, base, productType: type, condition: cond };
  }
);

/**
 * Submit a trade-in request.
 * Anyone can submit — no login required (pre-sale / in-store flow).
 *
 * @param {Object} data
 * @param {string} data.name
 * @param {string} data.email
 * @param {string} [data.phone]
 * @param {string} data.productType
 * @param {string} data.condition
 * @param {string} [data.description]
 * @param {string[]} [data.photoUrls]
 * @returns {{ success: boolean, requestId?: string, estimatedCredit?: number, error?: string }}
 */
export const submitTradeInRequest = webMethod(
  Permissions.Anyone,
  async (data) => {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'invalid_request' };
    }

    const name = sanitize(data.name || '', 100);
    const email = sanitize(data.email || '', 254).toLowerCase();
    const phone = sanitize(data.phone || '', 30);
    const productType = sanitize(data.productType || '', 50).toLowerCase();
    const condition = sanitize(data.condition || '', 20).toLowerCase();
    const description = sanitize(data.description || '', 1000);

    // Validate photo URLs — accept only Wix media URLs or empty
    let photoUrls = [];
    if (Array.isArray(data.photoUrls)) {
      const { isWixMediaUrl } = await import('backend/utils/sanitize');
      photoUrls = data.photoUrls
        .slice(0, 5) // max 5 photos
        .filter(u => typeof u === 'string' && isWixMediaUrl(u));
    }

    if (!name) return { success: false, error: 'name_required' };
    if (!validateEmail(email)) return { success: false, error: 'invalid_email' };
    if (!VALID_PRODUCT_TYPES.includes(productType)) return { success: false, error: 'invalid_product_type' };
    if (!VALID_CONDITIONS.includes(condition)) return { success: false, error: 'invalid_condition' };

    // Rate limit by email
    const rl = await checkRateLimit(email);
    if (!rl.allowed) return { success: false, error: 'rate_limited' };

    const base = CONDITION_MATRIX[productType][condition];
    const { min, max } = creditRange(base);
    const estimatedCredit = base;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + REQUEST_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    // Generate a short human-readable request ID (TI-XXXXXXXX)
    const requestId = 'TI-' + Math.random().toString(36).slice(2, 10).toUpperCase();

    try {
      await wixData.insert(TRADE_IN_REQUESTS, {
        requestId,
        email,
        name,
        phone,
        productType,
        condition,
        description,
        photoUrls: JSON.stringify(photoUrls),
        estimatedCredit,
        estimatedMin: min,
        estimatedMax: max,
        status: 'pending',
        staffNotes: '',
        actualCondition: '',
        creditId: '',
        createdAt: now,
        updatedAt: now,
        expiresAt,
      });
    } catch (err) {
      console.error('[tradeInService] insert failed:', err?.message);
      return { success: false, error: 'submission_failed' };
    }

    return { success: true, requestId, estimatedCredit, estimatedMin: min, estimatedMax: max };
  }
);

/**
 * Look up a trade-in request by requestId and email (for status checking).
 * Email verification prevents enumeration.
 *
 * @param {string} requestId
 * @param {string} email
 */
export const getTradeInRequest = webMethod(
  Permissions.Anyone,
  async (requestId, email) => {
    const cleanId = sanitize(requestId || '', 20);
    const cleanEmail = sanitize(email || '', 254).toLowerCase();

    if (!cleanId || !validateEmail(cleanEmail)) {
      return { success: false, error: 'invalid_request' };
    }

    try {
      const res = await wixData.query(TRADE_IN_REQUESTS)
        .eq('requestId', cleanId)
        .eq('email', cleanEmail)
        .limit(1)
        .find();

      if (!res.items.length) return { success: false, error: 'not_found' };

      const r = res.items[0];
      return {
        success: true,
        request: {
          requestId: r.requestId,
          productType: r.productType,
          condition: r.condition,
          status: r.status,
          estimatedMin: r.estimatedMin,
          estimatedMax: r.estimatedMax,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
        },
      };
    } catch (err) {
      console.error('[tradeInService] lookup failed:', err?.message);
      return { success: false, error: 'lookup_failed' };
    }
  }
);

/**
 * Staff confirmation: verify item in-store, set actual condition, issue store credit.
 *
 * @param {string} requestId
 * @param {string} actualCondition — 'good' | 'fair' | 'poor' | 'declined'
 * @param {string} [staffNotes]
 */
export const confirmTradeIn = webMethod(
  Permissions.Admin,
  async (requestId, actualCondition, staffNotes = '') => {
    const cleanId = sanitize(requestId || '', 20);
    const cond = sanitize(actualCondition || '', 20).toLowerCase();
    const notes = sanitize(staffNotes || '', 500);

    if (!cleanId) return { success: false, error: 'invalid_request_id' };

    const declined = cond === 'declined';
    if (!declined && !VALID_CONDITIONS.includes(cond)) {
      return { success: false, error: 'invalid_condition' };
    }

    let record;
    try {
      const res = await wixData.query(TRADE_IN_REQUESTS)
        .eq('requestId', cleanId)
        .limit(1)
        .find();
      record = res.items[0];
    } catch (err) {
      console.error('[tradeInService] confirmTradeIn query failed:', err?.message);
      return { success: false, error: 'lookup_failed' };
    }

    if (!record) return { success: false, error: 'not_found' };
    if (record.status !== 'pending') {
      return { success: false, error: 'already_processed', status: record.status };
    }

    const now = new Date();

    if (declined) {
      await wixData.update(TRADE_IN_REQUESTS, {
        ...record,
        status: 'declined',
        actualCondition: 'declined',
        staffNotes: notes,
        updatedAt: now,
      });
      return { success: true, status: 'declined' };
    }

    // Issue store credit via storeCreditService
    const base = CONDITION_MATRIX[record.productType]?.[cond] ?? 0;

    if (base <= 0) {
      // No credit (e.g., poor-condition mattress)
      await wixData.update(TRADE_IN_REQUESTS, {
        ...record,
        status: 'confirmed',
        actualCondition: cond,
        staffNotes: notes,
        updatedAt: now,
      });
      return { success: true, status: 'confirmed', creditAmount: 0 };
    }

    let creditId = '';
    try {
      const { issueStoreCredit } = await import('backend/storeCreditService.web');
      const creditResult = await issueStoreCredit({
        memberId: record.memberId || record.email, // email fallback for non-members
        amount: base,
        reason: 'promotion',
        orderReference: cleanId,
      });
      creditId = creditResult?.creditId || '';
    } catch (err) {
      console.error('[tradeInService] credit issuance failed:', err?.message);
      return { success: false, error: 'credit_issuance_failed' };
    }

    await wixData.update(TRADE_IN_REQUESTS, {
      ...record,
      status: 'confirmed',
      actualCondition: cond,
      staffNotes: notes,
      creditId,
      updatedAt: now,
    });

    return { success: true, status: 'confirmed', creditAmount: base, creditId };
  }
);
