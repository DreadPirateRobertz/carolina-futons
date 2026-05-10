/**
 * @module swatchRequest
 * @description Handles fabric swatch request submissions for the /swatches page.
 * Validates 1–5 swatch selections, upserts a Wix CRM contact, persists the
 * request to SwatchRequests CMS, and enqueues a 4-step nurture email sequence.
 *
 * CMS collections:
 * - FabricSwatches (read) — available swatches
 * - SwatchRequests (write) — submitted requests
 * - EmailQueue (write) — nurture sequence entries (shared with emailAutomation)
 *
 * @requires wix-web-module
 * @requires wix-crm-backend
 * @requires wix-data
 * @requires backend/utils/sanitize
 */
import { webMethod, Permissions } from 'wix-web-module';
import { contacts } from 'wix-crm-backend';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { triggerSwatchFollowupSequence } from 'backend/emailAutomation.web';
import { sendSwatchConfirmationEmail } from 'backend/emailService.web';
import { logError } from 'backend/utils/errorHandler';

// Swatch nurture sequence: confirmation + Day 3 + Day 7 + Day 14
const SWATCH_NURTURE = [
  { step: 1, templateId: 'swatch_confirmation',  delayHours: 0,   description: 'Your swatches are on their way!' },
  { step: 2, templateId: 'swatch_followup_d3',   delayHours: 72,  description: 'Have your swatches arrived?' },
  { step: 3, templateId: 'swatch_followup_d7',   delayHours: 168, description: 'Ready to order?' },
  { step: 4, templateId: 'swatch_final_nudge',   delayHours: 336, description: 'Final nudge — discount code' },
];

const ZIP_RE = /^\d{5}$/;

/**
 * Validate and sanitize the contact info object.
 * Returns { error } on failure or cleaned fields on success.
 */
function validateContact(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Contact information is required.' };

  const firstName = sanitize(raw.firstName || '', 100).trim();
  const lastName  = sanitize(raw.lastName  || '', 100).trim();
  if (!firstName || !lastName) return { error: 'First and last name are required.' };

  const email = (raw.email || '').toLowerCase().trim();
  if (!validateEmail(email)) return { error: 'A valid email address is required.' };

  const address1 = sanitize(raw.address1 || '', 200).trim();
  if (!address1) return { error: 'Street address is required.' };

  const city = sanitize(raw.city || '', 100).trim();
  if (!city) return { error: 'City is required.' };

  const state = sanitize(raw.state || '', 50).trim();
  if (!state) return { error: 'State is required.' };

  const zip = (raw.zip || '').trim();
  if (!ZIP_RE.test(zip)) return { error: 'ZIP code must be 5 digits.' };

  return {
    firstName,
    lastName,
    email,
    address1,
    address2: sanitize(raw.address2 || '', 200).trim() || undefined,
    city,
    state,
    zip,
    phone: raw.phone ? sanitize(raw.phone, 30).trim() : undefined,
  };
}

/**
 * Validate and normalize swatchIds: 1–5 unique non-empty trimmed strings.
 * Returns { cleanIds } on success or { error } on failure.
 */
function validateSwatchIds(ids) {
  if (!Array.isArray(ids)) return { error: 'Swatch IDs must be provided as an array.' };
  if (ids.length === 0) return { error: 'At least one swatch must be selected.' };
  if (ids.length > 5) return { error: 'Maximum 5 swatches may be requested at once.' };
  const cleanIds = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !id.trim()) {
      return { error: 'Invalid swatch ID in selection.' };
    }
    cleanIds.push(id.trim());
  }
  const unique = new Set(cleanIds);
  if (unique.size < cleanIds.length) return { error: 'Duplicate swatch IDs are not allowed.' };
  return { cleanIds };
}

/**
 * Resolve swatch names from FabricSwatches collection.
 * Falls back to the ID string if a swatch is not found — logs a warning.
 */
async function resolveSwatchNames(swatchIds) {
  const results = await Promise.all(
    swatchIds.map(id =>
      wixData.query('FabricSwatches').eq('_id', id).limit(1).find()
        .then(r => {
          const name = r.items[0]?.name;
          if (!name) console.warn(`[swatchRequest] Swatch not found in CMS: ${id}`);
          return name || id;
        })
    )
  );
  return results;
}

/**
 * Upsert a CRM contact and return contactId.
 */
async function upsertContact(contact) {
  const result = await contacts.appendOrCreateContact({
    name: { first: contact.firstName, last: contact.lastName },
    emails: [{ email: contact.email }],
    phones: contact.phone ? [{ phone: contact.phone }] : [],
    addresses: [{
      streetAddress: { value: contact.address1 },
      city: contact.city,
      subdivision: contact.state,
      postalCode: contact.zip,
      country: 'US',
    }],
  });
  return result.contactId;
}

/**
 * Enqueue swatch nurture sequence emails.
 */
async function enqueueSwatch({ contactId, email, swatchNames, productSlug }) {
  // cf-xdji item-2: caller is responsible for ensuring contactId is non-empty.
  // We assert here so a future regression at the call site is loud rather than
  // silently queueing a row that would fail at processQueue time.
  if (!contactId) throw new Error('enqueueSwatch requires a non-empty contactId');
  const now = new Date();
  await Promise.all(
    SWATCH_NURTURE.map(({ step, templateId, delayHours }) => {
      const scheduledFor = new Date(now.getTime() + delayHours * 60 * 60 * 1000);
      return wixData.insert('EmailQueue', {
        templateId,
        recipientEmail: email,
        recipientContactId: contactId,
        variables: {
          swatchNames,
          swatchCount: swatchNames.length,
          productSlug: productSlug || null,
        },
        sequenceType: 'swatch_nurture',
        sequenceStep: step,
        status: 'pending',
        scheduledFor,
        sentAt: null,
        attempt: 0,
        lastError: '',
        abVariant: null,
        createdAt: now,
      });
    })
  );
}

