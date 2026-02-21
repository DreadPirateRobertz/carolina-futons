/**
 * @module sustainability
 * @description Sustainability badges and trade-in program for repeat revenue.
 * Product sustainability info (material sourcing, durability, recyclability),
 * carbon offset at checkout, and trade-in program (old futon for store credit).
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection `ProductSustainability` with fields:
 *   productId (Text, indexed) - Product this applies to
 *   productCategory (Text, indexed) - Category for bulk lookups
 *   materialSource (Text) - e.g. 'Plantation-grown rubberwood'
 *   durabilityRating (Number) - 1-5 rating
 *   durabilityYears (Number) - Expected lifespan in years
 *   recyclability (Text) - 'fully'|'partially'|'limited'|'none'
 *   certifications (Text) - JSON array of cert names
 *   carbonFootprint (Number) - kg CO2 estimate for production + shipping
 *   sustainabilityScore (Number) - Composite score 1-100
 *   badges (Text) - JSON array of badge slugs earned
 *   active (Boolean)
 *
 * Create CMS collection `TradeInRequests` with fields:
 *   memberId (Text, indexed) - Member requesting trade-in
 *   memberEmail (Text) - Contact email
 *   productType (Text) - What they're trading in
 *   condition (Text, indexed) - 'excellent'|'good'|'fair'|'poor'
 *   age (Text) - Age of item being traded
 *   description (Text) - Description of item
 *   photos (Text) - JSON array of photo URLs
 *   estimatedCredit (Number) - Estimated store credit amount
 *   status (Text, indexed) - 'submitted'|'reviewing'|'approved'|'shipped'|'received'|'credited'|'rejected'
 *   submittedAt (Date, indexed)
 *   reviewedAt (Date)
 *   creditAmount (Number) - Final credit issued
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

async function requireMember() {
  const member = await currentMember.getMember();
  if (!member) throw new Error('Authentication required');
  return member;
}

// Badge definitions
const BADGE_DEFS = {
  'eco-material': { label: 'Eco-Friendly Materials', icon: 'leaf', description: 'Made from sustainably sourced materials' },
  'long-lasting': { label: 'Built to Last', icon: 'shield', description: 'Designed for 15+ years of daily use' },
  'recyclable': { label: 'Recyclable', icon: 'recycle', description: 'Materials can be recycled at end of life' },
  'low-carbon': { label: 'Low Carbon', icon: 'globe', description: 'Below-average carbon footprint for its category' },
  'certified': { label: 'Certified Sustainable', icon: 'badge', description: 'Third-party sustainability certification' },
  'trade-in-eligible': { label: 'Trade-In Eligible', icon: 'refresh', description: 'Eligible for our trade-in credit program' },
};

// Credit ranges by condition
const CREDIT_RANGES = {
  excellent: { min: 100, max: 200 },
  good: { min: 75, max: 150 },
  fair: { min: 50, max: 100 },
  poor: { min: 25, max: 50 },
};

/**
 * Get sustainability info and badges for a product.
 *
 * @param {string} productId - Product ID.
 * @returns {Promise<{success: boolean, sustainability: Object}>}
 */
export const getSustainabilityInfo = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = validateId(productId);
      if (!cleanId) {
        return { success: false, error: 'Valid product ID is required.', sustainability: null };
      }

      const result = await wixData.query('ProductSustainability')
        .eq('productId', cleanId)
        .eq('active', true)
        .limit(1)
        .find();

      if (result.items.length === 0) {
        return { success: true, sustainability: null };
      }

      const item = result.items[0];
      const badges = parseBadges(item.badges);
      const certifications = parseJson(item.certifications);

      return {
        success: true,
        sustainability: {
          productId: item.productId,
          materialSource: item.materialSource || '',
          durabilityRating: item.durabilityRating || 0,
          durabilityYears: item.durabilityYears || 0,
          recyclability: item.recyclability || 'none',
          certifications,
          carbonFootprint: item.carbonFootprint || 0,
          sustainabilityScore: item.sustainabilityScore || 0,
          badges: badges.map(slug => ({
            slug,
            ...(BADGE_DEFS[slug] || { label: slug, icon: 'leaf', description: '' }),
          })),
        },
      };
    } catch (err) {
      console.error('[sustainability] Error getting sustainability info:', err);
      return { success: false, error: 'Failed to load sustainability info.', sustainability: null };
    }
  }
);

/**
 * Calculate carbon offset cost for a product or order.
 * Uses a simplified model: $0.01 per kg CO2.
 *
 * @param {string[]} productIds - Array of product IDs.
 * @returns {Promise<{success: boolean, offset: Object}>}
 */
