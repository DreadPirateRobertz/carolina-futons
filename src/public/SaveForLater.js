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

    // Check if already wishlisted (dedup) BEFORE removing from cart
    const wixData = (await import('wix-data')).default;
    const existing = await wixData.query('Wishlist')
      .eq('memberId', member._id)
      .eq('productId', cartItem.productId)
      .find();

    if (existing.items.length > 0) {
      // Already wishlisted — still remove from cart (best-effort)
      try {
        await removeCartItem(cartItem._id);
      } catch (err) {
        console.error('[SaveForLater] cart removal failed (dedup path):', err);
      }
      trackEvent('save_for_later', { productId: cartItem.productId, source: 'cart' });
      fireCustomEvent('save_for_later', { productId: cartItem.productId });
      return { success: true, wishlistItemId: existing.items[0]._id };
    }

    // Add to wishlist FIRST — if this fails, cart item is preserved
    const numPrice = Number(cartItem.price);
    const inserted = await wixData.insert('Wishlist', {
      memberId: member._id,
      productId: cartItem.productId,
      name: cartItem.name,
      productName: cartItem.name,
      price: isNaN(numPrice) ? null : numPrice,
      productImage: cartItem.image,
      inStock: true,
      addedDate: new Date(),
    });

    // Remove from cart after wishlist insert succeeds
    try {
      await removeCartItem(cartItem._id);
    } catch (err) {
      console.error('[SaveForLater] cart removal failed after wishlist add:', err);
      // Item is in both cart and wishlist — user can remove from cart manually.
      // This is better than losing the item entirely.
    }

    trackEvent('save_for_later', { productId: cartItem.productId, source: 'cart' });
    fireCustomEvent('save_for_later', { productId: cartItem.productId });

    return { success: true, wishlistItemId: inserted._id };
  } catch (err) {
    console.error('[SaveForLater] error:', err);
    return { success: false, reason: 'wishlist_add_failed' };
  }
}
