/**
 * @module fabricSampleService
 * @description Handles fabric sample request submissions from PDP and Fabric Customizer.
 * Validates up to 3 swatch selections, enforces 30-day per-email rate limit,
 * persists to FabricSampleRequests CMS, and triggers confirmation + admin emails.
 *
 * CMS collections:
 * - FabricSwatches (read) — available swatches
 * - FabricSampleRequests (write) — submitted requests
 *
 * @requires wix-web-module
 * @requires wix-crm-backend
 * @requires wix-data
 * @requires backend/utils/sanitize
 */
import { webMethod, Permissions } from 'wix-web-module';
import { triggeredEmails } from 'wix-crm-backend';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const MAX_SWATCHES = 3;
const RATE_LIMIT_DAYS = 30;

// ── Validation helpers ────────────────────────────────────────────────

function validateSwatchIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { error: 'At least one swatch must be selected.' };
  }
  if (ids.length > MAX_SWATCHES) {
    return { error: `Maximum ${MAX_SWATCHES} swatches may be requested at once.` };
  }
  const clean = [];
  for (const id of ids) {
    if (typeof id !== 'string' || !id.trim()) {
      return { error: 'Invalid swatch ID in selection.' };
    }
    clean.push(id.trim());
  }
  if (new Set(clean).size < clean.length) {
    return { error: 'Duplicate swatch IDs are not allowed.' };
  }
  return { cleanIds: clean };
}

function validateContactInfo(raw) {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Contact information is required.' };
  }
  const name = sanitize(raw.name || '', 200).trim();
  if (!name) return { error: 'Name is required.' };

  const email = (raw.email || '').toLowerCase().trim();
  if (!validateEmail(email)) return { error: 'A valid email address is required.' };

  const address = sanitize(raw.address || '', 500).trim();
  if (!address) return { error: 'Shipping address is required.' };

  return { name, email, address };
}

// ── Rate limit check ──────────────────────────────────────────────────

async function isRateLimited(email) {
  const cutoff = new Date(Date.now() - RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000);
  const result = await wixData
    .query('FabricSampleRequests')
    .eq('contactEmail', email)
    .gt('requestedAt', cutoff)
    .limit(1)
    .find();
  return result.items.length > 0;
}

// ── Swatch name resolution ────────────────────────────────────────────

async function resolveSwatchNames(swatchIds) {
  const names = await Promise.all(
    swatchIds.map(id =>
      wixData.query('FabricSwatches').eq('_id', id).limit(1).find()
        .then(r => r.items[0]?.swatchName || id)
    )
  );
  return names;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Get all in-stock swatches available for sampling.
 */
export const getAvailableSwatches = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData
        .query('FabricSwatches')
        .eq('inStock', true)
        .ascending('swatchName')
        .find();
      return {
        success: true,
        data: {
          swatches: result.items.map(item => ({
            _id: item._id,
            swatchName: item.swatchName,
            colorFamily: item.colorFamily,
            swatchImage: item.swatchImage || null,
          })),
        },
      };
    } catch (err) {
      console.error('[fabricSampleService] getAvailableSwatches error:', err);
      return { success: false, error: err.message || 'Failed to load swatches.' };
    }
  }
);

/**
 * Submit a fabric sample request from the PDP or Fabric Customizer modal.
 *
 * @param {Object} params
 * @param {string[]} params.swatchIds    — 1–3 swatch IDs
 * @param {Object}  params.contactInfo  — { name, email, address }
 * @param {string}  [params.productId]  — optional referring product ID
 * @returns {Promise<{success: boolean, requestId?: string, error?: string}>}
 */
export const submitFabricSample = webMethod(
  Permissions.Anyone,
  async (params) => {
    try {
      const { swatchIds, contactInfo, productId: rawProductId } = params || {};

      // Validate swatches
      const swatchValidation = validateSwatchIds(swatchIds);
      if (swatchValidation.error) return { success: false, error: swatchValidation.error };
      const { cleanIds } = swatchValidation;

      // Validate contact
      const contactValidation = validateContactInfo(contactInfo);
      if (contactValidation.error) return { success: false, error: contactValidation.error };
      const { name, email, address } = contactValidation;

      // Rate limit check
      const limited = await isRateLimited(email);
      if (limited) {
        return { success: false, error: 'You have already requested swatches within the last 30 days.' };
      }

      // Resolve swatch names
      const swatchNames = await resolveSwatchNames(cleanIds);

      // Sanitize optional productId
      const productId = rawProductId ? sanitize(String(rawProductId), 200).trim() || undefined : undefined;

      // Persist request
      const record = {
        contactEmail:    email,
        contactName:     name,
        shippingAddress: address,
        swatchIds:       cleanIds,
        swatchNames,
        requestedAt:     new Date(),
        status:          'pending',
        ...(productId ? { productId } : {}),
      };

      const inserted = await wixData.insert('FabricSampleRequests', record);

      // Send confirmation email to customer (non-blocking on failure)
      try {
        await triggeredEmails.emailContact('fabric_sample_confirmation', null, {
          variables: { name, swatchNames: swatchNames.join(', '), address },
          toEmail: email,
        });
      } catch (emailErr) {
        console.error('[fabricSampleService] Confirmation email failed:', emailErr);
      }

      // Send admin notification email for fulfillment (non-blocking on failure)
      try {
        await triggeredEmails.emailContact('fabric_sample_admin_notify', null, {
          variables: { name, email, swatchNames: swatchNames.join(', '), address, productId: productId || '' },
          toEmail: 'carolinafutons@gmail.com',
        });
      } catch (emailErr) {
        console.error('[fabricSampleService] Admin notification email failed:', emailErr);
      }

      return { success: true, requestId: inserted._id };
    } catch (err) {
      console.error('[fabricSampleService] submitFabricSample error:', err);
      return { success: false, error: err.message || 'Failed to submit sample request.' };
    }
  }
);
