/**
 * @module wishlistShare
 * @description Wishlist share token generation and resolution for the
 * /shared-wishlist page. Members generate a shareable link with a
 * time-limited token; anyone with the link can view the wishlist.
 *
 * CMS collections:
 * - WishlistShareTokens (write) — token, memberId, expiresAt, createdAt
 * - Wishlist (read) — member's saved products
 * - Members/FullData (read) — profile for owner display name
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires backend/utils/sanitize
 */
import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

const BASE_URL = 'https://www.carolinafutons.com';
const TOKEN_MAX_EXPIRY_DAYS = 365;
const TOKEN_MIN_EXPIRY_DAYS = 1;
const TOKEN_DEFAULT_EXPIRY_DAYS = 30;
const TOKEN_MAX_LENGTH = 128;

// Generate a URL-safe random token
function makeToken() {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // base64url without padding, lowercase
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
    .toLowerCase()
    .slice(0, 24);
}

/**
 * Generate a time-limited share token for the current member's wishlist.
 *
 * @param {{ expiryDays?: number }} [opts]
 * @returns {Promise<{ token: string, shareUrl: string, expiresAt: Date } | { error: string }>}
 */
export const generateShareToken = webMethod(
  Permissions.SiteMember,
  async (opts = {}) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { error: 'Not authenticated' };

      const rawDays = Number(opts?.expiryDays) || TOKEN_DEFAULT_EXPIRY_DAYS;
      const expiryDays = Math.min(
        TOKEN_MAX_EXPIRY_DAYS,
        Math.max(TOKEN_MIN_EXPIRY_DAYS, Math.round(rawDays))
      );

      const token = makeToken();
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

      await wixData.insert('WishlistShareTokens', {
        token,
        memberId: member._id,
        expiresAt,
        createdAt: new Date(),
      });

      const shareUrl = `${BASE_URL}/shared-wishlist?share=${token}`;
      return { token, shareUrl, expiresAt };
    } catch (err) {
      console.error('[wishlistShare] generateShareToken error:', err);
      return { error: 'Failed to generate share link' };
    }
  }
);

/**
 * Resolve a share token and return the wishlist items + owner name.
 *
 * @param {string} token
 * @returns {Promise<{ items: Array, ownerName: string, expiresAt: Date } | { error: string }>}
 */
export const resolveShareToken = webMethod(
  Permissions.Anyone,
  async (token) => {
    try {
      if (!token || typeof token !== 'string') return { error: 'Invalid token' };
      const cleanToken = sanitize(token, TOKEN_MAX_LENGTH).trim();
      if (!cleanToken || cleanToken.length > TOKEN_MAX_LENGTH) return { error: 'Invalid token' };

      // Lookup token
      const tokenResult = await wixData.query('WishlistShareTokens')
        .eq('token', cleanToken)
        .limit(1)
        .find();

      if (tokenResult.items.length === 0) return { error: 'Invalid token' };

      const record = tokenResult.items[0];
      if (new Date(record.expiresAt) < new Date()) return { error: 'Token expired' };

      const memberId = record.memberId;

      // Fetch wishlist items for this member
      const wishlistResult = await wixData.query('Wishlist')
        .eq('memberId', memberId)
        .find();

      const items = wishlistResult.items.map(i => ({
        _id: i._id,
        productId: i.productId,
        productName: i.productName,
        productImage: i.productImage,
        price: i.price,
        slug: i.slug,
      }));

      // Fetch member profile for display name
      let ownerName = 'A friend';
      try {
        const memberResult = await wixData.query('Members/FullData')
          .eq('_id', memberId)
          .limit(1)
          .find();

        if (memberResult.items.length > 0) {
          const profile = memberResult.items[0].profile || {};
          ownerName = profile.nickname || profile.firstName || 'A friend';
        }
      } catch (profileErr) {
        console.warn('[wishlistShare] Could not fetch member profile:', profileErr);
      }

      return { items, ownerName, expiresAt: record.expiresAt };
    } catch (err) {
      console.error('[wishlistShare] resolveShareToken error:', err);
      return { error: 'Failed to resolve share link' };
    }
  }
);
