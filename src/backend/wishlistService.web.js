/**
 * @module wishlistService
 * @description Wishlist CRUD webMethods for members.
 * Tracks priceAtAdd as a permanent record of the price at the time of
 * wishlist add (the alerting consumer that originally read this field
 * was retired with cf-4x7e Pass 2 chunk 11; field kept for posterity
 * and any future re-introduction of price-drop tooling).
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Wishlist CMS collection must include:
 *   memberId (Text, indexed)
 *   productId (Text, indexed)
 *   name (Text)
 *   price (Number) — display price at time of last explicit update (not auto-refreshed)
 *   priceAtAdd (Number) — price at time of wishlist add (never updated)
 *   imageUrl (Text)
 *   productSlug (Text)
 *   inStock (Boolean)
 *   addedAt (DateTime)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';

const WISHLIST_MAX_ITEMS = 100;

// ── addToWishlist ─────────────────────────────────────────────────

/**
 * Add a product to the current member's wishlist.
 * Stores priceAtAdd as the current price (immutable record of price at add time).
 * No-ops if item is already on wishlist (returns existing item).
 *
 * @param {string} productId
 * @param {string} name
 * @param {number} price - Current product price (stored as priceAtAdd)
 * @param {Object} [opts]
 * @param {string} [opts.imageUrl]
 * @param {string} [opts.productSlug]
 * @param {boolean} [opts.inStock]
 * @returns {Promise<{success: boolean, item?: Object, error?: string}>}
 */
export const addToWishlist = webMethod(
  Permissions.SiteMember,
  async (productId, name, price, opts = {}) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Not authenticated.' };

      const cleanProductId = sanitize(productId, 50);
      if (!cleanProductId) return { success: false, error: 'Invalid product ID.' };

      const cleanName = sanitize(name || '', 200);
      const numPrice = Number(price);
      if (!isFinite(numPrice) || numPrice < 0) {
        return { success: false, error: 'Invalid price.' };
      }

      // Check cap
      const existing = await wixData.query('Wishlist')
        .eq('memberId', member._id)
        .find();

      // Already on wishlist — return existing
      const duplicate = existing.items.find(i => i.productId === cleanProductId);
      if (duplicate) {
        return { success: true, item: _mapItem(duplicate), alreadyExists: true };
      }

      if (existing.totalCount >= WISHLIST_MAX_ITEMS) {
        return { success: false, error: `Wishlist is full (max ${WISHLIST_MAX_ITEMS} items).` };
      }

      const record = {
        memberId: member._id,
        productId: cleanProductId,
        name: cleanName,
        price: numPrice,
        priceAtAdd: numPrice,
        imageUrl: sanitize(opts.imageUrl || '', 500),
        productSlug: sanitize(opts.productSlug || '', 100),
        inStock: opts.inStock !== undefined ? !!opts.inStock : true,
        addedAt: new Date(),
      };

      const inserted = await wixData.insert('Wishlist', record);
      return { success: true, item: _mapItem(inserted) };
    } catch (err) {
      console.error('[wishlistService] addToWishlist error:', err);
      return { success: false, error: 'Failed to add to wishlist.' };
    }
  }
);

// ── removeFromWishlist ────────────────────────────────────────────

/**
 * Remove a product from the current member's wishlist.
 *
 * @param {string} productId
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const removeFromWishlist = webMethod(
  Permissions.SiteMember,
  async (productId) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Not authenticated.' };

      const cleanProductId = sanitize(productId, 50);
      if (!cleanProductId) return { success: false, error: 'Invalid product ID.' };

      const existing = await wixData.query('Wishlist')
        .eq('memberId', member._id)
        .eq('productId', cleanProductId)
        .find();

      if (existing.items.length === 0) {
        return { success: false, error: 'Item not found in wishlist.' };
      }

      await wixData.remove('Wishlist', existing.items[0]._id);
      return { success: true };
    } catch (err) {
      console.error('[wishlistService] removeFromWishlist error:', err);
      return { success: false, error: 'Failed to remove from wishlist.' };
    }
  }
);

// ── getWishlist ───────────────────────────────────────────────────

/**
 * Get the current member's wishlist items, sorted by most recently added.
 *
 * @returns {Promise<{success: boolean, items: Array, total: number}>}
 */
