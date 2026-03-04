/**
 * @module warrantyService
 * @description Extended warranty program — purchasable warranty tiers at checkout,
 * warranty registration portal, and claims submission flow. Provides tiered
 * protection plans (Basic/Extended/Premium) with price calculation based on
 * product price, warranty registration for purchased products, and a claims
 * workflow for covered issues.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `WarrantyPlans` with fields:
 *   name (Text) - Display name (e.g. "Extended Protection")
 *   tierSlug (Text, indexed) - Tier identifier (e.g. "basic", "extended", "premium")
 *   durationYears (Number) - Coverage duration in years
 *   coverageType (Text) - "manufacturer"|"extended"|"comprehensive"
 *   priceMultiplier (Number) - Fraction of product price (0 = free, 0.08 = 8%)
 *   description (Text) - Plan description (max 500 chars)
 *   coveredItems (Text) - JSON array of covered issue types
 *   excludedItems (Text) - JSON array of excluded issue types
 *   priority (Number) - Display order (lower = first)
 *   active (Boolean) - Whether plan is available for purchase
 *
 * Create CMS collection `WarrantyRegistrations` with fields:
 *   memberId (Text, indexed) - Purchasing member
 *   planId (Text, indexed) - Reference to WarrantyPlans
 *   planName (Text) - Plan name snapshot at purchase time
 *   productId (Text, indexed) - Product that was purchased
 *   productName (Text) - Product name snapshot
 *   orderId (Text, indexed) - Associated order
 *   warrantyPrice (Number) - Price paid for warranty
 *   status (Text, indexed) - "active"|"expired"|"cancelled"|"claimed"
 *   purchasedAt (Date, indexed) - When warranty was bought
 *   expiresAt (Date, indexed) - When coverage ends
 *   registeredAt (Date) - When product was registered (null if unregistered)
 *   serialNumber (Text) - Product serial number (optional, filled at registration)
 *   purchaseDate (Text) - Original product purchase date (optional, filled at registration)
 *
 * Create CMS collection `WarrantyClaims` with fields:
 *   memberId (Text, indexed) - Member filing the claim
 *   warrantyId (Text, indexed) - Reference to WarrantyRegistrations
 *   claimNumber (Text, indexed) - Human-readable claim number (CLM-YYYYMMDD-NNNN)
 *   issueType (Text, indexed) - "structural"|"fabric"|"mechanism"|"accidental"|"stain"|"other"
 *   description (Text) - Detailed issue description (max 2000 chars)
 *   status (Text, indexed) - "submitted"|"under_review"|"approved"|"denied"|"resolved"
 *   contactEmail (Text) - Contact email for claim updates
 *   contactPhone (Text) - Contact phone (optional)
 *   submittedAt (Date, indexed) - When claim was filed
 *   resolvedAt (Date) - When claim was resolved (null if pending)
 *   resolution (Text) - Resolution details (max 1000 chars)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId, validateEmail } from 'backend/utils/sanitize';

const MAX_PRODUCT_PRICE = 25000;
const VALID_ISSUE_TYPES = ['structural', 'fabric', 'mechanism', 'accidental', 'stain', 'other'];
const MIN_DESCRIPTION_LENGTH = 10;

async function requireMember() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return member._id;
}

function parseJsonArray(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function generateClaimNumber() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
  return `CLM-${date}-${seq}`;
}

/**
 * Get available warranty plans. Plans are global (not per-category) and
 * sorted by priority.
 *
 * @param {string} productCategory - Product category slug (for future per-category filtering).
 * @returns {Promise<{success: boolean, plans: Array}>}
 */
export const getWarrantyPlans = webMethod(
  Permissions.Anyone,
  async (productCategory) => {
    try {
      const category = sanitize(productCategory, 100);
      if (!category) {
        return { success: false, error: 'Product category is required.', plans: [] };
      }

      const result = await wixData.query('WarrantyPlans')
        .eq('active', true)
        .ascending('priority')
        .limit(10)
        .find();

      const plans = result.items.map(item => ({
        _id: item._id,
        name: item.name,
        tierSlug: item.tierSlug,
        durationYears: item.durationYears,
        coverageType: item.coverageType,
        priceMultiplier: item.priceMultiplier,
        description: item.description,
        coveredItems: parseJsonArray(item.coveredItems),
        excludedItems: parseJsonArray(item.excludedItems),
        priority: item.priority,
      }));

      return { success: true, plans };
    } catch (err) {
      console.error('[warrantyService] Error getting warranty plans:', err);
      return { success: false, error: 'Failed to load warranty plans.', plans: [] };
    }
  }
);

