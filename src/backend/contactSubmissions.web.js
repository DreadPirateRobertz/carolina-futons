/**
 * @module contactSubmissions
 * @description Backend web module for lightweight contact/lead capture.
 * Handles form submissions from exit-intent popups, back-in-stock alerts,
 * and other non-email-notification captures. Persists to the ContactSubmissions
 * CMS collection for dashboard review and follow-up.
 *
 * For full email notifications (contact form, swatch requests), use
 * emailService.web.js instead.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create the `ContactSubmissions` CMS collection in Wix Dashboard with fields:
 *   name (Text), email (Text), phone (Text), subject (Text), message (Text),
 *   submittedAt (Date), status (Text), source (Text), notes (Text),
 *   productId (Text), productName (Text)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';

// Rate limiting for submitContactForm — prevents contact form spam flood.
// CMS collection `ContactRateLimits`: key (Text), count (Number), windowStart (DateTime).
const CONTACT_RATE_LIMIT_MAX = 3;
const CONTACT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const CONTACT_RATE_LIMIT_COLLECTION = 'ContactRateLimits';

/**
 * Check and increment the per-email rate limit for contact form submissions.
 * Returns { allowed: true } or { allowed: false, reason: 'rate_limited' }.
 * Fails open on DB error to avoid blocking legitimate submissions.
 *
 * @param {string} key - Normalized email address
 * @param {Object} [opts]
 * @param {number} [opts.now] - Timestamp override for testing
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function _checkContactRateLimit(key, opts = {}) {
  const now = (opts && opts.now != null) ? opts.now : Date.now();
  try {
    const cleanKey = sanitize(key, 254).toLowerCase();

    const existing = await wixData.query(CONTACT_RATE_LIMIT_COLLECTION)
      .eq('key', cleanKey)
      .limit(1)
      .find();

    if (existing.items.length === 0) {
      await wixData.insert(CONTACT_RATE_LIMIT_COLLECTION, {
        key: cleanKey,
        count: 1,
        windowStart: new Date(now),
      });
      return { allowed: true };
    }

    const record = existing.items[0];
    const windowAge = now - new Date(record.windowStart).getTime();

    if (windowAge > CONTACT_RATE_LIMIT_WINDOW_MS) {
      await wixData.update(CONTACT_RATE_LIMIT_COLLECTION, {
        ...record,
        count: 1,
        windowStart: new Date(now),
      });
      return { allowed: true };
    }

    if (record.count >= CONTACT_RATE_LIMIT_MAX) {
      return { allowed: false, reason: 'rate_limited' };
    }

    await wixData.update(CONTACT_RATE_LIMIT_COLLECTION, {
      ...record,
      count: record.count + 1,
    });
    return { allowed: true };
  } catch (err) {
    console.warn('[contactSubmissions] Rate limit check failed, allowing request:', err?.message ?? err);
    return { allowed: true }; // Fail open — don't block on DB errors
  }
}

/**
 * Submit a lightweight contact/lead capture form.
 * Used by exit-intent popups, back-in-stock alerts, and browse abandonment.
 * Does NOT send email notifications — just persists to CMS.
 *
 * @function submitContactForm
 * @param {Object} data - The form submission data.
 * @param {string} data.email - Customer's email address (required).
 * @param {string} [data.name] - Customer's name.
 * @param {string} [data.phone] - Customer's phone number.
 * @param {string} [data.source] - Where the submission came from
 *   (e.g., 'exit_intent_popup', 'back_in_stock', 'browse_abandonment').
 * @param {string} [data.status] - Submission status/type
 *   (e.g., 'exit_intent_signup', 'back_in_stock_request').
 * @param {string} [data.notes] - Additional context about the submission.
 * @param {string} [data.productId] - Associated product ID (for back-in-stock).
 * @param {string} [data.productName] - Associated product name.
 * @returns {Promise<{success: boolean}>} Resolves on successful insert.
 * @permission Anyone — captures from anonymous visitors.
 */
export const submitContactForm = webMethod(
  Permissions.Anyone,
  async (data, opts = {}) => {
    try {
      if (!data || !data.email) {
        return { success: false, message: 'Email is required' };
      }

      const email = sanitize(data.email, 254).toLowerCase();
      if (!validateEmail(email)) {
        return { success: false, message: 'Invalid email format' };
      }

      // Rate limit: 3 submissions/hour per email to prevent spam flood
      const rateCheck = await checkRateLimit('ContactRateLimits', email, { now: opts && opts.rateLimitNow });
      if (!rateCheck.allowed) {
        return { success: true }; // Silent success to avoid leaking info
      }

      const source = sanitize(data.source || 'unknown', 50);

      await wixData.insert('ContactSubmissions', {
        email,
        name: sanitize(data.name || '', 200),
        phone: sanitize(data.phone || '', 20),
        subject: source,
        message: sanitize(data.notes || '', 2000),
        submittedAt: new Date(),
        status: sanitize(data.status || 'new', 50),
        source,
        notes: sanitize(data.notes || '', 2000),
        productId: sanitize(data.productId || '', 50),
        productName: sanitize(data.productName || '', 200),
      });

      return { success: true };
    } catch (err) {
      console.error('Error submitting contact form:', err);
      return { success: false };
    }
  }
);
