/**
 * @module wishlistShare
<<<<<<< HEAD
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> origin/cf-pvxf-wishlist-share-s4
import { currentMember } from 'wix-members-backend';

// ── addShareToken ─────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.carolinafutons.com';
const SHARE_PATH = '/wishlist-share';
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

    // Resolve display name for resolveShareToken (S1) compatibility
    const memberName = member.profile?.nickname ||
      member.contactDetails?.firstName ||
      member.loginEmail ||
      '';

    // Persist to CMS
    try {
      await wixData.insert('WishlistShareTokens', {
        token,
        memberId: member._id,
        memberName,
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
<<<<<<< HEAD
=======
>>>>>>> origin/cf-y24r-wishlist-share
=======
>>>>>>> origin/cf-pvxf-wishlist-share-s4

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
=======
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
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('[wishlistShare] crypto.getRandomValues unavailable — cannot generate secure token');
  }
  crypto.getRandomValues(bytes);
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

      const rawDays = opts?.expiryDays != null ? Number(opts.expiryDays) : TOKEN_DEFAULT_EXPIRY_DAYS;
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
 * @returns {Promise<{
 *   items: Array<{ _id: string, productId: string, productName: string,
 *                  productImage: string, price: number, slug: string }>,
 *   ownerName: string,
 *   expiresAt: string|Date
 * } | { error: string }>}
>>>>>>> origin/cf-wishlist-share-s1-s5
 */
export const resolveShareToken = webMethod(
  Permissions.Anyone,
  async (token) => {
<<<<<<< HEAD
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
=======
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

      // Fetch wishlist items for this member (suppressAuth: resolveShareToken is Anyone-accessible)
      const wishlistResult = await wixData.query('Wishlist')
        .eq('memberId', memberId)
        .find({ suppressAuth: true });

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
          .find({ suppressAuth: true });

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
>>>>>>> origin/cf-wishlist-share-s1-s5
    }
  }
);
