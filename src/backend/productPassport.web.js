/**
 * @module productPassport
 * @description Digital Product Passport + Resale Marketplace.
 *
 * Each purchased item gets a unique passport with: materials, manufacture date,
 * care history, warranty status, and estimated resale value. Owners can list
 * items for resale on-site with a trade-up incentive (credit toward new purchase).
 *
 * CMS Collections:
 *   ProductPassports — one per purchased item (linked to order + product)
 *   PassportCareLog — care/maintenance events logged by owner
 *   ResaleListings — active marketplace listings
 *
 * CF-zc6r
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';

const PASSPORTS_COLLECTION = 'ProductPassports';
const CARE_LOG_COLLECTION = 'PassportCareLog';
const LISTINGS_COLLECTION = 'ResaleListings';

// Depreciation: 15% year 1, 10% subsequent years, floor at 20% of original
const DEPRECIATION_YEAR_1 = 0.15;
const DEPRECIATION_SUBSEQUENT = 0.10;
const MIN_VALUE_PERCENT = 0.20;

// Trade-up: 10% bonus credit on resale value when applied to new purchase
const TRADE_UP_BONUS_PERCENT = 0.10;

// ── Passport Lifecycle ──────────────────────────────────────────────

/**
 * Create a product passport for a purchased item.
 * Called after order confirmation.
 *
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.productId
 * @param {string} params.productName
 * @param {number} params.purchasePrice
 * @param {string} params.memberId
 * @param {string} [params.materials] - e.g. "Solid plantation hardwood, cherry finish"
 * @param {string} [params.manufacturer]
 * @param {string} [params.warrantyYears]
 * @returns {Promise<{success: boolean, passportId: string|null}>}
 * @permission Admin
 */
export const createPassport = webMethod(
  Permissions.Admin,
  async (params = {}) => {
    try {
      const orderId = sanitize(params.orderId, 50);
      const productId = sanitize(params.productId, 50);
      const productName = sanitize(params.productName, 200);
      const memberId = sanitize(params.memberId, 50);
      const purchasePrice = typeof params.purchasePrice === 'number' ? params.purchasePrice : 0;

      if (!orderId || !productId || !productName || !memberId) {
        return { success: false, passportId: null, error: 'Missing required fields' };
      }

      if (purchasePrice <= 0) {
        return { success: false, passportId: null, error: 'Invalid purchase price' };
      }

      // Dedup: one passport per order+product
      const existing = await wixData.query(PASSPORTS_COLLECTION)
        .eq('orderId', orderId)
        .eq('productId', productId)
        .find();

      if (existing.items.length > 0) {
        return { success: true, passportId: existing.items[0]._id };
      }

      const passport = await wixData.insert(PASSPORTS_COLLECTION, {
        orderId,
        productId,
        productName,
        memberId,
        purchasePrice,
        purchaseDate: new Date(),
        materials: sanitize(params.materials || '', 500),
        manufacturer: sanitize(params.manufacturer || '', 200),
        warrantyYears: parseInt(params.warrantyYears, 10) || 0,
        condition: 'new',
        status: 'active', // active | listed | sold | transferred
        careLogCount: 0,
      });

      logAuditEvent(PASSPORTS_COLLECTION, 'create', memberId, {
        passportId: passport._id, productName,
      });

      return { success: true, passportId: passport._id };
    } catch (err) {
      console.error('[productPassport] createPassport error:', err);
      return { success: false, passportId: null, error: 'Failed to create passport' };
    }
  }
);

/**
 * Get all passports for the logged-in member.
 *
 * @returns {Promise<{success: boolean, passports: Array}>}
 * @permission SiteMember
 */
export const getMyPassports = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, passports: [] };

      const result = await wixData.query(PASSPORTS_COLLECTION)
        .eq('memberId', member._id)
        .eq('status', 'active')
        .descending('purchaseDate')
        .limit(50)
        .find();

      return {
        success: true,
        passports: result.items.map(p => ({
          ...formatPassport(p),
          resaleValue: estimateResaleValue(p.purchasePrice, p.purchaseDate),
          tradeUpCredit: estimateTradeUpCredit(p.purchasePrice, p.purchaseDate),
        })),
      };
    } catch (err) {
      console.error('[productPassport] getMyPassports error:', err);
      return { success: false, passports: [] };
    }
  }
);