/**
 * Calculate warranty price for a specific plan and product price.
 *
 * @param {string} planId - Warranty plan ID.
 * @param {number} productPrice - Product price in dollars.
 * @returns {Promise<{success: boolean, price: number, planName: string, durationYears: number}>}
 */
export const calculateWarrantyPrice = webMethod(
  Permissions.Anyone,
  async (planId, productPrice) => {
    try {
      const cleanId = validateId(planId);
      if (!cleanId) {
        return { success: false, error: 'Valid plan ID is required.' };
      }

      const price = Number(productPrice);
      if (!price || price <= 0) {
        return { success: false, error: 'Valid product price is required.' };
      }

      const cappedPrice = Math.min(price, MAX_PRODUCT_PRICE);

      const result = await wixData.query('WarrantyPlans')
        .eq('_id', cleanId)
        .eq('active', true)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Warranty plan not found.' };
      }

      const plan = result.items[0];
      const warrantyPrice = Math.round(cappedPrice * plan.priceMultiplier * 100) / 100;

      return {
        success: true,
        price: warrantyPrice,
        planName: plan.name,
        durationYears: plan.durationYears,
        coverageType: plan.coverageType,
      };
    } catch (err) {
      console.error('[warrantyService] Error calculating warranty price:', err);
      return { success: false, error: 'Failed to calculate warranty price.' };
    }
  }
);

/**
 * Purchase a warranty at checkout. Creates a WarrantyRegistration record
 * with active status and calculated expiration.
 *
 * @param {Object} data
 * @param {string} data.planId - Selected warranty plan ID.
 * @param {string} data.productId - Product being covered.
 * @param {string} data.productName - Product display name.
 * @param {number} data.productPrice - Product price for warranty calculation.
 * @param {string} data.orderId - Associated order ID.
 * @returns {Promise<{success: boolean, warranty: Object}>}
 */
export const purchaseWarranty = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      const planId = validateId(data.planId);
      if (!planId) {
        return { success: false, error: 'Valid plan ID is required.' };
      }

      const productId = validateId(data.productId);
      if (!productId) {
        return { success: false, error: 'Valid product ID is required.' };
      }

      const orderId = validateId(data.orderId);
      if (!orderId) {
        return { success: false, error: 'Valid order ID is required.' };
      }

      const productPrice = Number(data.productPrice);
      if (!productPrice || productPrice <= 0) {
        return { success: false, error: 'Valid product price is required.' };
      }

      const productName = sanitize(data.productName || '', 200);
      const cappedPrice = Math.min(productPrice, MAX_PRODUCT_PRICE);

      const planResult = await wixData.query('WarrantyPlans')
        .eq('_id', planId)
        .eq('active', true)
        .find();

      if (planResult.items.length === 0) {
        return { success: false, error: 'Warranty plan not found.' };
      }

      const plan = planResult.items[0];
      const warrantyPrice = Math.round(cappedPrice * plan.priceMultiplier * 100) / 100;

      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + plan.durationYears);

      const registration = {
        memberId,
        planId,
        planName: plan.name,
        productId,
        productName,
        orderId,
        warrantyPrice,
        status: 'active',
        purchasedAt: now,
        expiresAt,
        registeredAt: null,
        serialNumber: '',
        purchaseDate: '',
      };

      const inserted = await wixData.insert('WarrantyRegistrations', registration);

      return {
        success: true,
        warranty: {
          _id: inserted._id,
          planName: plan.name,
          productName,
          warrantyPrice,
          status: 'active',
          purchasedAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      };
    } catch (err) {
      console.error('[warrantyService] Error purchasing warranty:', err);
      return { success: false, error: 'Failed to purchase warranty.' };
    }
  }
);

