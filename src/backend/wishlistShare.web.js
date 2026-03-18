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
import { currentMember } from 'wix-members-backend';

// ── addShareToken ─────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.carolinafutons.com';
const SHARE_PATH = '/shared-wishlist';
const DEFAULT_EXPIRY_DAYS = 30;
const MIN_EXPIRY_DAYS = 1;
const MAX_EXPIRY_DAYS = 365;

function generateUrlSafeToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function clampExpiryDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n) || isNaN(n)) return DEFAULT_EXPIRY_DAYS;
  return Math.min(MAX_EXPIRY_DAYS, Math.max(MIN_EXPIRY_DAYS, Math.round(n)));
}

/**
 * Generate a share token for the current member's wishlist.
 * Stores the token in WishlistShareTokens CMS and returns a shareable URL.
 *
 * @param {{ expiryDays?: number }} [options]
 * @returns {Promise<
 *   { token: string, shareUrl: string, expiresAt: Date } |
 *   { error: string }
 * >}
 */
export const addShareToken = webMethod(
  Permissions.Member,
  async ({ expiryDays } = {}) => {
    // Authenticate
    let member;
    try {
      member = await currentMember.getMember();
    } catch (err) {
      console.error('[wishlistShare] getMember error:', err);
      return { error: 'auth_failed' };
    }

    if (!member || !member._id) {
      return { error: 'unauthenticated' };
    }

    // Build token + expiry
    const token = generateUrlSafeToken();
    const days = clampExpiryDays(expiryDays);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const shareUrl = `${BASE_URL}${SHARE_PATH}?share=${token}`;

    // Persist to CMS
    try {
      await wixData.insert('WishlistShareTokens', {
        token,
        memberId: member._id,
        expiresAt,
        createdAt: now,
      });
    } catch (err) {
      console.error('[wishlistShare] insert error:', err);
      return { error: 'db_failed' };
    }

    return { token, shareUrl, expiresAt };
  }
);

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
    const raw = typeof token === 'string' ? token.trim() : '';
    if (!raw) return { valid: false, reason: 'missing_token' };
    const clean = raw.slice(0, 200); // guard against oversized tokens

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
          .limit(100)
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
