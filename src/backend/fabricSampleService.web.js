/**
 * @module fabricSampleService
 * @description Fabric sample (free swatch mailer) request handler.
 *
 * Flow:
 *  1. Validate swatchIds (1–3 unique non-empty strings) and contactInfo
 *  2. Rate-limit: 1 request per email address per 30 days
 *  3. Resolve swatch names from FabricSwatches CMS
 *  4. Persist to FabricSampleRequests collection
 *  5. Trigger Wix Automation emails:
 *     - Customer confirmation (fabric_sample_confirmation)
 *     - Fulfillment notification to carolinafutons@gmail.com (fabric_sample_fulfillment)
 *
 * CMS collections:
 *  - FabricSwatches (read) — available swatch catalog
 *  - FabricSampleRequests (write) — submitted requests
 */
import { webMethod, Permissions } from 'wix-web-module';
import { triggeredEmails, contacts } from 'wix-crm-backend';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const MAX_SWATCHES = 3;
const RATE_LIMIT_DAYS = 30;
const ZIP_RE = /^\d{5}$/;

// ── Validators ───────────────────────────────────────────────────────────────

function validateSwatchIds(ids) {
  if (!Array.isArray(ids)) return { error: 'Swatch IDs must be provided as an array.' };
  if (ids.length === 0) return { error: 'At least one swatch must be selected.' };
  if (ids.length > MAX_SWATCHES) return { error: `Maximum ${MAX_SWATCHES} swatches may be requested at once.` };
  const cleanIds = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !id.trim()) return { error: 'Invalid swatch ID in selection.' };
    cleanIds.push(id.trim());
  }
  if (new Set(cleanIds).size < cleanIds.length) return { error: 'Duplicate swatch IDs are not allowed.' };
  return { cleanIds };
}

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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if there is an existing FabricSampleRequests record for this
 * email within the last RATE_LIMIT_DAYS days.
 */
async function isRateLimited(email) {
  const cutoff = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000);
  const result = await wixData.query('FabricSampleRequests')
    .eq('contactEmail', email.toLowerCase())
    .ge('requestedAt', cutoff)
    .limit(1)
    .find();
  return result.items.length > 0;
}

/**
 * Resolve human-readable swatch names from FabricSwatches CMS.
 * Falls back to the raw ID when a swatch is not found.
 */
async function resolveSwatchNames(swatchIds) {
  return Promise.all(
    swatchIds.map(id =>
      wixData.query('FabricSwatches').eq('_id', id).limit(1).find()
        .then(r => {
          const name = r.items[0]?.name;
          if (!name) console.warn(`[fabricSampleService] Swatch not found in CMS: ${id}`);
          return name || id;
        })
    )
  );
}

/**
 * Upsert a CRM contact and return contactId (may be undefined on failure).
 */
async function upsertContact(contact) {
  try {
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
  } catch (err) {
    console.error('[fabricSampleService] CRM upsert failed:', err);
    return undefined;
  }
}

/**
 * Trigger both confirmation + fulfillment emails.
 * Failures are logged but do not fail the request (record is already saved).
 */
async function triggerAutomationEmails({ contactId, swatchNames, shippingAddress }) {
  const variables = { swatchNames, swatchCount: swatchNames.length, shippingAddress };
  try {
    await triggeredEmails.emailContact('fabric_sample_confirmation', contactId || '', { variables });
  } catch (err) {
    console.error('[fabricSampleService] Confirmation email failed:', err);
  }
  try {
    await triggeredEmails.emailContact('fabric_sample_fulfillment', contactId || '', { variables });
  } catch (err) {
    console.error('[fabricSampleService] Fulfillment email failed:', err);
  }
}

// ── Web method ───────────────────────────────────────────────────────────────

/**
 * Submit a fabric sample request.
 *
 * @param {Object}   params
 * @param {string[]} params.swatchIds    - 1–3 swatch CMS IDs to request
 * @param {Object}   params.contactInfo  - shipping contact info
 * @param {string}   [params.productSlug] - optional referring product slug
 * @returns {Promise<{success: boolean, requestId?: string, error?: string}>}
 */
export const submitFabricSampleRequest = webMethod(
  Permissions.Anyone,
  async (params) => {
    try {
      const { swatchIds, contactInfo, productSlug: rawSlug } = params || {};

      // Validate swatches
      const swatchValidation = validateSwatchIds(swatchIds);
      if (swatchValidation.error) return { success: false, error: swatchValidation.error };
      const cleanIds = swatchValidation.cleanIds;

      // Validate contact
      const contact = validateContact(contactInfo);
      if (contact.error) return { success: false, error: contact.error };

      // Rate limit
      const limited = await isRateLimited(contact.email);
      if (limited) {
        return { success: false, error: 'You may only request samples once every 30 days.' };
      }

      // Sanitize optional product slug
      const cleanSlug = rawSlug ? sanitize(String(rawSlug), 200).trim() || undefined : undefined;

      // Resolve swatch names
      const swatchNames = await resolveSwatchNames(cleanIds);

      // Upsert CRM contact
      const contactId = await upsertContact(contact);

      const shippingAddress = {
        address1: contact.address1,
        ...(contact.address2 ? { address2: contact.address2 } : {}),
        city:  contact.city,
        state: contact.state,
        zip:   contact.zip,
      };

      // Persist request
      const record = {
        contactEmail: contact.email,
        contactName:  `${contact.firstName} ${contact.lastName}`,
        contactId:    contactId || '',
        swatchIds:    cleanIds,
        swatchNames,
        shippingAddress,
        requestedAt: new Date(),
        status: 'pending',
        ...(cleanSlug ? { productSlug: cleanSlug } : {}),
      };
      const inserted = await wixData.insert('FabricSampleRequests', record);

      // Trigger Wix Automation emails (non-blocking — failure doesn't fail the request)
      triggerAutomationEmails({ contactId, swatchNames, shippingAddress })
        .catch(err => console.error('[fabricSampleService] Automation trigger error:', err));

      return { success: true, requestId: inserted._id };
    } catch (err) {
      console.error('[fabricSampleService] submitFabricSampleRequest error:', err);
      return { success: false, error: err.message || 'Failed to submit fabric sample request.' };
    }
  }
);
