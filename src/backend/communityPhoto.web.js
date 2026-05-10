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
 * Submit a community photo. Anonymous; rate-limited (5 / hour). Inserts a
 * row with `status: 'pending'` for the owner-side moderation flow.
 *
 * @function submitCommunityPhoto
 * @param {Object} data
 * @param {Object} [opts]
 * @param {string} [opts.rateLimitKey] - Identifier the rate limiter buckets
 *   on. Wrappers that have access to the request object should pass the
 *   client IP (taken from x-forwarded-for) here so the bucket axis is
 *   per-client rather than per-imageUrl-host. When absent (e.g. direct
 *   webMethod callsites with no HTTP context), falls back to the imageUrl
 *   host — the original cf-0h9q axis.
 * @returns {Promise<{success: boolean, photoId?: string, error?: string}>}
 * @permission Anyone
 */
export const submitCommunityPhoto = webMethod(
  Permissions.Anyone,
  async (data, opts = {}) => {
    const invalid = _validateCommunityPhoto(data);
    if (invalid) return { success: false, error: invalid.error };

    // Trim once, reuse below — both the host-extraction regex and the
    // sanitized CMS row need the leading-whitespace-stripped form.
    // _validateCommunityPhoto only trims into a local var; without this
    // line, a leading-space input would land 'unknown' in the host-axis
    // bucket and a leading-space imageUrl in the CMS row.
    const imageUrl = data.imageUrl.trim();

    // cf-k5vr: rate-limit on a per-client axis when the caller can supply
    // one (the post_submitCommunityPhoto wrapper extracts x-forwarded-for
    // and passes it). The previous host-axis was a coarse UGC abuse
    // damper that shared one bucket across every photo URL on the same
    // CDN — popular CDNs like static.wixstatic.com would rate-limit
    // legitimate users while attackers under their own domain got fresh
    // buckets. Falling back to host preserves the old behavior for
    // direct webMethod callsites that don't have a request object.
    const host = (imageUrl.match(/^https:\/\/([^/]+)/) || [])[1] || 'unknown';
    const rateLimitKey =
      typeof opts.rateLimitKey === 'string' && opts.rateLimitKey.length > 0
        ? opts.rateLimitKey
        : host;
    const axis = opts.rateLimitKey ? 'ip' : 'host';
    try {
      const rl = await checkRateLimit('CommunityPhotoRateLimit', rateLimitKey, {
        max: 5,
        windowMs: 60 * 60 * 1000,
      });
      if (!rl.allowed) {
        return { success: false, error: 'Too many requests — please try again later.' };
      }
    } catch (err) {
      // Fail-open on rate-limit infra error — sanity-cap by relying on
      // moderation. The axis label (ip|host) lets ops correlate a broken
      // rate-limit store to which keying scheme was active. The key
      // itself is sha256-style hashed inside checkRateLimit before
      // storage so it never lands in the bucket DB plaintext, but we
      // still avoid logging the raw IP here for defense in depth.
      logError(`communityPhoto.submitCommunityPhoto.rateLimit axis=${axis}`, err);
    }

    const row = {
      imageUrl: sanitize(imageUrl, FIELD_CAPS.imageUrl),
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