export const getWishlist = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, items: [], total: 0 };

      const result = await wixData.query('Wishlist')
        .eq('memberId', member._id)
        .descending('addedAt')
        .limit(WISHLIST_MAX_ITEMS)
        .find();

      return {
        success: true,
        items: result.items.map(_mapItem),
        total: result.totalCount,
      };
    } catch (err) {
      console.error('[wishlistService] getWishlist error:', err);
      return { success: false, items: [], total: 0 };
    }
  }
);

// ── getWishlistByMemberId ─────────────────────────────────────────

/**
 * Read another member's wishlist by memberId.
 * Used by the /wishlist/[token] share view in cfw — the HMAC token is
 * verified on the cfw side before calling this; we only rate-limit here
 * to prevent brute-force memberId enumeration.
 *
 * @param {string} memberId - Target member's _id (decoded from cfw share token)
 * @returns {Promise<{success: boolean, items: Array, total: number}>}
 */
export const getWishlistByMemberId = webMethod(
  Permissions.Anyone,
  async (memberId) => {
    try {
      const cleanId = validateId(memberId);
      if (!cleanId) return { success: false, items: [], total: 0 };

      // Rate-limit per memberId to prevent enumeration of arbitrary IDs.
      const { allowed } = await checkRateLimit(
        'WishlistShareRateLimit',
        cleanId,
        { max: 30, windowMs: 60_000 },
      );
      if (!allowed) return { success: false, error: 'rate_limited', items: [], total: 0 };

      const result = await wixData.query('Wishlist')
        .eq('memberId', cleanId)
        .descending('addedAt')
        .limit(WISHLIST_MAX_ITEMS)
        .find({ suppressAuth: true });

      return {
        success: true,
        items: result.items.map(_mapItem),
        total: result.totalCount,
      };
    } catch (err) {
      console.error('[wishlistService] getWishlistByMemberId error:', err);
      return { success: false, error: 'server_error', items: [], total: 0 };
    }
  }
);

// ── isOnWishlist ──────────────────────────────────────────────────

/**
 * Check whether a product is on the current member's wishlist.
 *
 * @param {string} productId
 * @returns {Promise<{success: boolean, onWishlist: boolean}>}
 */
export const isOnWishlist = webMethod(
  Permissions.SiteMember,
  async (productId) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: true, onWishlist: false };

      const cleanProductId = sanitize(productId, 50);
      if (!cleanProductId) return { success: true, onWishlist: false };

      const result = await wixData.query('Wishlist')
        .eq('memberId', member._id)
        .eq('productId', cleanProductId)
        .find();

      return { success: true, onWishlist: result.items.length > 0 };
    } catch (err) {
      console.error('[wishlistService] isOnWishlist error:', err);
      return { success: false, onWishlist: false };
    }
  }
);

// ── updateWishlistStock ───────────────────────────────────────────

/**
 * Update inStock status for all wishlist items with a given productId.
 * Called by inventory event handlers when stock status changes.
 * Admin-only — not exposed to members.
 *
 * @param {string} productId
 * @param {boolean} inStock
 * @returns {Promise<{success: boolean, updatedCount: number}>}
 */
export const updateWishlistStock = webMethod(
  Permissions.Admin,
  async (productId, inStock) => {
    try {
      const cleanProductId = sanitize(productId, 50);
      if (!cleanProductId) return { success: false, updatedCount: 0 };

      const result = await wixData.query('Wishlist')
        .eq('productId', cleanProductId)
        .find();

      let updatedCount = 0;
      for (const item of result.items) {
        if (item.inStock !== !!inStock) {
          await wixData.update('Wishlist', { ...item, inStock: !!inStock });
          updatedCount++;
        }
      }

      return { success: true, updatedCount };
    } catch (err) {
      console.error('[wishlistService] updateWishlistStock error:', err);
      return { success: false, updatedCount: 0 };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────

function _mapItem(item) {
  return {
    id: item._id,
    productId: item.productId,
    name: item.name || '',
    price: item.price ?? 0,
    priceAtAdd: item.priceAtAdd ?? item.price ?? 0,
    imageUrl: item.imageUrl || '',
    productSlug: item.productSlug || '',
    inStock: item.inStock !== false,
    addedAt: item.addedAt || null,
  };
}

// Export for testing
export const _WISHLIST_MAX_ITEMS = WISHLIST_MAX_ITEMS;
