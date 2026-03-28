/**
 * @module emailService
 * @description Backend web module for email notifications.
 * Handles contact form submissions (via Wix Triggered Emails) and order
 * notifications to the store owner. Also persists contact form data to the
 * `ContactSubmissions` CMS collection for record-keeping.
 *
 * @requires wix-web-module
 * @requires wix-crm-backend - Wix Triggered Emails API
 * @requires wix-secrets-backend - Retrieves SITE_OWNER_CONTACT_ID secret
 * @requires wix-data
 *
 * @setup
 * 1. In Wix Dashboard > Secrets Manager, add `SITE_OWNER_CONTACT_ID` with the
 *    site owner's Wix contact ID (found in Dashboard > Contacts > Site Members).
 * 2. Create triggered email template `contact_form_submission` in
 *    Dashboard > Marketing > Triggered Emails with variables:
 *    customerName, customerEmail, customerPhone, subject, message, submittedAt.
 * 3. Create triggered email template `new_order_notification` with variables:
 *    orderNumber, customerName, total, itemCount.
 */
import { Permissions, webMethod } from 'wix-web-module';
import { triggeredEmails, contacts } from 'wix-crm-backend';
import { getSecret } from 'wix-secrets-backend';
import { currentMember } from 'wix-members-backend';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';

// ── Rate Limiting (CF-rw9g) ──────────────────────────────────────────
// CMS collection: EmailRateLimit (key, count, windowStart)
// Pattern: same as newsletterService._checkRateLimit

export const EMAIL_RATE_LIMIT_MAX = 3;
export const EMAIL_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Check and record a rate-limit attempt for email operations.
 * Allows up to EMAIL_RATE_LIMIT_MAX calls per EMAIL_RATE_LIMIT_WINDOW_MS per key.
 * Fails open on DB errors.
 *
 * Known gap: query-check-update is not atomic (Wix Data lacks conditional updates).
 * Concurrent requests may exceed the limit by 1-2 under high concurrency.
 * Acceptable for email spam prevention — not a billing or auth boundary.
 *
 * @param {string} key - Normalized identifier (email).
 * @param {Object} [opts]
 * @param {number} [opts.now] - Timestamp override for testing.
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function _checkEmailRateLimit(key, opts = {}) {
  const now = (opts && opts.now != null) ? opts.now : Date.now();
  try {
    const cleanKey = sanitize(key, 254).toLowerCase();

    const existing = await wixData.query('EmailRateLimit')
      .eq('key', cleanKey)
      .limit(1)
      .find();

    if (existing.items.length === 0) {
      await wixData.insert('EmailRateLimit', {
        key: cleanKey,
        count: 1,
        windowStart: new Date(now),
      });
      return { allowed: true };
    }

    const record = existing.items[0];
    const windowAge = now - new Date(record.windowStart).getTime();

    if (windowAge > EMAIL_RATE_LIMIT_WINDOW_MS) {
      await wixData.update('EmailRateLimit', {
        ...record,
        count: 1,
        windowStart: new Date(now),
      });
      return { allowed: true };
    }

    if (record.count >= EMAIL_RATE_LIMIT_MAX) {
      return { allowed: false, reason: 'rate_limited' };
    }

    await wixData.update('EmailRateLimit', {
      ...record,
      count: record.count + 1,
    });
    return { allowed: true };
  } catch (err) {
    console.warn('[emailService] Rate limit check failed, allowing request:', err?.message);
    return { allowed: true };
  }
}

const RATE_LIMIT_MESSAGE = 'Too many requests. Please try again later.';

/**
 * Send a contact form submission to the store owner via triggered email.
 * Also saves the submission to the `ContactSubmissions` CMS collection.
 *
 * @function sendEmail
 * @param {Object} formData - The contact form data.
 * @param {string} formData.name - Customer's name (required).
 * @param {string} formData.email - Customer's email address (required).
 * @param {string} [formData.phone] - Customer's phone number.
 * @param {string} [formData.subject] - Message subject.
 * @param {string} formData.message - The message body (required).
 * @returns {Promise<{success: true}>} Resolves on successful send.
 * @throws {Error} Throws with a user-facing message including the store phone
 *   number as a fallback contact method.
 * @permission Anyone — public form submissions don't require authentication.
 */
