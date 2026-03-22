/**
 * @module shippingIntelligence.web
 * @description Shipping intelligence orchestrator for product pages and bundle builder.
 * Provides real-time shipping estimates BEFORE checkout — on the product page and
 * during bundle configuration — so customers know what delivery will cost upfront.
 *
 * Two public webMethods:
 *   - getShippingEstimate(productId, zip)  — single product estimate
 *   - calculateBundleQuote(items[], zip)   — multi-item bundle estimate
 *
 * Routing logic:
 *   1. Look up product's shipping profile from ProductShippingProfiles CMS
 *   2. If item is oversized (murphy bed, platform bed) → route to WWEX LTL
 *   3. Otherwise → route to UPS parcel via getUPSRates
 *   4. Append local delivery options for SE zone destinations
 *   5. Return gamification metadata for cart UI display
 *
 * This module is separate from shipping-rates-plugin.js because:
 *   - The SPI plugin runs at checkout (Wix controls timing)
 *   - This webMethod is called on-demand from product/bundle pages
 *   - It reads ProductShippingProfiles CMS for per-SKU overrides
 *
 * @requires backend/ups-shipping.web           - Parcel rate lookup
 * @requires backend/wwex-freight.web           - LTL freight rate lookup
 * @requires public/sharedTokens.js             - Zone config, gamification fields
 * @requires wix-data                           - ProductShippingProfiles CMS reads
 */

import { Permissions, webMethod } from 'wix-web-module';
import { getUPSRates, getPackageDimensions } from 'backend/ups-shipping.web';
import { getLTLRates, getLTLFallbackRates, shouldUseLTL, LTL_THRESHOLDS } from 'backend/wwex-freight.web';
import { shippingConfig } from 'public/sharedTokens.js';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logError } from 'backend/utils/errorHandler';

const { localZones } = shippingConfig;

/** CMS collection name for per-product shipping profile overrides */
const SHIPPING_PROFILES_COLLECTION = 'ProductShippingProfiles';

/** Rate limiting: 1-minute sliding window */
const RATE_WINDOW_MS = 60_000; // 1 minute
const ESTIMATE_RATE_COLLECTION = 'ShippingEstimateRateLimit';
const BUNDLE_RATE_COLLECTION = 'BundleQuoteRateLimit';

/** Anonymous rate limits (global shared bucket — Wix webMethods don't expose client IP) */
const ANON_ESTIMATE_MAX = 60;  // shared across all anonymous users per minute
const ANON_BUNDLE_MAX = 30;

/**
 * Get the current member's ID for rate limiting, or null if anonymous.
 * @private
 */
async function getCurrentMemberId() {
  try {
    const member = await currentMember.getMember();
    return member?._id ?? null;
  } catch (err) {
    logError('shippingIntelligence.getCurrentMemberId', err, { silent: true });
    return null;
  }
}

/**
 * @typedef {Object} ShippingEstimateResult
 * @property {boolean} success
 * @property {Array<ShippingOption>} options - Available shipping options
 * @property {string} [error]
 */

/**
 * @typedef {Object} ShippingOption
 * @property {string} code       - Unique shipping method code
 * @property {string} title      - Display title (with icon)
 * @property {string} price      - Formatted price string ('49.00')
 * @property {string} currency
 * @property {string} deliveryTime
 * @property {string|null} badge - Gamification badge text
 * @property {string} badgeStyle
 * @property {string|null} upsellMessage
 * @property {boolean} highlight
 * @property {string} icon
 * @property {boolean} [isLTL]
 */

/**
 * Get shipping estimate for a single product at a given ZIP code.
 * Called from product page ZIP estimator widget.
 *
 * @param {string} productId - Wix catalog product ID
 * @param {string} zip       - 5-digit US ZIP code
 * @returns {Promise<ShippingEstimateResult>}
 */
export const getShippingEstimate = webMethod(
  Permissions.Anyone,
  async (productId, zip) => {
    if (!productId || !zip || !/^\d{5}$/.test(zip)) {
      return { success: false, error: 'Valid product ID and 5-digit ZIP required', options: [] };
    }

    // Rate limit: 20 req/min per logged-in member; 60 req/min shared global bucket for anonymous.
    const memberId = await getCurrentMemberId();
    if (memberId) {
      const { allowed } = await checkRateLimit(ESTIMATE_RATE_COLLECTION, memberId, {
        max: 20,
        windowMs: RATE_WINDOW_MS,
      });
      if (!allowed) {
        return { success: false, error: 'Too many requests. Please try again in 1 minute.', options: [] };
      }
    } else {
      // Anonymous: shared global bucket — coarse DoS protection (no client IP in Wix webMethods)
      const { allowed } = await checkRateLimit(ESTIMATE_RATE_COLLECTION, 'anon', {
        max: ANON_ESTIMATE_MAX,
        windowMs: RATE_WINDOW_MS,
      });
      if (!allowed) {
        return { success: false, error: 'Service temporarily busy. Please try again shortly.', options: [] };
      }
    }

    try {
      const profile = await getProductShippingProfile(productId);
      const dims = profile || await getPackageDimensions(profile?.category || 'default');

      const packages = [{
        length: dims.length,
        width: dims.width,
        height: dims.height,
        weight: dims.weight,
        category: dims.category || profile?.category || 'default',
        description: profile?.productName || 'Furniture',
      }];

      return await buildShippingResponse(zip, packages, 0, 1);
    } catch (err) {
      console.error('shippingIntelligence getShippingEstimate error:', err);
      return { success: false, error: 'Estimate unavailable', options: [] };
    }
  }
);