/**
 * Get a single passport by ID (public view for resale listings).
 *
 * @param {string} passportId
 * @returns {Promise<{success: boolean, passport: Object|null}>}
 * @permission Anyone
 */
export const getPassport = webMethod(
  Permissions.Anyone,
  async (passportId) => {
    try {
      const cleanId = sanitize(passportId, 50);
      if (!cleanId) return { success: false, passport: null };

      const passport = await wixData.get(PASSPORTS_COLLECTION, cleanId);
      if (!passport) return { success: false, passport: null };

      const careLog = await wixData.query(CARE_LOG_COLLECTION)
        .eq('passportId', cleanId)
        .descending('loggedAt')
        .limit(20)
        .find();

      return {
        success: true,
        passport: {
          ...formatPassport(passport),
          resaleValue: estimateResaleValue(passport.purchasePrice, passport.purchaseDate),
          careHistory: careLog.items.map(formatCareEntry),
        },
      };
    } catch (err) {
      console.error('[productPassport] getPassport error:', err);
      return { success: false, passport: null };
    }
  }
);

// ── Care Log ────────────────────────────────────────────────────────

/**
 * Log a care/maintenance event on a passport.
 *
 * @param {string} passportId
 * @param {string} eventType - 'cleaned' | 'conditioned' | 'repaired' | 'reupholstered'
 * @param {string} [notes]
 * @returns {Promise<{success: boolean}>}
 * @permission SiteMember
 */
export const logCareEvent = webMethod(
  Permissions.SiteMember,
  async (passportId, eventType, notes) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, error: 'Not authenticated' };

      const cleanId = sanitize(passportId, 50);
      const validTypes = ['cleaned', 'conditioned', 'repaired', 'reupholstered'];
      if (!validTypes.includes(eventType)) {
        return { success: false, error: 'Invalid care event type' };
      }

      const passport = await wixData.get(PASSPORTS_COLLECTION, cleanId);
      if (!passport || passport.memberId !== member._id) {
        return { success: false, error: 'Passport not found or not owned' };
      }

      await wixData.insert(CARE_LOG_COLLECTION, {
        passportId: cleanId,
        memberId: member._id,
        eventType,
        notes: sanitize(notes || '', 500),
        loggedAt: new Date(),
      });

      // Update care count on passport
      passport.careLogCount = (passport.careLogCount || 0) + 1;
      await wixData.update(PASSPORTS_COLLECTION, passport);

      return { success: true };
    } catch (err) {
      console.error('[productPassport] logCareEvent error:', err);
      return { success: false, error: 'Failed to log care event' };
    }
  }
);

// ── Resale Marketplace ──────────────────────────────────────────────

/**
 * List an item for resale on the marketplace.
 *
 * @param {string} passportId
 * @param {number} askingPrice
 * @param {string} condition - 'excellent' | 'good' | 'fair'
 * @param {string} [description]
 * @returns {Promise<{success: boolean, listingId: string|null}>}
 * @permission SiteMember
 */
export const createResaleListing = webMethod(
  Permissions.SiteMember,
  async (passportId, askingPrice, condition, description) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false, listingId: null, error: 'Not authenticated' };

      const cleanId = sanitize(passportId, 50);
      const validConditions = ['excellent', 'good', 'fair'];
      if (!validConditions.includes(condition)) {
        return { success: false, listingId: null, error: 'Invalid condition' };
      }
      if (typeof askingPrice !== 'number' || askingPrice <= 0) {
        return { success: false, listingId: null, error: 'Invalid asking price' };
      }

      const passport = await wixData.get(PASSPORTS_COLLECTION, cleanId);
      if (!passport || passport.memberId !== member._id) {
        return { success: false, listingId: null, error: 'Passport not found or not owned' };
      }
      if (passport.status !== 'active') {
        return { success: false, listingId: null, error: 'Item already listed or sold' };
      }

      const listing = await wixData.insert(LISTINGS_COLLECTION, {
        passportId: cleanId,
        sellerId: member._id,
        productId: passport.productId,
        productName: passport.productName,
        originalPrice: passport.purchasePrice,
        askingPrice,
        condition,
        description: sanitize(description || '', 1000),
        estimatedValue: estimateResaleValue(passport.purchasePrice, passport.purchaseDate),
        tradeUpCredit: estimateTradeUpCredit(passport.purchasePrice, passport.purchaseDate),
        status: 'active',
        listedAt: new Date(),
        views: 0,
        inquiries: 0,
      });

      // Mark passport as listed
      passport.status = 'listed';
      await wixData.update(PASSPORTS_COLLECTION, passport);

      logAuditEvent(LISTINGS_COLLECTION, 'create', member._id, {
        listingId: listing._id, productName: passport.productName, askingPrice,
      });

      return { success: true, listingId: listing._id };
    } catch (err) {
      console.error('[productPassport] createResaleListing error:', err);
      return { success: false, listingId: null, error: 'Failed to create listing' };
    }
  }
);