export const sendEmail = webMethod(
  Permissions.Anyone,
  async ({ name, email, phone, subject, message }) => {
    try {
      const cleanName = sanitize(name, 200);
      const cleanEmail = sanitize(email, 254);
      const cleanPhone = sanitize(phone, 20);
      const cleanSubject = sanitize(subject, 300);
      const cleanMessage = sanitize(message, 2000);

      if (!validateEmail(cleanEmail)) {
        return { success: false, message: 'Invalid email address.' };
      }

      // CF-rw9g: Rate limit per email — 3 calls/hour
      const rateCheck = await _checkEmailRateLimit(cleanEmail);
      if (!rateCheck.allowed) {
        return { success: false, message: RATE_LIMIT_MESSAGE };
      }

      // Retrieve the site owner's Wix contact ID from Secrets Manager.
      // This is the recipient of all contact form notifications.
      const siteOwnerContactId = await getSecret('SITE_OWNER_CONTACT_ID');
      await triggeredEmails.emailContact(
        'contact_form_submission',
        siteOwnerContactId,
        {
          variables: {
            customerName: cleanName,
            customerEmail: cleanEmail,
            customerPhone: cleanPhone,
            subject: cleanSubject,
            message: cleanMessage,
            submittedAt: new Date().toLocaleString('en-US', {
              timeZone: 'America/New_York',
              dateStyle: 'full',
              timeStyle: 'short',
            }),
          },
        }
      );

      // Persist the submission to CMS for record-keeping and dashboard access
      await wixData.insert('ContactSubmissions', {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        subject: cleanSubject,
        message: cleanMessage,
        submittedAt: new Date(),
        status: 'new',
      });

      logAuditEvent('ContactSubmissions', 'send_email', cleanEmail, { subject: cleanSubject });
      return { success: true };
    } catch (err) {
      console.error('Error sending contact email:', err);
      return { success: false, message: 'Failed to send message. Please try calling us at (828) 252-9449.' };
    }
  }
);

/**
 * Submit a fabric swatch request. Stores in ContactSubmissions CMS and
 * notifies the store owner via triggered email.
 *
 * @function submitSwatchRequest
 * @param {Object} params
 * @param {string} params.name - Customer's name.
 * @param {string} params.email - Customer's email address.
 * @param {string} params.address - Customer's mailing address for swatches.
 * @param {string} params.productId - The product ID swatches are requested for.
 * @param {string} params.productName - Display name of the product.
 * @param {string[]} params.swatchNames - Array of selected swatch/fabric names.
 * @returns {Promise<{success: true}>}
 * @throws {Error} On failure with fallback contact info.
 * @permission Anyone
 */
