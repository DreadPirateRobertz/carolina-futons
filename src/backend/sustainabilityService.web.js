/**
 * @module sustainabilityService
 * @description Sustainability badges, carbon offset calculator, and trade-in program.
 * Shows eco-friendly material sourcing, durability ratings, and recyclability on
 * product pages. Customers can trade in old futons for store credit ($50-200).
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection "ProductSustainability" with fields:
 * - productId (Text, indexed) - Reference to Stores/Products
 * - materialSource (Text) - e.g. "FSC-certified hardwood", "Recycled steel"
 * - durabilityRating (Number) - 1-5 stars
 * - recyclabilityPercent (Number) - 0-100
 * - carbonFootprintKg (Number) - Manufacturing carbon footprint in kg CO2
 * - certifications (Tags) - e.g. ["FSC", "GREENGUARD", "CertiPUR-US"]
 * - ecoScore (Text) - "A" | "B" | "C" | "D" (computed from ratings)
 * - tradeInEligible (Boolean) - Whether product qualifies for trade-in credit
 * - tradeInCreditMin (Number) - Minimum trade-in credit value
 * - tradeInCreditMax (Number) - Maximum trade-in credit value
 * - _createdDate (DateTime) - Auto
 *
 * Create CMS collection "TradeInRequests" with fields:
 * - memberId (Text, indexed) - Requesting member
 * - memberEmail (Text) - Contact email
 * - productCategory (Text) - Category of item being traded in
 * - condition (Text) - "excellent" | "good" | "fair" | "poor"
 * - description (Text) - Customer description of item
 * - photos (Tags) - URLs of uploaded photos
 * - estimatedCredit (Number) - Calculated credit amount
 * - status (Text) - "pending" | "approved" | "rejected" | "completed"
 * - adminNotes (Text) - Internal notes from review
 * - reviewedBy (Text) - Admin member ID
 * - reviewedAt (DateTime) - When reviewed
 * - _createdDate (DateTime) - Auto
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

const SUSTAINABILITY_COLLECTION = 'ProductSustainability';
const TRADEIN_COLLECTION = 'TradeInRequests';

// Condition multipliers for trade-in credit calculation
const CONDITION_MULTIPLIERS = {
  excellent: 1.0,
  good: 0.75,
  fair: 0.5,
  poor: 0.25,
};

// Category base credits
const CATEGORY_BASE_CREDITS = {
  'futon-frames': { min: 75, max: 200 },
  'mattresses': { min: 50, max: 100 },
  'murphy-cabinet-beds': { min: 100, max: 200 },
  'platform-beds': { min: 75, max: 175 },
  'outdoor-furniture': { min: 50, max: 150 },
  'casegoods-accessories': { min: 25, max: 75 },
  'covers': { min: 25, max: 50 },
  'pillows-702': { min: 15, max: 40 },
};

// Carbon offset rate: $ per kg CO2
const CARBON_OFFSET_RATE = 0.02;

// ── Admin check ─────────────────────────────────────────────────────

async function requireAdmin() {
  const member = await currentMember.getMember();
  if (!member || !member._id) {
    throw new Error('Authentication required.');
  }
  const roles = await currentMember.getRoles();
  const isAdmin = roles.some(r => r.title === 'Admin' || r._id === 'admin');
  if (!isAdmin) {
    throw new Error('Admin access required.');
  }
  return member._id;
}

// ── getSustainabilityInfo (public) ──────────────────────────────────

export const getSustainabilityInfo = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = sanitize(productId, 50);
      if (!cleanId) {
        return { success: false, error: 'Product ID required' };
      }

      const result = await wixData.query(SUSTAINABILITY_COLLECTION)
        .eq('productId', cleanId)
        .find();

      if (result.items.length === 0) {
        return { success: true, found: false, info: null };
      }

      const item = result.items[0];
      return {
        success: true,
        found: true,
        info: {
          productId: item.productId,
          materialSource: item.materialSource || '',
          durabilityRating: item.durabilityRating || 0,
          recyclabilityPercent: item.recyclabilityPercent || 0,
          carbonFootprintKg: item.carbonFootprintKg || 0,
          certifications: item.certifications || [],
          ecoScore: item.ecoScore || 'D',
          tradeInEligible: item.tradeInEligible || false,
          tradeInCreditRange: item.tradeInEligible
            ? { min: item.tradeInCreditMin || 0, max: item.tradeInCreditMax || 0 }
            : null,
        },
      };
    } catch (err) {
      console.error('getSustainabilityInfo error:', err);
      return { success: false, error: 'Unable to fetch sustainability info' };
    }
  }
);

// ── getBatchSustainabilityBadges (public, for category pages) ───────

export const getBatchSustainabilityBadges = webMethod(
  Permissions.Anyone,
  async (productIds = []) => {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return { success: true, badges: {} };
      }

      const cleanIds = productIds
        .map(id => sanitize(id, 50))
        .filter(Boolean)
        .slice(0, 50);

      if (cleanIds.length === 0) {
        return { success: true, badges: {} };
      }

      const result = await wixData.query(SUSTAINABILITY_COLLECTION)
        .hasSome('productId', cleanIds)
        .find();

      const badges = {};
      for (const item of result.items) {
        const badgeList = [];

        if (item.ecoScore === 'A' || item.ecoScore === 'B') {
          badgeList.push({ type: 'eco-score', label: `Eco Score: ${item.ecoScore}`, color: item.ecoScore === 'A' ? '#2E7D32' : '#558B2F' });
        }

        if (item.certifications && item.certifications.length > 0) {
          badgeList.push({ type: 'certified', label: item.certifications[0], color: '#1565C0' });
        }

        if (item.durabilityRating >= 4) {
          badgeList.push({ type: 'durable', label: `${item.durabilityRating}/5 Durability`, color: '#6A1B9A' });
        }

        if (item.recyclabilityPercent >= 75) {
          badgeList.push({ type: 'recyclable', label: `${item.recyclabilityPercent}% Recyclable`, color: '#00695C' });
        }

        if (item.tradeInEligible) {
          badgeList.push({ type: 'trade-in', label: 'Trade-In Eligible', color: '#E65100' });
        }

        if (badgeList.length > 0) {
          badges[item.productId] = badgeList;
        }
      }

      return { success: true, badges };
    } catch (err) {
      console.error('getBatchSustainabilityBadges error:', err);
      return { success: false, error: 'Unable to fetch sustainability badges' };
    }
  }
);

// ── calculateCarbonOffset (public) ──────────────────────────────────

export const calculateCarbonOffset = webMethod(
  Permissions.Anyone,
  async (productIds = []) => {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return { success: true, totalKg: 0, offsetCost: 0, products: [] };
      }

      const cleanIds = productIds
        .map(id => sanitize(id, 50))
        .filter(Boolean)
        .slice(0, 20);

      if (cleanIds.length === 0) {
        return { success: true, totalKg: 0, offsetCost: 0, products: [] };
      }

      const result = await wixData.query(SUSTAINABILITY_COLLECTION)
        .hasSome('productId', cleanIds)
        .find();

      let totalKg = 0;
      const products = [];

      for (const item of result.items) {
        const kg = item.carbonFootprintKg || 0;
        totalKg += kg;
        products.push({
          productId: item.productId,
          carbonFootprintKg: kg,
          offsetCost: Math.round(kg * CARBON_OFFSET_RATE * 100) / 100,
        });
      }

      return {
        success: true,
        totalKg: Math.round(totalKg * 100) / 100,
        offsetCost: Math.round(totalKg * CARBON_OFFSET_RATE * 100) / 100,
        products,
      };
    } catch (err) {
      console.error('calculateCarbonOffset error:', err);
      return { success: false, error: 'Unable to calculate carbon offset' };
    }
  }
);

// ── estimateTradeInCredit (public) ──────────────────────────────────

export const estimateTradeInCredit = webMethod(
  Permissions.Anyone,
  async (category, condition) => {
    try {
      const cleanCategory = sanitize(category, 50);
      const cleanCondition = sanitize(condition, 20);

      if (!cleanCategory || !cleanCondition) {
        return { success: false, error: 'Category and condition required' };
      }

      const baseCredits = CATEGORY_BASE_CREDITS[cleanCategory];
      if (!baseCredits) {
        return { success: false, error: 'Invalid product category' };
      }

      const multiplier = CONDITION_MULTIPLIERS[cleanCondition];
      if (multiplier === undefined) {
        return { success: false, error: 'Invalid condition. Use: excellent, good, fair, poor' };
      }

      const minCredit = Math.round(baseCredits.min * multiplier);
      const maxCredit = Math.round(baseCredits.max * multiplier);

      return {
        success: true,
        category: cleanCategory,
        condition: cleanCondition,
        creditRange: { min: minCredit, max: maxCredit },
        message: `Trade in your ${cleanCategory.replace(/-/g, ' ')} in ${cleanCondition} condition for $${minCredit}-$${maxCredit} store credit.`,
      };
    } catch (err) {
      console.error('estimateTradeInCredit error:', err);
      return { success: false, error: 'Unable to estimate trade-in credit' };
    }
  }
);

// ── submitTradeIn (member) ──────────────────────────────────────────

export const submitTradeIn = webMethod(
  Permissions.SiteMember,
  async (tradeInData = {}) => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'Must be logged in to submit trade-in request' };
      }

      const { category, condition, description, photos } = tradeInData;

      const cleanCategory = sanitize(category, 50);
      const cleanCondition = sanitize(condition, 20);
      const cleanDescription = sanitize(description, 500);

      if (!cleanCategory || !cleanCondition) {
        return { success: false, error: 'Category and condition required' };
      }

      const baseCredits = CATEGORY_BASE_CREDITS[cleanCategory];
      if (!baseCredits) {
        return { success: false, error: 'Invalid product category' };
      }

      const multiplier = CONDITION_MULTIPLIERS[cleanCondition];
      if (multiplier === undefined) {
        return { success: false, error: 'Invalid condition' };
      }

      // Calculate estimated credit (midpoint of range)
      const minCredit = Math.round(baseCredits.min * multiplier);
      const maxCredit = Math.round(baseCredits.max * multiplier);
      const estimatedCredit = Math.round((minCredit + maxCredit) / 2);

      // Sanitize photo URLs
      const cleanPhotos = Array.isArray(photos)
        ? photos.map(p => sanitize(p, 500)).filter(Boolean).slice(0, 5)
        : [];

      const request = await wixData.insert(TRADEIN_COLLECTION, {
        memberId: member._id,
        memberEmail: member.loginEmail || '',
        productCategory: cleanCategory,
        condition: cleanCondition,
        description: cleanDescription || '',
        photos: cleanPhotos,
        estimatedCredit,
        status: 'pending',
        adminNotes: '',
        reviewedBy: '',
        reviewedAt: null,
      });

      return {
        success: true,
        requestId: request._id,
        estimatedCredit,
        creditRange: { min: minCredit, max: maxCredit },
        message: `Trade-in request submitted! Estimated credit: $${minCredit}-$${maxCredit}. We'll review within 2 business days.`,
      };
    } catch (err) {
      console.error('submitTradeIn error:', err);
      return { success: false, error: 'Unable to submit trade-in request' };
    }
  }
);

// ── getTradeInStatus (member) ───────────────────────────────────────

export const getTradeInStatus = webMethod(
  Permissions.SiteMember,
  async (requestId) => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'Must be logged in' };
      }

      const cleanId = sanitize(requestId, 50);
      if (!cleanId) {
        return { success: false, error: 'Request ID required' };
      }

      const request = await wixData.get(TRADEIN_COLLECTION, cleanId);
      if (!request) {
        return { success: false, error: 'Trade-in request not found' };
      }

      if (request.memberId !== member._id) {
        return { success: false, error: 'Access denied' };
      }

      return {
        success: true,
        request: {
          _id: request._id,
          productCategory: request.productCategory,
          condition: request.condition,
          description: request.description,
          estimatedCredit: request.estimatedCredit,
          status: request.status,
          adminNotes: request.status !== 'pending' ? (request.adminNotes || '') : '',
          submittedDate: request._createdDate,
        },
      };
    } catch (err) {
      console.error('getTradeInStatus error:', err);
      return { success: false, error: 'Unable to fetch trade-in status' };
    }
  }
);

// ── getMyTradeIns (member) ──────────────────────────────────────────

export const getMyTradeIns = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'Must be logged in' };
      }

      const result = await wixData.query(TRADEIN_COLLECTION)
        .eq('memberId', member._id)
        .descending('_createdDate')
        .limit(20)
        .find();

      return {
        success: true,
        requests: result.items.map(r => ({
          _id: r._id,
          productCategory: r.productCategory,
          condition: r.condition,
          estimatedCredit: r.estimatedCredit,
          status: r.status,
          submittedDate: r._createdDate,
        })),
      };
    } catch (err) {
      console.error('getMyTradeIns error:', err);
      return { success: false, error: 'Unable to fetch trade-in requests' };
    }
  }
);

// ── moderateTradeIn (admin) ─────────────────────────────────────────

export const moderateTradeIn = webMethod(
  Permissions.SiteMember,
  async (requestId, decision = {}) => {
    try {
      const adminId = await requireAdmin();

      const cleanId = sanitize(requestId, 50);
      if (!cleanId) {
        return { success: false, error: 'Request ID required' };
      }

      const { action, notes, creditAmount } = decision;
      if (action !== 'approved' && action !== 'rejected') {
        return { success: false, error: 'Action must be "approved" or "rejected"' };
      }

      const request = await wixData.get(TRADEIN_COLLECTION, cleanId);
      if (!request) {
        return { success: false, error: 'Trade-in request not found' };
      }

      if (request.status !== 'pending') {
        return { success: false, error: `Request already ${request.status}` };
      }

      request.status = action;
      request.adminNotes = sanitize(notes, 500) || '';
      request.reviewedBy = adminId;
      request.reviewedAt = new Date();

      if (action === 'approved' && typeof creditAmount === 'number' && creditAmount > 0) {
        request.estimatedCredit = Math.round(creditAmount);
      }

      await wixData.update(TRADEIN_COLLECTION, request);

      return {
        success: true,
        status: action,
        creditAmount: request.estimatedCredit,
      };
    } catch (err) {
      console.error('moderateTradeIn error:', err);
      return { success: false, error: 'Unable to moderate trade-in request' };
    }
  }
);

// ── getPendingTradeIns (admin dashboard) ────────────────────────────

export const getPendingTradeIns = webMethod(
  Permissions.SiteMember,
  async (options = {}) => {
    try {
      await requireAdmin();

      const { status = 'pending', limit = 50 } = options;
      const safeLimit = Math.min(Math.max(1, limit), 100);

      let query = wixData.query(TRADEIN_COLLECTION)
        .descending('_createdDate')
        .limit(safeLimit);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const result = await query.find();

      return {
        success: true,
        requests: result.items.map(r => ({
          _id: r._id,
          memberId: r.memberId,
          memberEmail: r.memberEmail,
          productCategory: r.productCategory,
          condition: r.condition,
          description: r.description,
          photos: r.photos || [],
          estimatedCredit: r.estimatedCredit,
          status: r.status,
          adminNotes: r.adminNotes || '',
          reviewedBy: r.reviewedBy || null,
          reviewedAt: r.reviewedAt || null,
          submittedDate: r._createdDate,
        })),
        totalCount: result.totalCount,
      };
    } catch (err) {
      console.error('getPendingTradeIns error:', err);
      return { success: false, error: 'Unable to load pending trade-ins' };
    }
  }
);

// ── getSustainabilityStats (admin) ──────────────────────────────────

export const getSustainabilityStats = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      await requireAdmin();

      const products = await wixData.query(SUSTAINABILITY_COLLECTION)
        .limit(1000)
        .find();

      let totalProducts = products.items.length;
      let tradeInEligible = 0;
      let avgDurability = 0;
      let avgRecyclability = 0;
      const ecoScoreCounts = { A: 0, B: 0, C: 0, D: 0 };

      for (const p of products.items) {
        if (p.tradeInEligible) tradeInEligible++;
        avgDurability += p.durabilityRating || 0;
        avgRecyclability += p.recyclabilityPercent || 0;
        if (p.ecoScore && ecoScoreCounts[p.ecoScore] !== undefined) {
          ecoScoreCounts[p.ecoScore]++;
        }
      }

      if (totalProducts > 0) {
        avgDurability = Math.round((avgDurability / totalProducts) * 10) / 10;
        avgRecyclability = Math.round((avgRecyclability / totalProducts) * 10) / 10;
      }

      // Count trade-in requests by status
      const pendingCount = await wixData.query(TRADEIN_COLLECTION)
        .eq('status', 'pending')
        .count();

      const approvedCount = await wixData.query(TRADEIN_COLLECTION)
        .eq('status', 'approved')
        .count();

      const completedCount = await wixData.query(TRADEIN_COLLECTION)
        .eq('status', 'completed')
        .count();

      return {
        success: true,
        stats: {
          totalProducts,
          tradeInEligible,
          avgDurability,
          avgRecyclability,
          ecoScoreCounts,
          tradeIns: {
            pending: pendingCount,
            approved: approvedCount,
            completed: completedCount,
          },
        },
      };
    } catch (err) {
      console.error('getSustainabilityStats error:', err);
      return { success: false, error: 'Unable to load sustainability stats' };
    }
  }
);
