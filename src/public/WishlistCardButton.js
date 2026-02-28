/**
 * WishlistCardButton.js — Heart toggle for product grid cards
 *
 * Adds wishlist add/remove functionality to product cards on Category Page.
 * Batch-checks wishlist status to minimize CMS queries, toggles heart icon,
 * prompts login for anonymous users.
 *
 * CF-ogdt: Wishlist & save for later
 *
 * @module WishlistCardButton
 */
import { trackEvent } from 'public/engagementTracker';
import { colors } from 'public/designTokens.js';

// SVG heart icons — same visual language as socialWishlist.js
const HEART_FILLED_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${colors.sunsetCoral}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`)}`;
const HEART_OUTLINE_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.espresso}" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`)}`;

/**
 * Batch-check which products are in the current member's wishlist.
 * Returns a Set of wishlisted product IDs for O(1) lookup.
 *
 * @param {string[]} productIds - Array of product IDs to check
 * @returns {Promise<Set<string>>} Set of wishlisted product IDs
 */
export async function batchCheckWishlistStatus(productIds) {
  try {
    if (!productIds || productIds.length === 0) return new Set();

    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();
    if (!member) return new Set();

    const wixData = (await import('wix-data')).default;
    const result = await wixData.query('Wishlist')
      .eq('memberId', member._id)
      .hasSome('productId', productIds)
      .find();

    return new Set(result.items.map(item => item.productId));
  } catch (e) {
    return new Set();
  }
}

/**
 * Initialize a wishlist heart button on a single product grid card.
 *
 * @param {Function} $item - Wix repeater item selector
 * @param {Object} product - Product data with _id, name, mainMedia
 * @param {boolean} isWishlisted - Whether this product is currently wishlisted
 */
export function initCardWishlistButton($item, product, isWishlisted) {
  try {
    if (!product) return;
    const btn = $item('#gridWishlistBtn');
    if (!btn) return;

    let wishlisted = isWishlisted;
    let busy = false;

    // Set initial state
    setHeartState($item, wishlisted, product.name);

    btn.onClick(async () => {
      if (busy) return;
      busy = true;

      try {
        const { currentMember, authentication } = await import('wix-members-frontend');
        const member = await currentMember.getMember();

        if (!member) {
          authentication.promptLogin();
          return;
        }

        const wixData = (await import('wix-data')).default;

        if (wishlisted) {
          // Remove from wishlist
          const existing = await wixData.query('Wishlist')
            .eq('memberId', member._id)
            .eq('productId', product._id)
            .find();

          if (existing.items.length > 0) {
            await wixData.remove('Wishlist', existing.items[0]._id);
          }
          wishlisted = false;
          setHeartState($item, false, product.name);
          trackEvent('wishlist_remove', { productId: product._id, source: 'product_card' });
        } else {
          // Add to wishlist
          await wixData.insert('Wishlist', {
            memberId: member._id,
            productId: product._id,
            productName: product.name,
            productImage: product.mainMedia,
            addedDate: new Date(),
          });
          wishlisted = true;
          setHeartState($item, true, product.name);
          trackEvent('wishlist_add', { productId: product._id, source: 'product_card' });
        }
      } catch (e) {
        // On error, revert visual state
        setHeartState($item, wishlisted, product.name);
      } finally {
        busy = false;
      }
    });
  } catch (e) {}
}

/**
 * Set heart icon and ARIA label based on wishlist state.
 * @param {Function} $item - Wix repeater item selector
 * @param {boolean} active - Whether item is wishlisted
 * @param {string} productName - Product name for ARIA label
 */
function setHeartState($item, active, productName) {
  try {
    $item('#gridWishlistIcon').src = active ? HEART_FILLED_SVG : HEART_OUTLINE_SVG;
  } catch (e) {}
  try {
    $item('#gridWishlistBtn').accessibility.ariaLabel = active
      ? `Remove ${productName} from wishlist`
      : `Add ${productName} to wishlist`;
  } catch (e) {}
}