export const submitSwatchRequest = webMethod(
  Permissions.Anyone,
  async ({ name, email, address, productId, productName, swatchNames }) => {
    try {
      const cleanName = sanitize(name, 200);
      const cleanEmail = sanitize(email, 254);
      const cleanAddress = sanitize(address, 500);
      const cleanProductId = sanitize(productId, 50);
      const cleanProductName = sanitize(productName, 200);
      const cleanSwatches = Array.isArray(swatchNames)
        ? swatchNames.map(s => sanitize(s, 100))
        : [];

      if (!validateEmail(cleanEmail)) {
        return { success: false, message: 'Invalid email address.' };
      }

      // CF-rw9g: Rate limit per email — 3 calls/hour (shared with sendEmail)
      const rateCheck = await _checkEmailRateLimit(cleanEmail);
      if (!rateCheck.allowed) {
        return { success: false, message: RATE_LIMIT_MESSAGE };
      }

      const siteOwnerContactId = await getSecret('SITE_OWNER_CONTACT_ID');

      // Persist to CMS for record-keeping
      await wixData.insert('ContactSubmissions', {
        name: cleanName,
        email: cleanEmail,
        subject: `Swatch Request: ${cleanProductName}`,
        message: `Swatches: ${cleanSwatches.join(', ')}\nMailing Address: ${cleanAddress}\nProduct: ${cleanProductName} (${cleanProductId})`,
        submittedAt: new Date(),
        status: 'swatch_request',
      });

      // Notify store owner
      await triggeredEmails.emailContact(
        'contact_form_submission',
        siteOwnerContactId,
        {
          variables: {
            customerName: cleanName,
            customerEmail: cleanEmail,
            customerPhone: '',
            subject: `Fabric Swatch Request — ${cleanProductName}`,
            message: `Swatches requested: ${cleanSwatches.join(', ')}\n\nShip to:\n${cleanName}\n${cleanAddress}`,
            submittedAt: new Date().toLocaleString('en-US', {
              timeZone: 'America/New_York',
              dateStyle: 'full',
              timeStyle: 'short',
            }),
          },
        }
      );

      // Send customer confirmation email (best-effort — don't fail the request if this fails)
      try {
        const contactResult = await contacts.queryContacts()
          .eq('primaryInfo.email', cleanEmail)
          .limit(1)
          .find();
        if (contactResult.items.length > 0) {
          await triggeredEmails.emailContact(
            'swatch_confirmation',
            contactResult.items[0]._id,
            {
              variables: {
                customerName: cleanName,
                productName: cleanProductName,
                swatchList: cleanSwatches.join(', '),
                estimatedArrival: '5-7 business days',
              },
            }
          );
        }
      } catch (confirmErr) {
        console.error('Swatch confirmation email failed (non-blocking):', confirmErr);
      }

      logAuditEvent('ContactSubmissions', 'swatch_request', cleanEmail, { product: cleanProductName });
      return { success: true };
    } catch (err) {
      console.error('Error submitting swatch request:', err);
      return { success: false, message: 'Failed to submit swatch request. Please try calling us at (828) 252-9449.' };
    }
  }
);

/**
 * Send a swatch confirmation email to the customer.
 * Branded template with mountain illustration, estimated arrival, swatch list.
 *
 * @function sendSwatchConfirmationEmail
 * @param {Object} params
 * @param {string} params.contactId - Customer's Wix contact ID.
 * @param {string} params.name - Customer's name.
 * @param {string} params.email - Customer's email (for reference).
 * @param {string[]} params.swatchNames - Names of requested swatches.
 * @param {string} params.productName - Product the swatches are for.
 * @param {number} [params.estimatedDays] - Estimated delivery days.
 * @returns {Promise<{success: boolean}>}
 * @permission Anyone
 */
export const sendSwatchConfirmationEmail = webMethod(
  Permissions.Anyone,
  async ({ contactId, name, email, swatchNames, productName, estimatedDays }) => {
    try {
      if (!contactId) {
        return { success: false, message: 'Customer contact ID is required.' };
      }

      // CF-rw9g: Rate limit per email or contactId — 3 calls/hour
      // Pass raw values — _checkEmailRateLimit handles sanitization internally
      const rateLimitKey = email || contactId;
      const rateCheck = await _checkEmailRateLimit(rateLimitKey);
      if (!rateCheck.allowed) {
        return { success: false, message: RATE_LIMIT_MESSAGE };
      }

      const cleanName = sanitize(name, 200);
      const cleanProductName = sanitize(productName, 200);
      const cleanSwatches = Array.isArray(swatchNames)
        ? swatchNames.map(s => sanitize(s, 100))
        : [];

      const arrival = estimatedDays
        ? `${estimatedDays} business days`
        : '5-7 business days';

      await triggeredEmails.emailContact(
        'swatch_confirmation',
        contactId,
        {
          variables: {
            customerName: cleanName,
            productName: cleanProductName,
            swatchList: cleanSwatches.join(', '),
            estimatedArrival: arrival,
          },
        }
      );

      return { success: true };
    } catch (err) {
      console.error('Error sending swatch confirmation email:', err);
      return { success: false, message: 'Failed to send confirmation email.' };
    }
  }
);

