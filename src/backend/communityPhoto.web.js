/**
 * @module communityPhoto.web
 * @description Backend webMethod for the customer photo gallery (UGC).
 *
 * cfw's `/community-gallery` page collects {imageUrl, customerName, location,
 * caption, productSlug} and posts to /_functions/submitCommunityPhoto
 * (anonymous — no Bearer token). The submission is moderated: rows land in
 * the `CommunityPhotos` CMS collection with `status: 'pending'` and an
 * owner-side moderation flow (out of scope for this bead) approves or
 * rejects.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * cf-0h9q. Bead descendant of cf-vtx5 (cf-jqkg gap #2).
 *
 * @setup
 * Create the `CommunityPhotos` CMS collection in Wix Dashboard with fields:
 *   imageUrl (Text, required), customerName (Text, required),
 *   location (Text), caption (Text), productSlug (Text),
 *   submittedAt (Date), status (Text, default 'pending'),
 *   moderatorNotes (Text).
 * Permissions: Anyone (Insert) — wrapper enforces rate limit + validation.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateSlug } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logError } from 'backend/utils/errorHandler';

const COMMUNITY_PHOTOS_COLLECTION = 'CommunityPhotos';

// Permissive but safe URL guard — cfw uploads to a URL that the customer
// pasted from somewhere, and we don't want to trust untrusted input. Require
// https + a plausible host. The full image-URL validation (e.g., HEAD probe
// + content-type check) lives in the moderation step, not here.
const HTTPS_URL_RE = /^https:\/\/[a-zA-Z0-9.-]+(:\d+)?(\/[^\s]*)?$/;

const FIELD_CAPS = {
  imageUrl: 500,
  customerName: 200,
  location: 200,
  caption: 2000,
  productSlug: 100,
};

/**
 * Validate a community-photo submission payload. Returns `null` on success,
 * or `{ error: string }` describing the first failure.
 *
 * @param {Object} data
 * @param {string} data.imageUrl
 * @param {string} data.customerName
 * @param {string} [data.location]
 * @param {string} [data.caption]
 * @param {string} [data.productSlug]
 */
export function _validateCommunityPhoto(data) {
  if (!data || typeof data !== 'object') {
    return { error: 'Invalid payload' };
  }
  const imageUrl = typeof data.imageUrl === 'string' ? data.imageUrl.trim() : '';
  if (!imageUrl) return { error: 'imageUrl is required' };
  if (imageUrl.length > FIELD_CAPS.imageUrl) return { error: 'imageUrl is too long' };
  if (!HTTPS_URL_RE.test(imageUrl)) return { error: 'imageUrl must be an https URL' };

  const customerName = typeof data.customerName === 'string' ? data.customerName.trim() : '';
  if (!customerName) return { error: 'customerName is required' };
  if (customerName.length > FIELD_CAPS.customerName) return { error: 'customerName is too long' };

  if (data.location != null && typeof data.location !== 'string') {
    return { error: 'location must be a string' };
  }
  if (data.caption != null && typeof data.caption !== 'string') {
    return { error: 'caption must be a string' };
  }
  if (data.productSlug != null && typeof data.productSlug !== 'string') {
    return { error: 'productSlug must be a string' };
  }
  if (data.productSlug && !validateSlug(data.productSlug)) {
    return { error: 'productSlug must be a valid slug' };
  }
  if (typeof data.location === 'string' && data.location.length > FIELD_CAPS.location) {
    return { error: 'location is too long' };
  }
  if (typeof data.caption === 'string' && data.caption.length > FIELD_CAPS.caption) {
    return { error: 'caption is too long' };
  }
  return null;
}

/**
 * Submit a community photo. Anonymous; rate-limited per imageUrl host
 * (5 / hour) at the wrapper layer. Inserts a row with `status: 'pending'`
 * for the owner-side moderation flow.
 *
 * @function submitCommunityPhoto
 * @param {Object} data
 * @returns {Promise<{success: boolean, photoId?: string, error?: string}>}
 * @permission Anyone
 */
export const submitCommunityPhoto = webMethod(
  Permissions.Anyone,
  async (data) => {
    const invalid = _validateCommunityPhoto(data);
    if (invalid) return { success: false, error: invalid.error };

    // cf-0h9q.fu: per-host rate-limit is a coarse UGC abuse damper, not
    // the primary defense — moderation is. Tracked: cf-* follow-up to
    // switch to IP-based or session-based keying once Wix HTTP function
    // exposes request.ip cleanly to the webMethod surface (today only
    // the wrapper sees it). Until then host-keying caps a single
    // attacker domain but lets multiple attackers under different CDNs
    // each get their own bucket — known limitation.
    const host = (data.imageUrl.match(/^https:\/\/([^/]+)/) || [])[1] || 'unknown';
    try {
      const rl = await checkRateLimit('CommunityPhotoRateLimit', host, {
        max: 5,
        windowMs: 60 * 60 * 1000,
      });
      if (!rl.allowed) {
        return { success: false, error: 'Too many requests — please try again later.' };
      }
    } catch (err) {
      // Fail-open on rate-limit infra error — sanity-cap by relying on
      // moderation. Log includes the host so ops can spot whether a
      // single domain is repeatedly tripping a broken rate-limit store.
      logError(`communityPhoto.submitCommunityPhoto.rateLimit host=${host}`, err);
    }

    const row = {
      imageUrl: sanitize(data.imageUrl, FIELD_CAPS.imageUrl),
      customerName: sanitize(data.customerName, FIELD_CAPS.customerName),
      location: sanitize(data.location || '', FIELD_CAPS.location),
      caption: sanitize(data.caption || '', FIELD_CAPS.caption),
      productSlug: sanitize(data.productSlug || '', FIELD_CAPS.productSlug),
      submittedAt: new Date(),
      status: 'pending',
      moderatorNotes: '',
    };

    try {
      const inserted = await wixData.insert(COMMUNITY_PHOTOS_COLLECTION, row, { suppressAuth: true });
      return { success: true, photoId: inserted._id };
    } catch (err) {
      logError('communityPhoto.submitCommunityPhoto.insert', err);
      return { success: false, error: 'Submission failed — please try again later.' };
    }
  },
);
