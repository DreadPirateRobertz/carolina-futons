/**
 * @module ugcTaxonomy
 * @description Shared taxonomy and validation for User-Generated Content (Real Rooms gallery).
 * Used by both frontend (ShareYourRoom widget) and backend (customerRoomPhotos.web).
 *
 * CF-rw9i.3
 */

// ── ROOM_TYPES ────────────────────────────────────────────────────────────────

/**
 * Canonical room type values for UGC photo submissions.
 * @enum {string}
 */
export const ROOM_TYPES = {
  LIVING_ROOM: 'living-room',
  BEDROOM:     'bedroom',
  OFFICE:      'office',
  DORM:        'dorm',
  PORCH:       'porch',
  OTHER:       'other',
};

/** Ordered list of valid roomType values. */
export const ROOM_TYPE_VALUES = Object.values(ROOM_TYPES);

// ── validatePhotoMetadata ─────────────────────────────────────────────────────

const MAX_CAPTION_LENGTH = 200;
const MAX_ID_LENGTH      = 50;
const MAX_NAME_LENGTH    = 200;

/**
 * Validate photo submission metadata before persisting.
 *
 * @param {object} obj
 * @param {string}      obj.photoUrl    - Wix media URL of the uploaded photo (required)
 * @param {string}      obj.roomType    - One of ROOM_TYPE_VALUES (required)
 * @param {string}      [obj.caption]   - Optional caption, max 200 chars
 * @param {string|null} [obj.productId] - Associated product ID (optional)
 * @param {string|null} [obj.productName] - Associated product name (optional)
 * @returns {{ valid: true } | { valid: false, error: string }}
 */
export function validatePhotoMetadata(obj) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, error: 'Metadata must be an object.' };
  }

  const photoUrl = (obj.photoUrl || '').trim();
  if (!photoUrl) {
    return { valid: false, error: 'photoUrl is required.' };
  }
  if (!photoUrl.startsWith('wix:image://') && !photoUrl.startsWith('https://')) {
    return { valid: false, error: 'photoUrl must be a Wix media URL or HTTPS URL.' };
  }

  const roomType = (obj.roomType || '').trim();
  if (!roomType) {
    return { valid: false, error: 'roomType is required.' };
  }
  if (!ROOM_TYPE_VALUES.includes(roomType)) {
    return { valid: false, error: `Invalid roomType. Must be one of: ${ROOM_TYPE_VALUES.join(', ')}.` };
  }

  if (obj.caption !== undefined && obj.caption !== null) {
    const caption = String(obj.caption);
    if (caption.length > MAX_CAPTION_LENGTH) {
      return { valid: false, error: `caption must be ${MAX_CAPTION_LENGTH} characters or fewer.` };
    }
  }

  if (obj.productId !== undefined && obj.productId !== null) {
    if (typeof obj.productId !== 'string' || obj.productId.length > MAX_ID_LENGTH) {
      return { valid: false, error: `productId must be a string of ${MAX_ID_LENGTH} characters or fewer.` };
    }
  }

  if (obj.productName !== undefined && obj.productName !== null) {
    if (typeof obj.productName !== 'string' || obj.productName.length > MAX_NAME_LENGTH) {
      return { valid: false, error: `productName must be a string of ${MAX_NAME_LENGTH} characters or fewer.` };
    }
  }

  return { valid: true };
}
