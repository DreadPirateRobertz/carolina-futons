/**
 * @module communityGalleryService
 * @description Community Gallery — browse approved customer photos by room type.
 * Queries the PhotoReviews collection (from CF-zkdy) filtered by roomType and
 * approval status. Cursor-based pagination, 12 photos per page.
 *
 * Security controls (Dutch CF-n2gh ClickFix patterns):
 *   - sanitizeGalleryFilename: strips all non-alphanumeric chars from filenames
 *   - stripUrlsFromCaption: removes URLs from captions before storage/display
 *   - validateDeepLinkRoute: allowlist-only deep link validation
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * PhotoReviews collection must include:
 *   roomType (Text, indexed) — one of GALLERY_ROOM_TYPES
 *   status (Text, indexed)   — 'pending'|'approved'|'rejected'|'featured'
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, generateUUIDFilename } from 'backend/utils/sanitize';

export const GALLERY_ROOM_TYPES = ['living-room', 'bedroom', 'studio', 'office', 'dorm'];
const GALLERY_PAGE_SIZE = 12;
const GALLERY_MAX_LIMIT = 48;
const APPROVED_STATUSES = ['approved', 'featured'];

// ── Deep link route allowlist ─────────────────────────────────────────
// Only these routes may be used in gallery share links.
// Keys are valid route names; values are arrays of allowed param names.
const DEEP_LINK_ALLOWLIST = {
  '/gallery':         ['roomType', 'page'],
  '/gallery/photo':   ['id'],
  '/product-page':    ['slug'],
};

// ── Security: filename sanitization ──────────────────────────────────

/**
 * Sanitize a photo filename for safe storage.
 * Strips all characters except alphanumeric, dots, hyphens, and underscores.
 * Rejects filenames with no extension, multiple dots, path separators,
 * or embedded URLs (http/https/ftp schemes).
 *
 * @param {string} filename - Raw filename from upload.
 * @returns {{ safe: boolean, filename: string }} safe=false if rejected.
 */
export function sanitizeGalleryFilename(filename) {
  if (typeof filename !== 'string' || !filename.trim()) {
    return { safe: false, filename: '' };
  }
  const raw = filename.trim();

  // Reject URLs embedded in filenames (ClickFix attack vector)
  if (/https?:\/\/|ftp:\/\//i.test(raw)) {
    return { safe: false, filename: '' };
  }

  // Reject path traversal
  if (/[/\\]/.test(raw)) {
    return { safe: false, filename: '' };
  }

  // Strip to alphanumeric + safe punctuation
  const stripped = raw.replace(/[^a-zA-Z0-9._-]/g, '');

  // Must have exactly one dot (for the extension), no leading dots
  const dotCount = (stripped.match(/\./g) || []).length;
  if (dotCount !== 1 || stripped.startsWith('.')) {
    return { safe: false, filename: '' };
  }

  const [base, ext] = stripped.split('.');
  if (!base || !ext || base.length > 100 || ext.length > 10) {
    return { safe: false, filename: '' };
  }

  // Extension must be a known image type
  const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'];
  if (!ALLOWED_EXTENSIONS.includes(ext.toLowerCase())) {
    return { safe: false, filename: '' };
  }

  return { safe: true, filename: stripped };
}

/**
 * Replace a user-supplied filename with a UUID-based filename.
 * CF-rr8d: ClickFix hardening — prevents filename-based injection,
 * information leakage (original filenames can reveal device/app metadata),
 * and path traversal via crafted filenames.
 *
 * @param {string} originalFilename - Raw filename from upload.
 * @returns {{ safe: boolean, filename: string }} UUID-based filename or rejection.
 */
export function toUUIDFilename(originalFilename) {
  const validation = sanitizeGalleryFilename(originalFilename);
  if (!validation.safe) return validation;
  const ext = validation.filename.split('.').pop();
  return { safe: true, filename: generateUUIDFilename(ext) };
}

// ── Security: caption URL stripping ──────────────────────────────────

/**
 * Strip URLs and linkifiable patterns from a caption string.
 * Prevents attacker-crafted captions from rendering as tappable links
 * on mobile (ClickFix attack vector).
 *
 * Strips: http/https/ftp URLs, bare domain patterns (e.g. "evil.com"),
 * and email addresses.
 *
 * @param {string} caption - Raw caption text.
 * Maximum output length is always 200 characters.
 * @returns {string} Caption with all linkifiable patterns removed.
 */
export function stripUrlsFromCaption(caption) {
  if (typeof caption !== 'string') return '';
  let result = caption;
  // Strip full URLs (http/https/ftp)
  result = result.replace(/https?:\/\/\S+/gi, '');
  result = result.replace(/ftp:\/\/\S+/gi, '');
  // Strip email addresses before bare domains (email regex requires tld which bare domain regex would eat first)
  result = result.replace(/\S+@\S+\.\S+/g, '');
  // Strip bare domain patterns (word.tld or sub.word.tld)
  result = result.replace(/\b[\w-]+\.(?:com|net|org|io|co|app|shop|store|link|ly|gl|bit|gg|tv|cc|info|biz|me|us|uk|ca|de|fr|au)\b\S*/gi, '');
  // Collapse extra whitespace from removed patterns
  return result.replace(/\s{2,}/g, ' ').trim().slice(0, 200);
}

