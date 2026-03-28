/**
 * @module deliveryOptions
 * @description Delivery options data service for PDP badges and cart display.
 *
 * Provides delivery method options (standard/white-glove/freight), coverage
 * zone lookup by zip code, pricing tiers, and white-glove availability flags.
 *
 * CF-7pwa
 */
import { Permissions, webMethod } from 'wix-web-module';
import { sanitize } from 'backend/utils/sanitize';
import { matchLocalZone, getTerrainSurcharge } from 'backend/utils/shippingZones';

// Delivery pricing tiers
const DELIVERY_OPTIONS = {
  standard: {
    code: 'standard',
    label: 'Standard Shipping',
    icon: '📦',
    estimateDays: { min: 5, max: 14 },
    description: 'Ground shipping via common carrier',
  },
  whiteGlove: {
    code: 'white-glove',
    label: 'White Glove Delivery',
    icon: '✨',
    estimateDays: { min: 3, max: 7 },
    description: 'In-home delivery, assembly, and packaging removal',
  },
  freight: {
    code: 'freight',
    label: 'Freight / Curbside',
    icon: '🚛',
    estimateDays: { min: 7, max: 21 },
    description: 'Curbside delivery for oversized items',
  },
};

// Coverage zones: NC/SC local, TN/VA/GA regional, national
const COVERAGE_ZONES = {
  local: {
    label: 'Local Delivery',
    states: ['NC', 'SC'],
    whiteGloveAvailable: true,
    whiteGlovePrice: 149,
    standardPrice: 49.99,
    freeThreshold: 1999,
  },
  regional: {
    label: 'Regional Delivery',
    states: ['TN', 'VA', 'GA'],
    whiteGloveAvailable: true,
    whiteGlovePrice: 249,
    standardPrice: 79.99,
    freeThreshold: 1999,
  },
  national: {
    label: 'National Shipping',
    states: [],
    whiteGloveAvailable: false,
    whiteGlovePrice: null,
    standardPrice: 99.99,
    freeThreshold: 1999,
  },
};

// Categories that support white-glove delivery
const WHITE_GLOVE_CATEGORIES = [
  'futon-frames', 'murphy-cabinet-beds', 'platform-beds',
  'casegoods-accessories', 'wall-hugger-frames',
];

// ── Delivery Options Lookup ─────────────────────────────────────────

/**
 * Get delivery options for a zip code and product category.
 * Called by PDP and cart pages to display delivery badges.
 *
 * @param {string} zipCode - 5-digit US zip code
 * @param {string} [productCategory] - Product category slug
 * @param {number} [cartTotal] - Cart total for free shipping check
 * @returns {{success: boolean, zone: Object, options: Array, whiteGloveAvailable: boolean}}
 * @permission Anyone
 */
export const getDeliveryOptions = webMethod(
  Permissions.Anyone,
  (zipCode, productCategory, cartTotal) => {
    const cleanZip = sanitize(zipCode || '', 10).replace(/[^0-9]/g, '').substring(0, 5);
    if (cleanZip.length !== 5) {
      return { success: false, zone: null, options: [], whiteGloveAvailable: false };
    }

    const zone = lookupZone(cleanZip);
    const whiteGloveEligible = productCategory
      ? WHITE_GLOVE_CATEGORIES.includes(productCategory)
      : true;
    const whiteGloveAvailable = zone.whiteGloveAvailable && whiteGloveEligible;
    const terrainSurcharge = getTerrainSurcharge(cleanZip);
    const qualifiesFreeStandard = typeof cartTotal === 'number' && cartTotal >= zone.freeThreshold;
    const qualifiesFreeWhiteGlove = typeof cartTotal === 'number' && cartTotal >= zone.freeThreshold;

    const options = [];

    // Standard shipping
    options.push({
      ...DELIVERY_OPTIONS.standard,
      price: qualifiesFreeStandard ? 0 : zone.standardPrice,
      originalPrice: zone.standardPrice,
      isFree: qualifiesFreeStandard,
      badge: qualifiesFreeStandard ? 'FREE' : `$${zone.standardPrice}`,
    });

    // White glove (if available)
    if (whiteGloveAvailable) {
      const wgPrice = zone.whiteGlovePrice + terrainSurcharge;
      const wgFree = qualifiesFreeWhiteGlove;
      options.push({
        ...DELIVERY_OPTIONS.whiteGlove,
        price: wgFree ? 0 : wgPrice,
        originalPrice: wgPrice,
        isFree: wgFree,
        terrainSurcharge,
        badge: wgFree ? 'FREE' : `$${wgPrice}`,
      });
    }

    // Freight (for oversized or national)
    if (!zone.whiteGloveAvailable) {
      options.push({
        ...DELIVERY_OPTIONS.freight,
        price: zone.standardPrice,
        originalPrice: zone.standardPrice,
        isFree: false,
        badge: `$${zone.standardPrice}`,
      });
    }

    return {
      success: true,
      zone: {
        name: zone.label,
        type: zone.type,
        state: getStateFromZip(cleanZip),
      },
      options,
      whiteGloveAvailable,
      freeShippingThreshold: zone.freeThreshold,
      qualifiesFreeShipping: qualifiesFreeStandard,
    };
  }
);

