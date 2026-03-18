/**
 * @module wishlistShareHelpers
 * Wishlist Share Page — pure helper functions for CF-y24r
 * All $w() wiring is in 'Wishlist Share.js'; this module is pure functions only.
 */

// ── S1: Token parsing ─────────────────────────────────────────────────────────

/**
 * Extract the share token from the URL query object.
 * @param {Object|null|undefined} query - wixLocation.query
 * @returns {string|null}
 */
export function parseShareToken(query) {
  const raw = query?.share;
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ── S1: Invalid state messages ────────────────────────────────────────────────

const INVALID_MESSAGES = {
  missing_token: 'No wishlist link was provided. Please check your link and try again.',
  not_found: 'This wishlist link was not found. It may have been removed.',
  expired: 'This wishlist link has expired. Ask the owner to share a new link.',
  error: 'Unable to load this wishlist. Please try again later.',
};

/**
 * Return a human-readable message for an invalid token reason.
 * @param {string} reason
 * @returns {string}
 */
export function buildInvalidMessage(reason) {
  return INVALID_MESSAGES[reason] || INVALID_MESSAGES.error;
}