/**
 * Browse active resale listings.
 *
 * @param {Object} [options]
 * @param {string} [options.category] - Filter by product category
 * @param {number} [options.maxPrice] - Max asking price filter
 * @param {number} [options.page=0]
 * @returns {Promise<{success: boolean, listings: Array, total: number}>}
 * @permission Anyone
 */
export const browseListings = webMethod(
  Permissions.Anyone,
  async (options = {}) => {
    try {
      let query = wixData.query(LISTINGS_COLLECTION)
        .eq('status', 'active');

      if (options.maxPrice && typeof options.maxPrice === 'number') {
        query = query.le('askingPrice', options.maxPrice);
      }

      const page = Math.max(0, options.page || 0);
      const pageSize = 20;

      const result = await query
        .descending('listedAt')
        .skip(page * pageSize)
        .limit(pageSize)
        .find();

      return {
        success: true,
        listings: result.items.map(formatListing),
        total: result.totalCount,
      };
    } catch (err) {
      console.error('[productPassport] browseListings error:', err);
      return { success: false, listings: [], total: 0 };
    }
  }
);

// ── Resale Value Estimation ─────────────────────────────────────────

/**
 * Estimate resale value based on age and depreciation curve.
 *
 * @param {number} purchasePrice
 * @param {Date|string} purchaseDate
 * @returns {number} Estimated resale value
 */
function estimateResaleValue(purchasePrice, purchaseDate) {
  if (!purchasePrice || purchasePrice <= 0) return 0;

  const ageYears = (Date.now() - new Date(purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageYears < 0) return purchasePrice;

  let value = purchasePrice;
  if (ageYears <= 1) {
    value = purchasePrice * (1 - DEPRECIATION_YEAR_1 * ageYears);
  } else {
    value = purchasePrice * (1 - DEPRECIATION_YEAR_1);
    value = value * (1 - DEPRECIATION_SUBSEQUENT * (ageYears - 1));
  }

  const floor = purchasePrice * MIN_VALUE_PERCENT;
  return Math.round(Math.max(value, floor));
}

/**
 * Estimate trade-up credit (resale value + 10% bonus).
 *
 * @param {number} purchasePrice
 * @param {Date|string} purchaseDate
 * @returns {number}
 */
function estimateTradeUpCredit(purchasePrice, purchaseDate) {
  const resale = estimateResaleValue(purchasePrice, purchaseDate);
  return Math.round(resale * (1 + TRADE_UP_BONUS_PERCENT));
}

// ── Formatters ──────────────────────────────────────────────────────

function formatPassport(p) {
  return {
    passportId: p._id,
    orderId: p.orderId,
    productId: p.productId,
    productName: p.productName,
    purchasePrice: p.purchasePrice,
    purchaseDate: p.purchaseDate,
    materials: p.materials,
    manufacturer: p.manufacturer,
    warrantyYears: p.warrantyYears,
    condition: p.condition,
    status: p.status,
    careLogCount: p.careLogCount || 0,
  };
}

function formatCareEntry(entry) {
  return {
    eventType: entry.eventType,
    notes: entry.notes,
    loggedAt: entry.loggedAt,
  };
}

function formatListing(l) {
  return {
    listingId: l._id,
    passportId: l.passportId,
    productName: l.productName,
    originalPrice: l.originalPrice,
    askingPrice: l.askingPrice,
    condition: l.condition,
    description: l.description,
    estimatedValue: l.estimatedValue,
    tradeUpCredit: l.tradeUpCredit,
    listedAt: l.listedAt,
    views: l.views,
  };
}

// Exports for testing
export const _estimateResaleValue = estimateResaleValue;
export const _estimateTradeUpCredit = estimateTradeUpCredit;
export const _DEPRECIATION_YEAR_1 = DEPRECIATION_YEAR_1;
export const _TRADE_UP_BONUS_PERCENT = TRADE_UP_BONUS_PERCENT;
