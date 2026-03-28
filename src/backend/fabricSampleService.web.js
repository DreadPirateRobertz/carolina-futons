/**
 * @module fabricSampleService
 * @description Fabric sample (free swatch mailer) request handler.
 *
 * Flow:
 *  1. Validate swatchIds (1–3 unique, alphanumeric IDs) and contactInfo
 *  2. Rate-limit: 1 request per email address per 30 days (queries contactEmail field, lowercase)
 *  3. Resolve swatch names from FabricSwatches CMS (single bulk query, fallback to ID)
 *  4. Upsert CRM contact via wix-crm-backend
 *  5. Persist to FabricSampleRequests collection (status: pending)
 *  6. Trigger Wix Automation emails (fire-and-forget — intentional; record is saved first):
 *     - fabric_sample_confirmation (customer confirmation)
 *     - fabric_sample_fulfillment (fulfillment notification to internal team via CRM contact)
 *
 * CMS collections:
 *  - FabricSwatches (read) — available swatch catalog
 *  - FabricSampleRequests (write) — submitted requests
 */
import { webMethod, Permissions } from 'wix-web-module';
import { triggeredEmails, contacts } from 'wix-crm-backend';
import wixData from 'wix-data';
import { sanitize, validateEmail, validateId } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';

const MAX_SWATCHES = 3;
const RATE_LIMIT_DAYS = 30;
const ZIP_RE = /^\d{5}$/;

// Accepts E.164 (+15551234567, +441234567890, etc.) or NANP
// (5551234567, 555-123-4567, (555) 123-4567, 555.123.4567).
// Phone is optional — validated only when present.
const PHONE_RE = /^(\+\d{7,15}|(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.\-]?)\d{3}[\s.\-]?\d{4})$/;

// ── Validators ───────────────────────────────────────────────────────────────

function validateSwatchIds(ids) {
  if (!Array.isArray(ids)) return { error: 'Swatch IDs must be provided as an array.' };
  if (ids.length === 0) return { error: 'At least one swatch must be selected.' };
  if (ids.length > MAX_SWATCHES) return { error: `Maximum ${MAX_SWATCHES} swatches may be requested at once.` };
  const cleanIds = [];
  for (const id of ids) {
    const clean = typeof id === 'string' ? validateId(id.trim()) : null;
    if (!clean) return { error: 'Invalid swatch ID in selection.' };
    cleanIds.push(clean);
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

  const phone = raw.phone ? sanitize(raw.phone, 30).trim() : undefined;
  if (phone && !PHONE_RE.test(phone)) {
    return { error: 'Phone number format is invalid. Use a 10-digit US number or E.164 format (e.g. +15551234567).' };
  }

  return {
    firstName,
    lastName,
    email,
    address1,
    address2: sanitize(raw.address2 || '', 200).trim() || undefined,
    city,
    state,
    zip,
    phone,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if there is a FabricSampleRequests record for this email
 * (lowercase-normalized, stored in `contactEmail`) within the last RATE_LIMIT_DAYS days.
 *
 * TOCTOU note: wix-data provides no atomic conditional insert, so a small
 * race window exists between this check and the subsequent wixData.insert().
 * Duplicate requests within milliseconds could both pass. Acceptable given
 * the low-volume, low-stakes nature of fabric sample requests.
 */
async function isRateLimited(email) {
  try {
    const cutoff = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000);
    const result = await wixData.query('FabricSampleRequests')
      .eq('contactEmail', email)
      .ge('requestedAt', cutoff)
      .limit(1)
      .find();
    return result.items.length > 0;
  } catch (err) {
    console.error('[fabricSampleService] Rate limit check failed:', err);
    throw err; // propagate so the caller can return a distinct error
  }
}

/**
 * Resolve human-readable swatch names via a single bulk query on FabricSwatches.
 * Falls back to the raw ID when a swatch is not found — logs a warning.
 */
async function resolveSwatchNames(swatchIds) {
  try {
    const result = await wixData.query('FabricSwatches')
      .hasSome('_id', swatchIds)
      .limit(MAX_SWATCHES)
      .find();
    const nameMap = new Map(result.items.map(item => [item._id, item.name]));
    return swatchIds.map(id => {
      const name = nameMap.get(id);
      if (!name) console.warn(`[fabricSampleService] Swatch not found in CMS: ${id}`);
      return name || id;
    });
  } catch (err) {
    console.error('[fabricSampleService] FabricSwatches query failed — using IDs as fallback:', err);
    return swatchIds; // fallback: use raw IDs so the request is not lost
  }
}

/**
 * Upsert a CRM contact and return contactId, or undefined on failure.
 * When undefined, automation emails will be skipped and crmSyncFailed set on the record.
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
 * Trigger confirmation + fulfillment emails for a successful request.
 * Each email is wrapped in its own try-catch so one failure does not prevent the other.
 * Called without await — email failures must not roll back the persisted record.
 */
async function triggerAutomationEmails({ contactId, swatchNames, shippingAddress }) {
  const variables = { swatchNames, swatchCount: swatchNames.length, shippingAddress };
  try {
    await triggeredEmails.emailContact('fabric_sample_confirmation', contactId, { variables });
  } catch (err) {
    console.error('[fabricSampleService] Confirmation email failed:', err);
  }
  try {
    await triggeredEmails.emailContact('fabric_sample_fulfillment', contactId, { variables });
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

      const { error: swatchError, cleanIds } = validateSwatchIds(swatchIds);
      if (swatchError) return { success: false, error: swatchError };

      const contact = validateContact(contactInfo);
      if (contact.error) return { success: false, error: contact.error };

      const { allowed } = await checkRateLimit('FabricSampleRateLimit', contact.email);
      if (!allowed) return { success: false, error: 'Too many requests. Please try again later.' };

      let limited;
      try {
        limited = await isRateLimited(contact.email);
      } catch (_err) {
        return { success: false, error: 'Unable to process your request right now. Please try again.' };
      }
      if (limited) {
        return { success: false, error: 'You may only request samples once every 30 days.' };
      }

      const cleanSlug = rawSlug ? sanitize(String(rawSlug), 200).trim() : undefined;

      const swatchNames = await resolveSwatchNames(cleanIds);
      const contactId = await upsertContact(contact);

      const shippingAddress = {
        address1: contact.address1,
        address2: contact.address2,
        city:     contact.city,
        state:    contact.state,
        zip:      contact.zip,
      };

      const record = {
        contactEmail:  contact.email,
        contactName:   `${contact.firstName} ${contact.lastName}`,
        contactId:     contactId || '',
        swatchIds:     cleanIds,
        swatchNames,
        shippingAddress,
        requestedAt:   new Date(),
        status:        'pending',
        ...(cleanSlug    ? { productSlug:   cleanSlug } : {}),
        ...(contactId    ? {} : { crmSyncFailed: true }),
      };

      const inserted = await wixData.insert('FabricSampleRequests', record);

      if (contactId) {
        // Fire-and-forget — email failures must not roll back the persisted record
        triggerAutomationEmails({ contactId, swatchNames, shippingAddress })
          .catch(err => console.error('[fabricSampleService] Automation trigger error:', err));
      } else {
        console.error('[fabricSampleService] No contactId — skipping automation emails. Manual fulfillment required for:', contact.email);
      }

      return { success: true, requestId: inserted._id };
    } catch (err) {
      console.error('[fabricSampleService] submitFabricSampleRequest error:', err);
      return { success: false, error: 'Failed to submit fabric sample request. Please try again.' };
    }
  }
);