/**
 * Calculate shipping quote for a multi-item bundle.
 * Called from bundle builder when customer adds items.
 *
 * @param {Array<{productId: string, quantity: number, price?: number}>} items
 * @param {string} zip - 5-digit US ZIP code
 * @returns {Promise<ShippingEstimateResult>}
 */
export const calculateBundleQuote = webMethod(
  Permissions.Anyone,
  async (items, zip) => {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'At least one item required', options: [] };
    }
    if (!zip || !/^\d{5}$/.test(zip)) {
      return { success: false, error: 'Valid 5-digit ZIP required', options: [] };
    }

    // Rate limit: 10 req/min per logged-in member; 30 req/min shared global bucket for anonymous.
    const memberId = await getCurrentMemberId();
    if (memberId) {
      const { allowed } = await checkRateLimit(BUNDLE_RATE_COLLECTION, memberId, {
        max: 10,
        windowMs: RATE_WINDOW_MS,
      });
      if (!allowed) {
        return { success: false, error: 'Too many requests. Please try again in 1 minute.', options: [] };
      }
    } else {
      // Anonymous: shared global bucket — coarse DoS protection (no client IP in Wix webMethods)
      const { allowed } = await checkRateLimit(BUNDLE_RATE_COLLECTION, 'anon', {
        max: ANON_BUNDLE_MAX,
        windowMs: RATE_WINDOW_MS,
      });
      if (!allowed) {
        return { success: false, error: 'Service temporarily busy. Please try again shortly.', options: [] };
      }
    }

    try {
      const packages = [];
      let orderSubtotal = 0;

      for (const item of items) {
        const quantity = Math.max(1, item.quantity || 1);
        const price = Math.max(0, parseFloat(item.price) || 0);
        orderSubtotal += price * quantity;

        const profile = await getProductShippingProfile(item.productId);
        const dims = profile || await getPackageDimensions(profile?.category || 'default');

        for (let i = 0; i < quantity; i++) {
          packages.push({
            length: dims.length,
            width: dims.width,
            height: dims.height,
            weight: dims.weight,
            category: dims.category || profile?.category || 'default',
          });
        }
      }

      return await buildShippingResponse(zip, packages, orderSubtotal, items.length);
    } catch (err) {
      console.error('shippingIntelligence calculateBundleQuote error:', err);
      return { success: false, error: 'Quote unavailable', options: [] };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Core shipping option builder — shared by single-item and bundle flows.
 * Determines carrier (UPS parcel vs WWEX LTL), fetches rates, adds local options.
 *
 * @private
 */
async function buildShippingResponse(zip, packages, orderSubtotal, itemCount) {
  const options = [];
  const stateForZone = guessStateFromZip(zip);
  const zone = matchLocalZone(zip, stateForZone);

  // ── Carrier routing ──────────────────────────────────────────────
  if (shouldUseLTL(packages)) {
    // Large items → WWEX LTL freight
    const ltlResult = await getLTLRates('28792', zip, packages);
    const ltlRates = ltlResult.success ? ltlResult.rates : getLTLFallbackRates(zip, packages);

    for (const rate of ltlRates) {
      options.push({
        code: rate.code,
        title: rate.title,
        price: rate.cost.toFixed(2),
        currency: rate.currency || 'USD',
        deliveryTime: rate.estimatedDays,
        badge: rate.badge || null,
        badgeStyle: 'freight',
        upsellMessage: rate.upsellMessage || null,
        highlight: false,
        icon: rate.icon || '🚛',
        isLTL: true,
        isEstimate: rate.isEstimate || false,
      });
    }
  } else {
    // Standard items → UPS parcel
    const rates = await getUPSRates({ postalCode: zip, country: 'US' }, packages, orderSubtotal);
    for (const rate of rates) {
      options.push({
        code: rate.code,
        title: `📦 ${rate.title}`,
        price: rate.cost.toFixed(2),
        currency: rate.currency || 'USD',
        deliveryTime: rate.estimatedDelivery || '',
        badge: null,
        badgeStyle: null,
        upsellMessage: null,
        highlight: false,
        icon: '📦',
        isEstimate: rate.isEstimate || false,
      });
    }
  }

  // ── Local delivery options ───────────────────────────────────────
  if (zone) {
    const terrainFee = getTerrainSurcharge(zip);
    const freeThreshold = shippingConfig.freeThreshold;
    const wgFreeThreshold = shippingConfig.whiteGlove.freeThreshold;

    // Local delivery
    const deliveryPrice = orderSubtotal >= freeThreshold ? 0 : zone.delivery;
    options.push({
      code: `local-delivery-${zone.code}`,
      title: `${zone.icon || '🚚'} ${zone.name} Delivery${deliveryPrice === 0 ? ' (Free)' : ''}`,
      price: deliveryPrice.toFixed(2),
      currency: 'USD',
      deliveryTime: zone.deliveryDays,
      badge: zone.badge || null,
      badgeStyle: zone.badgeStyle || null,
      upsellMessage: zone.upsellMessage || null,
      highlight: zone.highlight || false,
      icon: zone.icon || '🚚',
    });

    // White glove
    const wgPrice = orderSubtotal >= wgFreeThreshold ? 0 : zone.whiteGlove + terrainFee;
    const wgTitle = [
      zone.whiteGloveIcon || '✨',
      wgPrice === 0
        ? `${zone.whiteGloveBadge || 'White Glove'} (Free)`
        : (zone.whiteGloveBadge || 'White Glove Delivery'),
    ].join(' ');

    const wgOption = {
      code: `white-glove-${zone.code}`,
      title: wgTitle,
      price: wgPrice.toFixed(2),
      currency: 'USD',
      deliveryTime: zone.deliveryDays,
      badge: zone.whiteGloveBadge || null,
      badgeStyle: 'premium',
      upsellMessage: zone.whiteGloveUpsell || null,
      highlight: zone.whiteGloveHighlight || false,
      icon: zone.whiteGloveIcon || '✨',
    };
    if (terrainFee > 0) wgOption.terrainSurcharge = terrainFee;
    options.push(wgOption);
  }

  if (options.length === 0) {
    return { success: false, error: 'No shipping options available for this destination', options: [] };
  }

  return { success: true, options };
}

/**
 * Look up per-product shipping profile from ProductShippingProfiles CMS.
 * Returns null if product has no profile (use category defaults).
 *
 * CMS fields: productId, productName, category, weight, length, width, height,
 *             handlingFee_usd, carrierOverride, ltlRequired
 *
 * @private
 */
async function getProductShippingProfile(productId) {
  if (!productId) return null;
  try {
    const results = await wixData.query(SHIPPING_PROFILES_COLLECTION)
      .eq('productId', productId)
      .limit(1)
      .find({ suppressAuth: true });

    return results.items.length > 0 ? results.items[0] : null;
  } catch (err) {
    // CMS miss — fall back to category defaults
    console.warn('ProductShippingProfiles lookup failed for', productId, err.message);
    return null;
  }
}

/**
 * Match a ZIP to a local delivery zone (mirrors shipping-rates-plugin logic).
 * @private
 */
function matchLocalZone(postalCode, stateCode) {
  const zip3 = parseInt((postalCode || '').substring(0, 3), 10);
  for (const zone of localZones) {
    if (zone.zips && zone.zips.includes(postalCode)) return zone;
    if (
      zone.zip3Prefixes && zone.zip3Prefixes.includes(zip3) &&
      zone.states && zone.states.includes(stateCode)
    ) return zone;
  }
  return null;
}

/**
 * Calculate terrain surcharge for white-glove delivery.
 * @private
 */
function getTerrainSurcharge(postalCode) {
  const ts = shippingConfig.whiteGlove.terrainSurcharge;
  if (!ts || !ts.zips) return 0;
  return ts.zips.includes(postalCode) ? (ts.amount || 0) : 0;
}

/**
 * Rough state inference from ZIP3 prefix for zone matching.
 * Not authoritative — product page doesn't have Wix subdivision.
 * Covers the states CF delivers to. Fallback to 'NC' for unknown.
 * @private
 */
function guessStateFromZip(zip) {
  const z = parseInt((zip || '').substring(0, 3), 10);
  if (z >= 270 && z <= 289) return 'NC';
  if (z >= 290 && z <= 299) return 'SC';
  if (z >= 300 && z <= 319) return 'GA';
  if (z >= 370 && z <= 385) return 'TN';
  if (z >= 220 && z <= 246) return 'VA';
  return null; // outside SE zone — no local delivery
}