// ── Security: deep link validation ────────────────────────────────────

/**
 * Validate a gallery deep link route and its parameters against an allowlist.
 * Unknown routes or disallowed param names are rejected. This prevents
 * attacker-crafted share links from reaching privileged functions.
 *
 * @param {string} route - Route path (e.g. '/gallery').
 * @param {Object} [params={}] - Route parameters.
 * @returns {{ valid: boolean, route: string, params: Object }}
 *   valid=false if route or any param is not on the allowlist.
 *   On rejection, returns safe fallback route '/gallery' with empty params.
 */
export function validateDeepLinkRoute(route, params = {}) {
  const FALLBACK = { valid: false, route: '/gallery', params: {} };

  if (typeof route !== 'string') return FALLBACK;

  const allowedParams = DEEP_LINK_ALLOWLIST[route];
  if (!allowedParams) {
    // Unknown route — reject, return safe fallback
    return FALLBACK;
  }

  const cleanParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (!allowedParams.includes(key)) {
      // Disallowed param name — reject entire link
      return FALLBACK;
    }
    // Sanitize param value to prevent injection
    cleanParams[key] = sanitize(String(value), 200);
  }

  return { valid: true, route, params: cleanParams };
}

// ── getGalleryPhotos ──────────────────────────────────────────────────

/**
 * Get approved community gallery photos, optionally filtered by room type.
 * Results are sorted by newest first. Supports cursor-based pagination.
 *
 * @param {string|null} roomType - Room type slug or 'all' / null for all rooms.
 * @param {number} [page=1] - Page number (1-based).
 * @param {number} [limit=12] - Photos per page (max 48).
 * @returns {Promise<{success: boolean, photos: Array, hasMore: boolean, total: number, error?: string}>}
 */
export const getGalleryPhotos = webMethod(
  Permissions.Anyone,
  async (roomType = null, page = 1, limit = GALLERY_PAGE_SIZE) => {
    try {
      const parsedLimit = Number(limit);
      const safeLimit = Math.min(Math.max(Number.isNaN(parsedLimit) ? GALLERY_PAGE_SIZE : parsedLimit, 1), GALLERY_MAX_LIMIT);
      const safePage = Math.max(Number(page) || 1, 1);
      const skip = (safePage - 1) * safeLimit;

      let query = wixData.query('PhotoReviews')
        .hasSome('status', APPROVED_STATUSES)
        .descending('submittedAt')
        .limit(safeLimit)
        .skip(skip);

      // Filter by room type if specified (and not 'all')
      if (roomType && roomType !== 'all') {
        const cleanRoom = sanitize(roomType, 50);
        if (!GALLERY_ROOM_TYPES.includes(cleanRoom)) {
          return { success: false, error: 'Invalid room type.', photos: [], hasMore: false, total: 0 };
        }
        query = query.eq('roomType', cleanRoom);
      }

      const result = await query.find();
      const photos = result.items.map(item => ({
        id: item._id,
        photoUrl: item.photoUrl || '',
        photoCaption: stripUrlsFromCaption(item.photoCaption || ''),
        customerName: sanitize(item.memberName || item.customerName || 'Customer', 100),
        roomType: item.roomType || '',
        productId: item.productId || '',
        productName: sanitize(item.productName || '', 200),
        productSlug: sanitize(item.productSlug || '', 100),
        rating: typeof item.rating === 'number' ? item.rating : 0,
        submittedAt: item.submittedAt || null,
        isFeatured: item.status === 'featured',
      }));

      return {
        success: true,
        photos,
        hasMore: result.totalCount > skip + photos.length,
        total: result.totalCount,
        page: safePage,
      };
    } catch (err) {
      console.error('[communityGalleryService] Error loading gallery photos:', err.message);
      return { success: false, error: 'Failed to load gallery photos.', photos: [], hasMore: false, total: 0 };
    }
  }
);

// ── getGalleryRoomTypes ───────────────────────────────────────────────

/**
 * Get the list of valid room type filter options for the gallery.
 *
 * @returns {Promise<{success: boolean, roomTypes: Array<{slug: string, label: string}>}>}
 */
export const getGalleryRoomTypes = webMethod(
  Permissions.Anyone,
  async () => {
    const LABELS = {
      'living-room': 'Living Room',
      'bedroom':     'Bedroom',
      'studio':      'Studio',
      'office':      'Office',
      'dorm':        'Dorm Room',
    };
    const roomTypes = GALLERY_ROOM_TYPES.map(slug => ({ slug, label: LABELS[slug] || slug }));
    return { success: true, roomTypes };
  }
);