/**
 * Send a new order notification to the store owner.
 * Non-critical — returns `{ success: false }` on failure rather than throwing.
 *
 * @function sendOrderNotification
 * @param {Object} orderDetails - Order data from Wix Stores.
 * @param {string} orderDetails.number - The order number.
 * @param {string} orderDetails.buyerName - Customer's full name.
 * @param {string} orderDetails.total - Formatted order total (e.g., "$1,299.00").
 * @param {Array} [orderDetails.lineItems] - Array of line items (used for item count).
 * @returns {Promise<{success: boolean}>} Success status.
 * @permission Anyone
 */
export const sendOrderNotification = webMethod(
  Permissions.SiteMember,
  async (orderDetails) => {
    try {
      const siteOwnerContactId = await getSecret('SITE_OWNER_CONTACT_ID');
      await triggeredEmails.emailContact(
        'new_order_notification',
        siteOwnerContactId,
        {
          variables: {
            orderNumber: orderDetails.number,
            customerName: orderDetails.buyerName,
            total: orderDetails.total,
            itemCount: String(orderDetails.lineItems?.length || 0),
          },
        }
      );
      return { success: true };
    } catch (err) {
      console.error('Error sending order notification:', err);
      return { success: false };
    }
  }
);

/**
 * Send an order confirmation email to the buyer.
 *
 * @function sendOrderConfirmation
 * @param {Object} orderDetails
 * @param {string} orderDetails.contactId - Buyer's Wix contact ID
 * @param {string} orderDetails.email - Buyer's email
 * @param {string} orderDetails.firstName - Buyer's first name
 * @param {string} orderDetails.orderNumber - Order number
 * @param {string} orderDetails.total - Formatted order total
 * @param {string} [orderDetails.itemSummary] - Human-readable item list
 * @param {number} [orderDetails.estimatedDays] - Estimated delivery days
 * @returns {Promise<{success: boolean}>}
 * @permission Admin — called from wixEcom_onOrderCreated event handler
 */
export const sendOrderConfirmation = webMethod(
  Permissions.Admin,
  async (orderDetails) => {
    try {
      const { contactId, email, firstName, orderNumber, total, itemSummary, estimatedDays } = orderDetails || {};
      if (!contactId || !email) return { success: false };

      await triggeredEmails.emailContact(
        'order_confirmation',
        contactId,
        {
          variables: {
            firstName: sanitize(firstName || '', 200),
            orderNumber: sanitize(orderNumber || '', 50),
            total: sanitize(total || '', 50),
            itemSummary: sanitize(itemSummary || '', 500),
            estimatedDays: String(estimatedDays || ''),
            email: sanitize(email, 254),
          },
        }
      );
      return { success: true };
    } catch (err) {
      console.error('[emailService] Error sending order confirmation:', err);
      return { success: false };
    }
  }
);

/**
 * Send a shipping notification email to the buyer when order is fulfilled.
 *
 * @function sendShippingNotification
 * @param {Object} orderDetails
 * @param {string} orderDetails.contactId - Buyer's Wix contact ID
 * @param {string} orderDetails.email - Buyer's email
 * @param {string} orderDetails.firstName - Buyer's first name
 * @param {string} orderDetails.orderNumber - Order number
 * @param {string} [orderDetails.trackingNumber] - Carrier tracking number
 * @param {string} [orderDetails.trackingUrl] - Carrier tracking URL
 * @param {string} [orderDetails.carrier] - Carrier name (e.g., "UPS")
 * @param {number} [orderDetails.estimatedDays] - Estimated days remaining
 * @returns {Promise<{success: boolean}>}
 * @permission Admin — called from wixEcom_onFulfillmentCreated event handler
 */
