/**
 * @module warrantyService
 * @description Extended warranty program — registration portal for purchased
 * warranties, customer-side details/claims surface. cf-4x7e Pass 2 chunk 16
 * retired the upstream warranty-plan purchase surface (getWarrantyPlans,
 * calculateWarrantyPrice, purchaseWarranty — never wired; the ProductPage
 * checkout flow doesn't currently sell extended warranties). Kept the
 * registerWarranty + getMyWarranties live endpoints and defensively kept
 * the claims UI surface (getWarrantyDetails, submitClaim, getClaimStatus,
 * getMyClaims — Stilgar's open question).
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

const VALID_ISSUE_TYPES = ['structural', 'fabric', 'mechanism', 'accidental', 'stain', 'other'];
const MIN_DESCRIPTION_LENGTH = 10;
const EMAIL_QUEUE_COLLECTION = 'EmailQueue';

async function requireMember() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return member._id;
}

/**
 * Like requireMember() but also returns the member's login email.
 * Used when we need to send a confirmation email after the action.
 * @returns {Promise<{memberId: string, email: string}>}
 */
async function requireMemberWithEmail() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return { memberId: member._id, email: member.loginEmail || '' };
}

/**
 * Queue an email notification — non-fatal; failures are logged and swallowed
 * so they never abort the parent operation.
 * @param {string} templateId
 * @param {string} recipientEmail
 * @param {Object} variables
 */
async function queueEmail(templateId, recipientEmail, variables) {
  const cleanEmail = sanitize(recipientEmail, 254);
  if (!validateEmail(cleanEmail)) {
    console.warn(`[warrantyService] queueEmail skipped — invalid recipientEmail for template ${templateId}`);
    return;
  }
  try {
    await wixData.insert(EMAIL_QUEUE_COLLECTION, {
      templateId: sanitize(templateId, 100),
      recipientEmail: cleanEmail,
      variables,
      status: 'pending',
      createdAt: new Date(),
    });
  } catch (err) {
    console.error(`[warrantyService] Email queue insert failed (${templateId}):`, err);
  }
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
      const { memberId, email: memberEmail } = await requireMemberWithEmail();

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

      const registeredAt = new Date();
      const warranty = {
        ...result.items[0],
        registeredAt,
        serialNumber: sanitize(data.serialNumber || '', 100),
        purchaseDate: sanitize(data.purchaseDate || '', 20),
      };

      await wixData.update('WarrantyRegistrations', warranty);

      // Queue registration confirmation email — non-fatal
      await queueEmail('warranty_registered', memberEmail, {
        memberId,
        warrantyId: warranty._id,
        productName: warranty.productName || '',
        planName: warranty.planName || '',
        serialNumber: warranty.serialNumber || '',
        registeredAt: registeredAt.toISOString(),
      });

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

      const now = new Date();
      const warranties = [];
      for (const raw of result.items) {
        // Auto-expire: immutable — never mutate the DB record in-place.
        const item = (raw.status === 'active' && raw.expiresAt && new Date(raw.expiresAt) < now)
          ? { ...raw, status: 'expired' }
          : raw;
        if (item.status === 'expired' && raw.status === 'active') {
          await wixData.update('WarrantyRegistrations', item).catch(() => {});
        }
        warranties.push({
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
        });
      }

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

      let item = result.items[0];

      // Auto-expire: flip status in DB and return if past expiresAt
      if (item.status === 'active' && item.expiresAt && new Date(item.expiresAt) < new Date()) {
        item = { ...item, status: 'expired' };
        wixData.update('WarrantyRegistrations', item).catch(() => {});
      }

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