/**
 * Register a warranty — adds serial number and purchase date after delivery.
 *
 * @param {Object} data
 * @param {string} data.warrantyId - Warranty registration ID.
 * @param {string} [data.serialNumber] - Product serial number.
 * @param {string} [data.purchaseDate] - Original purchase date string.
 * @returns {Promise<{success: boolean}>}
 */
export const registerWarranty = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      const warrantyId = validateId(data.warrantyId);
      if (!warrantyId) {
        return { success: false, error: 'Valid warranty ID is required.' };
      }

      const result = await wixData.query('WarrantyRegistrations')
        .eq('_id', warrantyId)
        .eq('memberId', memberId)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Warranty not found.' };
      }

      const warranty = result.items[0];
      warranty.registeredAt = new Date();
      warranty.serialNumber = sanitize(data.serialNumber || '', 100);
      warranty.purchaseDate = sanitize(data.purchaseDate || '', 20);

      await wixData.update('WarrantyRegistrations', warranty);

      return { success: true };
    } catch (err) {
      console.error('[warrantyService] Error registering warranty:', err);
      return { success: false, error: 'Failed to register warranty.' };
    }
  }
);

/**
 * Get all warranties for the authenticated member.
 *
 * @returns {Promise<{success: boolean, warranties: Array}>}
 */
export const getMyWarranties = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const memberId = await requireMember();

      const result = await wixData.query('WarrantyRegistrations')
        .eq('memberId', memberId)
        .descending('purchasedAt')
        .limit(50)
        .find();

      const warranties = result.items.map(item => ({
        _id: item._id,
        planId: item.planId,
        planName: item.planName,
        productId: item.productId,
        productName: item.productName,
        orderId: item.orderId,
        warrantyPrice: item.warrantyPrice,
        status: item.status,
        purchasedAt: item.purchasedAt,
        expiresAt: item.expiresAt,
        registeredAt: item.registeredAt,
      }));

      return { success: true, warranties };
    } catch (err) {
      console.error('[warrantyService] Error getting warranties:', err);
      return { success: false, error: 'Failed to load warranties.', warranties: [] };
    }
  }
);

/**
 * Get full details for a specific warranty, including plan coverage info.
 *
 * @param {string} warrantyId - Warranty registration ID.
 * @returns {Promise<{success: boolean, warranty: Object}>}
 */
export const getWarrantyDetails = webMethod(
  Permissions.SiteMember,
  async (warrantyId) => {
    try {
      const memberId = await requireMember();

      const cleanId = validateId(warrantyId);
      if (!cleanId) {
        return { success: false, error: 'Valid warranty ID is required.' };
      }

      const result = await wixData.query('WarrantyRegistrations')
        .eq('_id', cleanId)
        .eq('memberId', memberId)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Warranty not found.' };
      }

      const item = result.items[0];

      let coveredItems = [];
      let excludedItems = [];

      if (item.planId) {
        const planResult = await wixData.query('WarrantyPlans')
          .eq('_id', item.planId)
          .find();

        if (planResult.items.length > 0) {
          const plan = planResult.items[0];
          coveredItems = parseJsonArray(plan.coveredItems);
          excludedItems = parseJsonArray(plan.excludedItems);
        }
      }

      return {
        success: true,
        warranty: {
          _id: item._id,
          planId: item.planId,
          planName: item.planName,
          productId: item.productId,
          productName: item.productName,
          orderId: item.orderId,
          warrantyPrice: item.warrantyPrice,
          status: item.status,
          purchasedAt: item.purchasedAt,
          expiresAt: item.expiresAt,
          registeredAt: item.registeredAt,
          serialNumber: item.serialNumber || '',
          coveredItems,
          excludedItems,
        },
      };
    } catch (err) {
      console.error('[warrantyService] Error getting warranty details:', err);
      return { success: false, error: 'Failed to load warranty details.' };
    }
  }
);

/**
 * Submit a warranty claim.
 *
 * @param {Object} data
 * @param {string} data.warrantyId - Warranty registration ID.
 * @param {string} data.issueType - One of: structural, fabric, mechanism, accidental, stain, other.
 * @param {string} data.description - Detailed issue description (min 10 chars).
 * @param {string} data.contactEmail - Email for claim updates.
 * @param {string} [data.contactPhone] - Phone number (optional).
 * @returns {Promise<{success: boolean, claim: Object}>}
 */