export const sendShippingNotification = webMethod(
  Permissions.Admin,
  async (orderDetails) => {
    try {
      const { contactId, email, firstName, orderNumber, trackingNumber, trackingUrl, carrier, estimatedDays } = orderDetails || {};
      if (!contactId || !email) return { success: false };

      await triggeredEmails.emailContact(
        'order_shipped',
        contactId,
        {
          variables: {
            firstName: sanitize(firstName || '', 200),
            orderNumber: sanitize(orderNumber || '', 50),
            trackingNumber: sanitize(trackingNumber || '', 100),
            trackingUrl: sanitize(trackingUrl || '', 500),
            carrier: sanitize(carrier || '', 100),
            estimatedDays: String(estimatedDays || ''),
            email: sanitize(email, 254),
          },
        }
      );
      return { success: true };
    } catch (err) {
      console.error('[emailService] Error sending shipping notification:', err);
      return { success: false };
    }
  }
);

/**
 * Send a delivery confirmation email to the buyer.
 *
 * @function sendDeliveryConfirmation
 * @param {Object} orderDetails
 * @param {string} orderDetails.contactId - Buyer's Wix contact ID
 * @param {string} orderDetails.email - Buyer's email
 * @param {string} orderDetails.firstName - Buyer's first name
 * @param {string} orderDetails.orderNumber - Order number
 * @returns {Promise<{success: boolean}>}
 * @permission Admin — called from wixEcom_onOrderDelivered event handler
 */
export const sendDeliveryConfirmation = webMethod(
  Permissions.Admin,
  async (orderDetails) => {
    try {
      const { contactId, email, firstName, orderNumber } = orderDetails || {};
      if (!contactId || !email) return { success: false };

      await triggeredEmails.emailContact(
        'delivery_confirmation',
        contactId,
        {
          variables: {
            firstName: sanitize(firstName || '', 200),
            orderNumber: sanitize(orderNumber || '', 50),
            email: sanitize(email, 254),
          },
        }
      );
      return { success: true };
    } catch (err) {
      console.error('[emailService] Error sending delivery confirmation:', err);
      return { success: false };
    }
  }
);

// ── sendABEmail ───────────────────────────────────────────────────────

/**
 * Send a transactional email via A/B testing — deterministically assigns
 * variant A or B based on memberId+campaignId hash, sends the matched
 * triggered email, and logs the send to the EmailABLog collection.
 *
 * @function sendABEmail
 * @param {string} memberId - Wix member ID (used as contactId for triggeredEmails).
 * @param {string} campaignId - Campaign identifier (e.g. 'welcome_step1').
 * @param {string} recipientEmail - Recipient email address (for logging).
 * @param {Array<{variant: 'A'|'B', templateId: string, variables: Object}>} variants
 *   - Per-variant template + variable overrides (must include both A and B).
 * @returns {Promise<{sent: boolean, variant?: 'A'|'B', reason?: string}>}
 */
export const sendABEmail = webMethod(
  Permissions.SiteMember,
  async (memberId, campaignId, recipientEmail, variants) => {
    if (
      !memberId || typeof memberId !== 'string' ||
      !campaignId || typeof campaignId !== 'string' ||
      !recipientEmail || typeof recipientEmail !== 'string' ||
      !Array.isArray(variants) || variants.length === 0
    ) {
      return { sent: false, reason: 'invalid_params' };
    }

    const cleanEmail = recipientEmail.trim().toLowerCase();
    if (!validateEmail(cleanEmail)) {
      return { sent: false, reason: 'invalid_email' };
    }

    try {
      const caller = await currentMember.getMember();
      if (!caller || caller._id !== memberId) {
        return { sent: false, reason: 'unauthorized' };
      }

      const { assignVariant, logABSend } = await import('backend/emailABService.web');
      const variant = assignVariant(memberId, campaignId);
      const chosen = variants.find(v => v.variant === variant) || variants[0];
      const effectiveVariant = chosen.variant;

      await triggeredEmails.emailContact(
        chosen.templateId,
        memberId,
        { variables: chosen.variables || {} }
      );

      await logABSend(memberId, cleanEmail, campaignId, effectiveVariant);

      return { sent: true, variant: effectiveVariant };
    } catch (err) {
      console.error('[emailService] sendABEmail error:', err);
      return { sent: false, reason: 'send_failed' };
    }
  }
);
