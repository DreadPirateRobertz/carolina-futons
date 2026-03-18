/**
 * @module wishlistShare
 * @description Wishlist share token resolution for CF-y24r.
 * Resolves ?share=token URL params, validates expiry,
 * and returns the owner's wishlist items to the share page.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create `WishlistShareTokens` CMS collection:
 *   token (text, unique) — the URL-safe share token
 *   memberId (text)      — wishlist owner
 *   memberName (text)    — display name shown to visitors
 *   expiresAt (dateTime) — null means no expiry
 *
 * Existing `Wishlist` collection must have: memberId, productId, productName, productImage
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

// ── resolveShareToken ─────────────────────────────────────────────────────────

/**
 * Resolve a share token: validate, check expiry, return wishlist items.
 * Called by the Wishlist Share page ($onReady S1).
 *
 * @param {string} token - Raw share token from URL ?share= param
 * @returns {Promise<
 *   { valid: false, reason: 'missing_token'|'not_found'|'expired' } |
 *   { valid: true, ownerName: string, memberId: string, items: Object[] }
 * >}
 */
export const resolveShareToken = webMethod(
  Permissions.Anyone,
  async (token) => {
    // Validate input
    const clean = typeof token === 'string' ? token.trim() : '';
    if (!clean) return { valid: false, reason: 'missing_token' };

    try {
      // Look up token record
      const tokenResult = await wixData.query('WishlistShareTokens')
        .eq('token', clean)
        .find();

      if (tokenResult.items.length === 0) {
        return { valid: false, reason: 'not_found' };
      }

      const record = tokenResult.items[0];

      // Check expiry
      if (record.expiresAt != null && new Date(record.expiresAt) < new Date()) {
        return { valid: false, reason: 'expired' };
      }

      // Fetch wishlist items for this member
      let items = [];
      try {
        const wishlistResult = await wixData.query('Wishlist')
          .eq('memberId', record.memberId)
          .find();
        items = wishlistResult.items.map(i => ({
          _id: i._id,
          productId: i.productId,
          productName: i.productName || '',
          productImage: i.productImage || '',
          addedDate: i.addedDate || null,
        }));
      } catch (itemErr) {
        console.error('[wishlistShare] Failed to fetch wishlist items:', itemErr);
        // Return valid with empty items rather than failing the whole request
      }

      return {
        valid: true,
        ownerName: record.memberName || 'Someone',
        memberId: record.memberId,
        items,
      };
    } catch (err) {
      console.error('[wishlistShare] resolveShareToken error:', err);
      return { valid: false, reason: 'not_found' };
    }
  }
);