export const submitClaim = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const memberId = await requireMember();

      const warrantyId = validateId(data.warrantyId);
      if (!warrantyId) {
        return { success: false, error: 'Valid warranty ID is required.' };
      }

      const issueType = sanitize(data.issueType, 30);
      if (!issueType || !VALID_ISSUE_TYPES.includes(issueType)) {
        return { success: false, error: `Valid issue type is required. Must be one of: ${VALID_ISSUE_TYPES.join(', ')}.` };
      }

      const description = sanitize(data.description, 2000);
      if (!description || description.length < MIN_DESCRIPTION_LENGTH) {
        return { success: false, error: `Claim description must be at least ${MIN_DESCRIPTION_LENGTH} characters.` };
      }

      const contactEmail = sanitize(data.contactEmail, 254);
      if (!validateEmail(contactEmail)) {
        return { success: false, error: 'Valid contact email is required.' };
      }

      const warrantyResult = await wixData.query('WarrantyRegistrations')
        .eq('_id', warrantyId)
        .eq('memberId', memberId)
        .find();

      if (warrantyResult.items.length === 0) {
        return { success: false, error: 'Warranty not found.' };
      }

      const warranty = warrantyResult.items[0];

      if (warranty.status === 'expired' || new Date(warranty.expiresAt) < new Date()) {
        return { success: false, error: 'This warranty has expired. Claims cannot be filed on expired warranties.' };
      }

      const claimNumber = generateClaimNumber();

      const claim = {
        memberId,
        warrantyId,
        claimNumber,
        issueType,
        description,
        status: 'submitted',
        contactEmail,
        contactPhone: sanitize(data.contactPhone || '', 20),
        submittedAt: new Date(),
        resolvedAt: null,
        resolution: '',
      };

      const inserted = await wixData.insert('WarrantyClaims', claim);

      return {
        success: true,
        claim: {
          _id: inserted._id,
          claimNumber,
          issueType,
          description,
          status: 'submitted',
          submittedAt: claim.submittedAt.toISOString(),
        },
      };
    } catch (err) {
      console.error('[warrantyService] Error submitting claim:', err);
      return { success: false, error: 'Failed to submit warranty claim.' };
    }
  }
);

/**
 * Get status of a specific warranty claim.
 *
 * @param {string} claimId - Claim ID.
 * @returns {Promise<{success: boolean, claim: Object}>}
 */
export const getClaimStatus = webMethod(
  Permissions.SiteMember,
  async (claimId) => {
    try {
      const memberId = await requireMember();

      const cleanId = validateId(claimId);
      if (!cleanId) {
        return { success: false, error: 'Valid claim ID is required.' };
      }

      const result = await wixData.query('WarrantyClaims')
        .eq('_id', cleanId)
        .eq('memberId', memberId)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Claim not found.' };
      }

      const item = result.items[0];

      return {
        success: true,
        claim: {
          _id: item._id,
          claimNumber: item.claimNumber,
          warrantyId: item.warrantyId,
          issueType: item.issueType,
          description: item.description,
          status: item.status,
          contactEmail: item.contactEmail,
          submittedAt: item.submittedAt,
          resolvedAt: item.resolvedAt,
          resolution: item.resolution || '',
        },
      };
    } catch (err) {
      console.error('[warrantyService] Error getting claim status:', err);
      return { success: false, error: 'Failed to load claim status.' };
    }
  }
);

/**
 * Get all claims for the authenticated member.
 *
 * @returns {Promise<{success: boolean, claims: Array}>}
 */
export const getMyClaims = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const memberId = await requireMember();

      const result = await wixData.query('WarrantyClaims')
        .eq('memberId', memberId)
        .descending('submittedAt')
        .limit(50)
        .find();

      const claims = result.items.map(item => ({
        _id: item._id,
        claimNumber: item.claimNumber,
        warrantyId: item.warrantyId,
        issueType: item.issueType,
        description: item.description,
        status: item.status,
        submittedAt: item.submittedAt,
        resolvedAt: item.resolvedAt,
      }));

      return { success: true, claims };
    } catch (err) {
      console.error('[warrantyService] Error getting claims:', err);
      return { success: false, error: 'Failed to load claims.', claims: [] };
    }
  }
);
