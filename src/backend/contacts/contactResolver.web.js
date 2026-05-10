/**
 * @module contactResolver.web
 * @description Resolve a Wix CRM contactId for an email address — creating the
 * contact if it doesn't exist, or returning the existing contactId if it does.
 * Wraps `contacts.appendOrCreateContact` from `wix-crm-backend` (which already
 * dedupes by email server-side) so backend code can write `recipientContactId`
 * onto EmailQueue rows / triggered-email sends without each call site
 * re-implementing the same upsert.
 *
 * cf-xdji (P1) — closes the F1 (welcome series for anonymous + member-self-
 * trigger paths) and F7 (swatch confirmation for new visitors) silent
 * failures surfaced in the cf-icww email audit. Pre-cf-xdji, those paths
 * passed `recipientContactId: ''` because they had no member identity to
 * draw from; emailQueueService's send step then failed with "No contact ID
 * for recipient" and the welcome / swatch email never delivered.
 *
 * Permission: Anyone — the helper accepts an arbitrary email and returns a
 * contactId. Callers (subscribeToNewsletter, captureExitIntentEmail,
 * submitSwatchRequest, sendEmail/_sendCustomerContactAutoReply) are already
 * Permissions.Anyone webMethods that rate-limit and validate the email
 * upstream. The helper itself is purely a CRM upsert — no PII beyond what
 * the caller already has.
 *
 * Existing patterns this consolidates (refactor in a follow-up sweep):
 *   - cartRecovery.web.js:210         — same shape, inline
 *   - giftCards.web.js:274/297        — same shape, inline (purchaser/recipient)
 *   - swatchRequest.web.js:115        — same shape, returns result.contactId
 *   - emailService.web.js (cf-hafn)   — _sendCustomerContactAutoReply inline
 */

import { Permissions, webMethod } from 'wix-web-module';
import { contacts } from 'wix-crm-backend';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

/**
 * Resolve (or create) a Wix CRM contact for an email address.
 *
 * Wix's `appendOrCreateContact` is idempotent: it queries by primary email
 * and returns the existing contact when one matches, otherwise creates a
 * new one. This helper sanitises + validates the email upstream and surfaces
 * a stable `contactId` so callers can pass it as `recipientContactId` on
 * EmailQueue rows / triggered-email sends without each call site
 * re-implementing the same upsert.
 *
 * @function resolveContactId
 * @param {string} email - Email address to upsert.
 * @param {string} [firstName] - Optional first name to seed on a new contact.
 *   Wix preserves an existing contact's name if one is already set; this
 *   value is only used when the contact is created.
 * @returns {Promise<string | null>}
 *   - The contactId on success (whether newly created or existing match).
 *   - `null` on validation failure or upstream throw — caller decides whether
 *     to fail closed (skip the email) or fail open (queue without contactId
 *     and let the existing send-side guard reject). All known callers fail
 *     closed.
 *
 * @example
 *   const contactId = await resolveContactId('shopper@example.com', 'Asha');
 *   if (!contactId) return; // upstream failed; do not queue
 *   await enqueueEmail({ recipientContactId: contactId, ... });
 */
export const resolveContactId = webMethod(
  Permissions.Anyone,
  async (email, firstName) => _resolveContactIdInternal(email, firstName),
);

/**
 * Internal implementation — exported for backend-to-backend callers that
 * want to bypass the webMethod wrapper. Same contract as the webMethod;
 * existing call sites in cartRecovery / giftCards / swatchRequest /
 * sendEmail can refactor to import this directly without touching
 * Permissions.
 *
 * @param {string} email
 * @param {string} [firstName]
 * @returns {Promise<string | null>}
 */
export async function _resolveContactIdInternal(email, firstName) {
  // Validation: same shape as the upstream webMethod callers (subscribeToNewsletter
  // etc) already use, but defensively re-checked here so a bypassed caller
  // can't sneak past the validation boundary.
  if (!email || typeof email !== 'string') return null;
  const cleanEmail = sanitize(email, 254).toLowerCase().trim();
  if (!validateEmail(cleanEmail)) return null;

  const cleanFirstName = firstName ? sanitize(String(firstName), 200).trim() : '';

  const payload = {
    emails: [{ email: cleanEmail }],
  };
  if (cleanFirstName) {
    payload.name = { first: cleanFirstName };
  }

  let result;
  try {
    result = await contacts.appendOrCreateContact(payload);
  } catch (err) {
    // CRM upstream failure — caller decides whether to retry. Logged with
    // the email so support can correlate; never log full PII beyond what
    // the caller already has access to (the email).
    console.error('[contactResolver] appendOrCreateContact failed for', cleanEmail, '— error:', err?.message ?? err);
    return null;
  }

  // Wix's response shape varies by SDK version: some return `{contactId,
  // identityType}`, others return `{contact: {_id, ...}}`. Defensive
  // resolution covers both.
  const contactId = result?.contactId || result?.contact?._id || result?._id;
  if (!contactId) {
    console.warn('[contactResolver] appendOrCreateContact returned no contactId for', cleanEmail);
    return null;
  }
  return contactId;
}