export const calculateCarbonOffset = webMethod(
  Permissions.Anyone,
  async (productIds) => {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return { success: false, error: 'Product IDs array is required.', offset: null };
      }

      const cleanIds = productIds
        .slice(0, 20)
        .map(id => validateId(id))
        .filter(Boolean);

      if (cleanIds.length === 0) {
        return { success: false, error: 'No valid product IDs provided.', offset: null };
      }

      const result = await wixData.query('ProductSustainability')
        .hasSome('productId', cleanIds)
        .eq('active', true)
        .limit(20)
        .find();

      const totalCarbon = result.items.reduce((sum, item) => sum + (item.carbonFootprint || 0), 0);
      const costPerKg = 0.01;
      const offsetCost = Math.round(totalCarbon * costPerKg * 100) / 100;
      // Minimum $1 offset if any carbon exists
      const finalCost = totalCarbon > 0 ? Math.max(1, offsetCost) : 0;

      return {
        success: true,
        offset: {
          totalCarbonKg: Math.round(totalCarbon * 10) / 10,
          offsetCost: finalCost,
          productsMatched: result.items.length,
          productsRequested: cleanIds.length,
          treesEquivalent: Math.round(totalCarbon / 21.77 * 10) / 10, // avg tree absorbs 21.77 kg/year
        },
      };
    } catch (err) {
      console.error('[sustainability] Error calculating carbon offset:', err);
      return { success: false, error: 'Failed to calculate offset.', offset: null };
    }
  }
);

/**
 * Submit a trade-in request. Returns estimated credit range.
 *
 * @param {Object} data
 * @param {string} data.productType - Type of product being traded in.
 * @param {string} data.condition - 'excellent'|'good'|'fair'|'poor'
 * @param {string} [data.age] - Age of item (e.g. '3 years').
 * @param {string} [data.description] - Description of item.
 * @param {string[]} [data.photos] - Photo URLs of item.
 * @returns {Promise<{success: boolean, id?: string, estimatedCredit: Object}>}
 */
export const submitTradeIn = webMethod(
  Permissions.SiteMember,
  async (data) => {
    try {
      const member = await requireMember();

      const productType = sanitize(data.productType, 100);
      if (!productType) {
        return { success: false, error: 'Product type is required.' };
      }

      const validConditions = ['excellent', 'good', 'fair', 'poor'];
      const condition = sanitize(data.condition, 20);
      if (!validConditions.includes(condition)) {
        return { success: false, error: 'Condition must be excellent, good, fair, or poor.' };
      }

      const creditRange = CREDIT_RANGES[condition];
      const estimatedCredit = Math.round((creditRange.min + creditRange.max) / 2);

      const photos = Array.isArray(data.photos)
        ? data.photos.slice(0, 5).map(p => sanitize(p, 500)).filter(Boolean)
        : [];

      const record = {
        memberId: member._id,
        memberEmail: member.loginEmail || '',
        productType,
        condition,
        age: sanitize(data.age || '', 50),
        description: sanitize(data.description || '', 1000),
        photos: JSON.stringify(photos),
        estimatedCredit,
        status: 'submitted',
        submittedAt: new Date(),
        reviewedAt: null,
        creditAmount: 0,
      };

      const inserted = await wixData.insert('TradeInRequests', record);

      return {
        success: true,
        id: inserted._id,
        estimatedCredit: {
          amount: estimatedCredit,
          range: creditRange,
          condition,
        },
      };
    } catch (err) {
      console.error('[sustainability] Error submitting trade-in:', err);
      return { success: false, error: 'Failed to submit trade-in request.' };
    }
  }
);

/**
 * Get trade-in request status for the current member.
 *
 * @param {string} [requestId] - Specific request ID, or omit for all.
 * @returns {Promise<{success: boolean, requests: Array}>}
 */
export const getTradeInStatus = webMethod(
  Permissions.SiteMember,
  async (requestId) => {
    try {
      const member = await requireMember();

      if (requestId) {
        const cleanId = validateId(requestId);
        if (!cleanId) {
          return { success: false, error: 'Valid request ID is required.', requests: [] };
        }

        const item = await wixData.get('TradeInRequests', cleanId);
        if (!item || item.memberId !== member._id) {
          return { success: true, requests: [] };
        }

        return {
          success: true,
          requests: [formatTradeIn(item)],
        };
      }

      const result = await wixData.query('TradeInRequests')
        .eq('memberId', member._id)
        .descending('submittedAt')
        .limit(20)
        .find();

      return {
        success: true,
        requests: result.items.map(formatTradeIn),
      };
    } catch (err) {
      console.error('[sustainability] Error getting trade-in status:', err);
      return { success: false, error: 'Failed to load trade-in status.', requests: [] };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

function parseBadges(badgesJson) {
  const parsed = parseJson(badgesJson);
  return Array.isArray(parsed) ? parsed.filter(b => typeof b === 'string') : [];
}

function parseJson(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatTradeIn(item) {
  return {
    _id: item._id,
    productType: item.productType,
    condition: item.condition,
    age: item.age,
    description: item.description,
    estimatedCredit: item.estimatedCredit,
    status: item.status,
    submittedAt: item.submittedAt,
    reviewedAt: item.reviewedAt,
    creditAmount: item.creditAmount || 0,
  };
}