/**
 * Submit a fabric swatch request.
 *
 * @param {Object} params
 * @param {string[]} params.swatchIds - 1–5 swatch IDs
 * @param {Object}  params.contactInfo - shipping contact details
 * @param {string}  [params.productSlug] - optional referring product slug
 * @returns {Promise<{success: boolean, requestId?: string, error?: string}>}
 */
export const submitSwatchRequest = webMethod(
  Permissions.Anyone,
  async (params) => {
    try {
      const { swatchIds, contactInfo, productSlug: rawSlug } = params || {};
      // Validate inputs
      const idValidation = validateSwatchIds(swatchIds);
      if (idValidation.error) return { success: false, error: idValidation.error };
      const cleanIds = idValidation.cleanIds;

      const contact = validateContact(contactInfo);
      if (contact.error) return { success: false, error: contact.error };

      // Sanitize optional product slug
      const cleanSlug = rawSlug ? sanitize(String(rawSlug), 200).trim() || undefined : undefined;

      // Resolve swatch names
      const swatchNames = await resolveSwatchNames(cleanIds);

      // Upsert CRM contact
      const contactId = await upsertContact(contact);

      // Insert request record
      const record = {
        contactEmail:    contact.email,
        contactName:     `${contact.firstName} ${contact.lastName}`,
        contactId:       contactId || '',
        swatchIds:       cleanIds,
        swatchNames,
        shippingAddress: {
          address1: contact.address1,
          ...(contact.address2 ? { address2: contact.address2 } : {}),
          city:    contact.city,
          state:   contact.state,
          zip:     contact.zip,
        },
        requestedAt: new Date(),
        status:      'pending',
        ...(cleanSlug ? { productSlug: cleanSlug } : {}),
      };

      const inserted = await wixData.insert('SwatchRequests', record);

      // Enqueue nurture emails — log failure but don't fail the request
      // (CMS record is already saved; email can be retried independently).
      // cf-xdji item-2: skip queueing entirely when contactId is empty —
      // the queue row would just fail at processQueue time with "No contact
      // ID for recipient" and consume retry budget. Without a contactId the
      // nurture sequence can't deliver, so a missing-contact warn is the
      // honest signal.
      if (contactId) {
        try {
          await enqueueSwatch({
            contactId,
            email: contact.email,
            swatchNames,
            productSlug: cleanSlug || null,
          });
        } catch (emailErr) {
          console.error('[swatchRequest] Failed to enqueue nurture emails:', emailErr);
        }
      } else {
        console.warn('[swatchRequest] Skipping swatch nurture queue — upsertContact returned no contactId for', contact.email);
      }

      // cf-obsb Path A: send the customer-facing swatch confirmation email
      // immediately on success. Non-blocking — CMS record is already saved
      // and the nurture queue is independent, so a confirmation-email
      // failure must not flip the request to a failure response.
      if (contactId) {
        const productNameForEmail = swatchNames[0] || 'fabric swatches';
        sendSwatchConfirmationEmail({
          contactId,
          name: `${contact.firstName} ${contact.lastName}`.trim(),
          email: contact.email,
          swatchNames,
          productName: productNameForEmail,
        }).catch((emailErr) => {
          console.warn('[swatchRequest] swatch_confirmation send failed (non-blocking):', emailErr?.message ?? emailErr);
        });
      }

      return { success: true, requestId: inserted._id };
    } catch (err) {
      console.error('[swatchRequest] submitSwatchRequest error:', err);
      return { success: false, error: err.message || 'Failed to submit swatch request.' };
    }
  }
);

/**
 * Mark a swatch request as shipped and trigger the Day 3 / Day 10 follow-up sequence.
 * Called by Wix Automations when a swatch order is fulfilled.
 *
 * @param {string} requestId - SwatchRequests CMS _id
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const markSwatchShipped = webMethod(
  Permissions.Admin,
  async (requestId) => {
    try {
      const cleanId = sanitize(String(requestId || ''), 100).trim();
      if (!cleanId) return { success: false, error: 'requestId is required' };

      const result = await wixData.query('SwatchRequests').eq('_id', cleanId).limit(1).find();
      const request = result.items[0];
      if (!request) return { success: false, error: 'Swatch request not found' };

      // Update status to shipped
      await wixData.update('SwatchRequests', { ...request, status: 'shipped', shippedAt: new Date() });

      // Fire-and-forget: queue follow-up sequence — don't fail the status update if email queuing fails
      const nameParts = (request.contactName || '').split(' ');
      const firstName = nameParts[0] || '';
      triggerSwatchFollowupSequence(
        request.contactId || '',
        request.contactEmail || '',
        firstName,
        request.swatchNames || [],
      ).catch(err => logError('markSwatchShipped:followupQueue', err));

      return { success: true };
    } catch (err) {
      logError('markSwatchShipped', err);
      return { success: false, error: err.message || 'Failed to mark swatch as shipped.' };
    }
  }
);