/**
 * Check if white-glove delivery is available for a product category.
 *
 * @param {string} category - Product category slug
 * @returns {{available: boolean, categories: string[]}}
 * @permission Anyone
 */
export const isWhiteGloveCategory = webMethod(
  Permissions.Anyone,
  (category) => {
    return {
      available: WHITE_GLOVE_CATEGORIES.includes(category),
      categories: WHITE_GLOVE_CATEGORIES,
    };
  }
);

/**
 * Get PDP delivery badge data — condensed format for product page display.
 *
 * @param {string} zipCode
 * @param {string} productCategory
 * @returns {{badge: string, subtext: string, whiteGlove: boolean}}
 * @permission Anyone
 */
export const getPdpDeliveryBadge = webMethod(
  Permissions.Anyone,
  (zipCode, productCategory) => {
    const cleanZip = sanitize(zipCode || '', 10).replace(/[^0-9]/g, '').substring(0, 5);
    if (cleanZip.length !== 5) {
      return { badge: '', subtext: '', whiteGlove: false };
    }

    const zone = lookupZone(cleanZip);
    const wgAvail = zone.whiteGloveAvailable && WHITE_GLOVE_CATEGORIES.includes(productCategory);

    if (wgAvail) {
      return {
        badge: `✨ White Glove Delivery Available`,
        subtext: `From $${zone.whiteGlovePrice} · In-home setup included · Free on orders $${zone.freeThreshold}+`,
        whiteGlove: true,
      };
    }

    return {
      badge: `📦 Shipping from $${zone.standardPrice}`,
      subtext: `Free on orders $${zone.freeThreshold}+ · ${DELIVERY_OPTIONS.standard.estimateDays.min}-${DELIVERY_OPTIONS.standard.estimateDays.max} business days`,
      whiteGlove: false,
    };
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function lookupZone(zipCode) {
  const localZone = matchLocalZone(zipCode, getStateFromZip(zipCode));
  if (localZone) {
    return { ...COVERAGE_ZONES.local, type: 'local' };
  }

  const state = getStateFromZip(zipCode);
  if (COVERAGE_ZONES.regional.states.includes(state)) {
    return { ...COVERAGE_ZONES.regional, type: 'regional' };
  }

  return { ...COVERAGE_ZONES.national, type: 'national' };
}

/**
 * Approximate state from zip code (first 3 digits).
 * Covers major ranges for NC/SC/TN/VA/GA.
 */
function getStateFromZip(zip) {
  const prefix = parseInt(zip.substring(0, 3), 10);
  if (prefix >= 270 && prefix <= 289) return 'NC';
  if (prefix >= 290 && prefix <= 299) return 'SC';
  if (prefix >= 370 && prefix <= 385) return 'TN';
  if (prefix >= 220 && prefix <= 246) return 'VA';
  if (prefix >= 300 && prefix <= 319) return 'GA';
  return 'OTHER';
}

export const _COVERAGE_ZONES = COVERAGE_ZONES;
export const _WHITE_GLOVE_CATEGORIES = WHITE_GLOVE_CATEGORIES;
export const _getStateFromZip = getStateFromZip;
