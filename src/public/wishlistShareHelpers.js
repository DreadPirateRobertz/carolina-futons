/**
 * @module wishlistShareHelpers
 * Wishlist Share Page — pure helper functions for CF-y24r + CF-4qll S2 + CF-muzy S5
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

// ── S2: Product card population ───────────────────────────────────────────────

/**
 * Populate a repeater card with wishlist item data from S1.
 * Called inside onItemReady — registered BEFORE .data= assignment.
 * Item shape: { _id, productId, productName, productImage }
 * @param {Function} $item - scoped $w for the repeater item
 * @param {{ productName: string, productImage: string }} itemData
 */
export function populateShareCard($item, itemData) {
  try { $item('#shareImage').src = itemData.productImage || ''; } catch (e) {}
  try { $item('#shareImage').alt = `${itemData.productName || 'Product'} - wishlist item`; } catch (e) {}
  try { $item('#shareName').text = itemData.productName || ''; } catch (e) {}
}

// ── S5: SEO helpers ───────────────────────────────────────────────────────────

const BRAND = 'Carolina Futons';

/**
 * Build the SEO page title for a shared wishlist.
 * @param {string|null} ownerName
 * @returns {string}
 */
export function buildWishlistTitle(ownerName) {
  if (!ownerName) return `Shared Wishlist | ${BRAND}`;
  return `${ownerName}'s Wishlist | ${BRAND}`;
}

/**
 * Build the SEO meta description for a shared wishlist.
 * Kept under 160 characters.
 * @param {string} ownerName
 * @param {number} itemCount
 * @returns {string}
 */
export function buildWishlistDescription(ownerName, itemCount) {
  const name = ownerName || 'Someone';
  const items = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
  const raw = `${name} has ${items} saved on ${BRAND}. Browse their wishlist and shop futons, frames, and more.`;
  return raw.length <= 160 ? raw : raw.slice(0, 157) + '…';
}

/**
 * Build Open Graph meta tag objects for the share page.
 * @param {string} ownerName - Wishlist owner's display name
 * @param {string} description - Pre-built meta description string
 * @param {Object[]} items - Wishlist items (uses first item's productImage for og:image)
 * @returns {{ property: string, content: string }[]}
 */
export function buildWishlistOgTags(ownerName, description, items) {
  const title = buildWishlistTitle(ownerName);
  const tags = [
    { property: 'og:type',        content: 'website' },
    { property: 'og:title',       content: title },
    { property: 'og:description', content: description },
  ];
  const firstImage = items?.[0]?.productImage;
  if (firstImage) {
    tags.push({ property: 'og:image', content: firstImage });
  }
  return tags;
}
