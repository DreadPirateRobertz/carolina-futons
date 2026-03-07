/**
 * @module SaveForLater
 * @description Moves a cart item to the member's wishlist.
 * Removes from cart, adds to Wishlist CMS collection (with dedup),
 * and fires analytics events.
 *
 * @requires public/cartService
 * @requires public/engagementTracker
 * @requires public/ga4Tracking
 */
import { removeCartItem } from 'public/cartService';
import { trackEvent } from 'public/engagementTracker';
import { fireCustomEvent } from 'public/ga4Tracking';

/**
 * Move a cart line item to the member's wishlist.
 * @param {Object} cartItem - Cart line item with _id, productId, name, price, image.
 * @returns {Promise<{success: boolean, wishlistItemId?: string, reason?: string}>}
 */
export async function saveForLater(cartItem) {
  if (!cartItem || !cartItem._id || !cartItem.productId) {
    return { success: false, reason: 'invalid_item' };
  }

  try {
    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();
    if (!member) {
      return { success: false, reason: 'not_authenticated' };
    }

    // Remove from cart first — if this fails, don't touch wishlist
    try {
      await removeCartItem(cartItem._id);
    } catch (err) {
      return { success: false, reason: 'cart_removal_failed' };
    }

    // Check if already wishlisted (dedup)
    const wixData = (await import('wix-data')).default;
    const existing = await wixData.query('Wishlist')
      .eq('memberId', member._id)
      .eq('productId', cartItem.productId)
      .find();

    if (existing.items.length > 0) {
      trackEvent('save_for_later', { productId: cartItem.productId, source: 'cart' });
      fireCustomEvent('save_for_later', { productId: cartItem.productId });
      return { success: true, wishlistItemId: existing.items[0]._id };
    }

    // Add to wishlist
    const inserted = await wixData.insert('Wishlist', {
      memberId: member._id,
      productId: cartItem.productId,
      productName: cartItem.name,
      productImage: cartItem.image,
      addedDate: new Date(),
    });

    trackEvent('save_for_later', { productId: cartItem.productId, source: 'cart' });
    fireCustomEvent('save_for_later', { productId: cartItem.productId });

    return { success: true, wishlistItemId: inserted._id };
  } catch (err) {
    console.error('[SaveForLater] error:', err);
    return { success: false, reason: 'wishlist_add_failed' };
  }
}
