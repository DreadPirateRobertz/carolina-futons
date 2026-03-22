/**
 * @module badgeService.web
 * @description CMS-driven product badge system. Returns the badge set for a product
 * (NEW, BESTSELLER, LOW_STOCK, SALE, CF_PLUS_EXCLUSIVE). CMS entries take priority;
 * computed fallbacks apply when no CMS override exists.
 *
 * Badge priority order (highest first): CF_PLUS_EXCLUSIVE, BESTSELLER, NEW, SALE, LOW_STOCK.
 *
 * @setup
 * Create CMS collection "ProductBadges" with fields:
 * - productId (Text, indexed) — matches Wix Stores product _id
 * - badgeType (Text) — "NEW" | "BESTSELLER" | "LOW_STOCK" | "SALE" | "CF_PLUS_EXCLUSIVE"
 * - active (Boolean) — whether the badge is currently displayed
 * - expiresAt (DateTime) — optional; badge hidden after this date if set
 * - _createdDate (DateTime) — Auto
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';
import { colors } from 'public/sharedTokens.js';

const BADGES_COLLECTION = 'ProductBadges';
const LOW_STOCK_THRESHOLD = 5;
const MAX_PRODUCT_IDS = 50;

/** Badge display config: label, background color, text color. */
const BADGE_CONFIG = {
  NEW:              { label: 'New',          bgColor: colors.mountainBlue, textColor: colors.white },
  BESTSELLER:       { label: 'Bestseller',   bgColor: colors.espresso,     textColor: colors.white },
  LOW_STOCK:        { label: 'Low Stock',    bgColor: colors.sunsetCoral,  textColor: colors.white },
  SALE:             { label: 'Sale',         bgColor: colors.sunsetCoral,  textColor: colors.white },
  CF_PLUS_EXCLUSIVE:{ label: 'CF+ Exclusive',bgColor: colors.mountainBlueDark, textColor: colors.white },
};

/** Priority order — lower index = higher priority. */
const BADGE_PRIORITY = ['CF_PLUS_EXCLUSIVE', 'BESTSELLER', 'NEW', 'SALE', 'LOW_STOCK'];

/**
 * Return whether a CMS badge entry is currently active.
 * @param {{ active: boolean, expiresAt?: string|Date }} item
 */
function isBadgeActive(item) {
  if (!item.active) return false;
  if (item.expiresAt && new Date(item.expiresAt) < new Date()) return false;
  return true;
}

/**
 * Compute fallback badges from product data alone.
 * Used when no CMS overrides exist or to supplement them.
 * @param {{ comparePrice?: number, quantityInStock?: number, _createdDate?: string }} product
 * @returns {string[]} Badge type strings
 */
function computedBadges(product) {
  const badges = [];
  if (product.comparePrice && product.comparePrice > 0) badges.push('SALE');
  if ((product.quantityInStock ?? Infinity) < LOW_STOCK_THRESHOLD) badges.push('LOW_STOCK');
  return badges;
}

/**
 * Build a single badge result object from a type string.
 * @param {string} type
 * @returns {{ type: string, label: string, bgColor: string, textColor: string } | null}
 */
function buildBadge(type) {
  const config = BADGE_CONFIG[type];
  if (!config) return null;
  return { type, ...config };
}

/**
 * Resolve the highest-priority active badge for a product.
 * CMS overrides are merged with computed badges; CMS wins if both set the same type.
 * @param {string[]} cmsTypes - Active badge types from CMS
 * @param {string[]} computedTypes - Computed badge types from product data
 * @returns {{ type: string, label: string, bgColor: string, textColor: string } | null}
 */
function resolveBadge(cmsTypes, computedTypes) {
  const allTypes = new Set([...cmsTypes, ...computedTypes]);
  for (const type of BADGE_PRIORITY) {
    if (allTypes.has(type)) return buildBadge(type);
  }
  return null;
}

// ── getProductBadges (single product, for PDP) ───────────────────────

/**
 * Return the active badge for a single product.
 * Checks ProductBadges CMS first; falls back to computed badges from product data.
 *
 * @param {string} productId - Wix Stores product _id
 * @param {{ comparePrice?: number, quantityInStock?: number, _createdDate?: string }} [productData]
 *   Optional product data used for computed badge fallbacks.
 * @returns {Promise<{
 *   success: boolean,
 *   badge: { type: string, label: string, bgColor: string, textColor: string } | null,
 *   source: 'cms' | 'computed' | 'none',
 *   error?: string
 * }>}
 */
export const getProductBadges = webMethod(
  Permissions.Anyone,
  async (productId, productData = {}) => {
    try {
      const cleanId = sanitize(productId, 50);
      if (!cleanId) return { success: false, error: 'Product ID required' };

      const result = await wixData.query(BADGES_COLLECTION)
        .eq('productId', cleanId)
        .find();

      const cmsTypes = result.items.filter(isBadgeActive).map(i => i.badgeType);
      const computedTypes = computedBadges(productData);

      const badge = resolveBadge(cmsTypes, computedTypes);
      const source = badge
        ? (cmsTypes.includes(badge.type) ? 'cms' : 'computed')
        : 'none';

      return { success: true, badge, source };
    } catch (err) {
      console.error('getProductBadges error:', err);
      return { success: false, error: 'Unable to fetch product badges' };
    }
  }
);

// ── getBatchProductBadges (multiple products, for category cards) ─────

/**
 * Return active badges for multiple products in a single query.
 * Designed for category page repeaters — one call for up to 50 products.
 *
 * @param {string[]} productIds - Array of Wix Stores product _ids
 * @param {Record<string, { comparePrice?: number, quantityInStock?: number }>} [productDataMap]
 *   Optional map of productId → product data used for computed badge fallbacks.
 * @returns {Promise<{
 *   success: boolean,
 *   badges: Record<string, { type: string, label: string, bgColor: string, textColor: string } | null>,
 *   error?: string
 * }>}
 */
export const getBatchProductBadges = webMethod(
  Permissions.Anyone,
  async (productIds = [], productDataMap = {}) => {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return { success: true, badges: {} };
      }

      const cleanIds = productIds
        .map(id => sanitize(id, 50))
        .filter(Boolean)
        .slice(0, MAX_PRODUCT_IDS);

      if (cleanIds.length === 0) return { success: true, badges: {} };

      const result = await wixData.query(BADGES_COLLECTION)
        .hasSome('productId', cleanIds)
        .find();

      // Group CMS entries by productId
      const cmsByProduct = {};
      for (const item of result.items) {
        if (!isBadgeActive(item)) continue;
        if (!cmsByProduct[item.productId]) cmsByProduct[item.productId] = [];
        cmsByProduct[item.productId].push(item.badgeType);
      }

      // Build badge map for all requested products
      const badges = {};
      for (const id of cleanIds) {
        const cmsTypes = cmsByProduct[id] || [];
        const computedTypes = computedBadges(productDataMap[id] || {});
        badges[id] = resolveBadge(cmsTypes, computedTypes);
      }

      return { success: true, badges };
    } catch (err) {
      console.error('getBatchProductBadges error:', err);
      return { success: false, error: 'Unable to fetch product badges' };
    }
  }
);
