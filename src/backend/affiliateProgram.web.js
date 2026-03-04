/**
 * @module affiliateProgram
 * @description Affiliate/influencer program for Carolina Futons. Enables members
 * to apply as affiliates, generate unique tracking links, earn commissions on
 * referred sales, and manage payouts. Supports tiered commission rates
 * (Starter 5%, Pro 8%, Elite 12%) with automatic tier progression.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection "AffiliateAccounts" with fields:
 * - memberId (Text) - Wix member ID
 * - displayName (Text) - Affiliate's display name
 * - email (Text) - Contact email
 * - tier (Text) - "starter" | "pro" | "elite"
 * - status (Text) - "pending" | "active" | "suspended" | "rejected"
 * - commissionRate (Number) - Current commission percentage
 * - totalEarned (Number) - Lifetime commission earnings
 * - totalPaid (Number) - Total amount paid out
 * - paypalEmail (Text) - PayPal payment email
 * - bio (Text) - Affiliate bio/description
 * - socialLinks (Text) - Social media profile URLs
 * - _createdDate (DateTime) - Auto
 *
 * Create CMS collection "AffiliateLinks" with fields:
 * - affiliateId (Text) - Reference to AffiliateAccounts
 * - memberId (Text) - Wix member ID
 * - productId (Text) - Target product ID or "_store" for general
 * - linkCode (Text) - Unique 10-char tracking code
 * - customSlug (Text) - Optional custom URL slug
 * - clicks (Number) - Total click count
 * - conversions (Number) - Completed purchase count
 * - revenue (Number) - Total revenue generated
 * - _createdDate (DateTime) - Auto
 *
 * Create CMS collection "AffiliateCommissions" with fields:
 * - affiliateId (Text) - Reference to AffiliateAccounts
 * - memberId (Text) - Wix member ID
 * - linkId (Text) - Reference to AffiliateLinks
 * - orderId (Text) - Wix order ID
 * - orderTotal (Number) - Order total amount
 * - commissionRate (Number) - Rate applied
 * - commissionAmount (Number) - Commission earned
 * - status (Text) - "pending" | "approved" | "paid" | "cancelled"
 * - _createdDate (DateTime) - Auto
 *
 * Create CMS collection "AffiliatePayouts" with fields:
 * - affiliateId (Text) - Reference to AffiliateAccounts
 * - memberId (Text) - Wix member ID
 * - amount (Number) - Payout amount
 * - status (Text) - "requested" | "processing" | "paid" | "failed"
 * - paymentMethod (Text) - "paypal"
 * - paymentEmail (Text) - Payment destination
 * - processedDate (DateTime) - When payout was processed
 * - _createdDate (DateTime) - Auto
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const ACCOUNTS_COLLECTION = 'AffiliateAccounts';
const LINKS_COLLECTION = 'AffiliateLinks';
const COMMISSIONS_COLLECTION = 'AffiliateCommissions';
const PAYOUTS_COLLECTION = 'AffiliatePayouts';

const LINK_CODE_LENGTH = 10;
const MIN_PAYOUT_AMOUNT = 25;

const TIERS = {
  starter: { rate: 5, label: 'Starter' },
  pro: { rate: 8, label: 'Pro', salesThreshold: 500, conversionThreshold: 20 },
  elite: { rate: 12, label: 'Elite', salesThreshold: 2000, conversionThreshold: 50 },
};

// ── Helpers ─────────────────────────────────────────────────────────

function generateLinkCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function getAffiliateByMemberId(memberId) {
  const result = await wixData.query(ACCOUNTS_COLLECTION)
    .eq('memberId', memberId)
    .limit(1)
    .find();
  return result.items.length > 0 ? result.items[0] : null;
}

function calculateTier(totalRevenue, totalConversions) {
  if (totalRevenue >= TIERS.elite.salesThreshold || totalConversions >= TIERS.elite.conversionThreshold) {
    return 'elite';
  }
  if (totalRevenue >= TIERS.pro.salesThreshold || totalConversions >= TIERS.pro.conversionThreshold) {
    return 'pro';
  }
  return 'starter';
}

// ── applyForAffiliate ───────────────────────────────────────────────

/**
 * Apply to become an affiliate. Creates a pending account for admin review.
 * @param {Object} applicationData - Application details
 * @param {string} applicationData.bio - Bio/description (required)
 * @param {string} [applicationData.socialLinks] - Social media URLs
 * @returns {Promise<{success: boolean, affiliateId?: string, error?: string}>}
 */
export const applyForAffiliate = webMethod(
  Permissions.SiteMember,
  async (applicationData = {}) => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in to apply' };
      }

      const bio = sanitize(applicationData.bio, 500);
      if (!bio) {
        return { success: false, error: 'A bio is required to apply for the affiliate program' };
      }

      const socialLinks = sanitize(applicationData.socialLinks, 500);

      // Check for existing account (allow reapplication after rejection)
      const existing = await getAffiliateByMemberId(member._id);
      if (existing && existing.status !== 'rejected') {
        return { success: false, error: 'You already have an affiliate account' };
      }

      // If rejected, update existing record instead of creating new
      if (existing && existing.status === 'rejected') {
        existing.bio = bio;
        existing.socialLinks = socialLinks;
        existing.status = 'pending';
        existing.displayName = member.name || member.firstName || '';
        existing.email = member.loginEmail || '';
        await wixData.update(ACCOUNTS_COLLECTION, existing);
        return { success: true, affiliateId: existing._id };
      }

      const record = await wixData.insert(ACCOUNTS_COLLECTION, {
        memberId: member._id,
        displayName: member.name || member.firstName || '',
        email: member.loginEmail || '',
        tier: 'starter',
        status: 'pending',
        commissionRate: TIERS.starter.rate,
        totalEarned: 0,
        totalPaid: 0,
        paypalEmail: '',
        bio,
        socialLinks,
      });

      return { success: true, affiliateId: record._id };
    } catch (err) {
      console.error('applyForAffiliate error:', err);
      return { success: false, error: 'Unable to submit affiliate application' };
    }
  }
);

// ── getMyAffiliateAccount ───────────────────────────────────────────

/**
 * Get the current member's affiliate account details.
 * @returns {Promise<{success: boolean, account?: Object, error?: string}>}
 */
export const getMyAffiliateAccount = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const account = await getAffiliateByMemberId(member._id);
      if (!account) {
        return { success: false, error: 'Affiliate account not found' };
      }

      return {
        success: true,
        account: {
          id: account._id,
          displayName: account.displayName,
          email: account.email,
          tier: account.tier,
          status: account.status,
          commissionRate: account.commissionRate,
          totalEarned: account.totalEarned,
          totalPaid: account.totalPaid,
          availableBalance: (account.totalEarned || 0) - (account.totalPaid || 0),
          bio: account.bio,
          socialLinks: account.socialLinks,
          paypalEmail: account.paypalEmail,
          createdDate: account._createdDate,
        },
      };
    } catch (err) {
      console.error('getMyAffiliateAccount error:', err);
      return { success: false, error: 'Unable to load affiliate account' };
    }
  }
);

// ── createAffiliateLink ─────────────────────────────────────────────

/**
 * Create a unique affiliate tracking link for a product or the store.
 * @param {string} productId - Product ID or "_store" for general store link
 * @param {string} [customSlug] - Optional custom URL slug
 * @returns {Promise<{success: boolean, linkCode?: string, error?: string}>}
 */
export const createAffiliateLink = webMethod(
  Permissions.SiteMember,
  async (productId, customSlug) => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const cleanProductId = sanitize(productId, 100);
      if (!cleanProductId) {
        return { success: false, error: 'Product ID is required' };
      }

      const account = await getAffiliateByMemberId(member._id);
      if (!account || account.status !== 'active') {
        return { success: false, error: 'You must have an active affiliate account' };
      }

      // Check custom slug uniqueness
      const cleanSlug = customSlug ? sanitize(customSlug, 100).toLowerCase().replace(/[^a-z0-9-]/g, '') : '';
      if (cleanSlug) {
        const slugConflict = await wixData.query(LINKS_COLLECTION)
          .eq('customSlug', cleanSlug)
          .find();
        if (slugConflict.items.length > 0) {
          return { success: false, error: 'Custom slug is already in use' };
        }
      }

      // Generate unique link code
      let linkCode = generateLinkCode();
      let attempts = 0;
      while (attempts < 5) {
        const conflict = await wixData.query(LINKS_COLLECTION)
          .eq('linkCode', linkCode)
          .find();
        if (conflict.items.length === 0) break;
        linkCode = generateLinkCode();
        attempts++;
      }

      const record = await wixData.insert(LINKS_COLLECTION, {
        affiliateId: account._id,
        memberId: member._id,
        productId: cleanProductId,
        linkCode,
        customSlug: cleanSlug,
        clicks: 0,
        conversions: 0,
        revenue: 0,
      });

      return { success: true, linkCode, linkId: record._id };
    } catch (err) {
      console.error('createAffiliateLink error:', err);
      return { success: false, error: 'Unable to create affiliate link' };
    }
  }
);

// ── getMyAffiliateLinks ─────────────────────────────────────────────

/**
 * Get all tracking links for the current affiliate.
 * @returns {Promise<{success: boolean, links?: Array, error?: string}>}
 */
export const getMyAffiliateLinks = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const links = await wixData.query(LINKS_COLLECTION)
        .eq('memberId', member._id)
        .descending('_createdDate')
        .limit(100)
        .find();

      return {
        success: true,
        links: links.items.map(l => ({
          id: l._id,
          productId: l.productId,
          linkCode: l.linkCode,
          customSlug: l.customSlug || '',
          clicks: l.clicks || 0,
          conversions: l.conversions || 0,
          revenue: l.revenue || 0,
          createdDate: l._createdDate,
        })),
      };
    } catch (err) {
      console.error('getMyAffiliateLinks error:', err);
      return { success: false, error: 'Unable to load affiliate links' };
    }
  }
);

// ── trackAffiliateClick ─────────────────────────────────────────────

/**
 * Track a click on an affiliate link. Public endpoint for landing pages.
 * @param {string} linkCode - The affiliate link code
 * @returns {Promise<{success: boolean, productId?: string, error?: string}>}
 */
export const trackAffiliateClick = webMethod(
  Permissions.Anyone,
  async (linkCode) => {
    try {
      const cleanCode = sanitize(linkCode, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!cleanCode) {
        return { success: false, error: 'Link code is required' };
      }

      const result = await wixData.query(LINKS_COLLECTION)
        .eq('linkCode', cleanCode)
        .limit(1)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Affiliate link not found' };
      }

      const link = result.items[0];
      link.clicks = (link.clicks || 0) + 1;
      await wixData.update(LINKS_COLLECTION, link);

      return {
        success: true,
        productId: link.productId,
        linkCode: link.linkCode,
      };
    } catch (err) {
      console.error('trackAffiliateClick error:', err);
      return { success: false, error: 'Unable to track click' };
    }
  }
);

// ── recordAffiliateConversion ───────────────────────────────────────

/**
 * Record a conversion (purchase) for an affiliate link. Called after order completion.
 * @param {string} linkCode - The affiliate link code
 * @param {string} orderId - The Wix order ID
 * @param {number} orderTotal - The order total amount
 * @returns {Promise<{success: boolean, commissionAmount?: number, error?: string}>}
 */
export const recordAffiliateConversion = webMethod(
  Permissions.Admin,
  async (linkCode, orderId, orderTotal) => {
    try {
      const cleanCode = sanitize(linkCode, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanOrderId = sanitize(orderId, 50);

      if (!cleanCode || !cleanOrderId) {
        return { success: false, error: 'Link code and order ID are required' };
      }

      if (!orderTotal || orderTotal <= 0) {
        return { success: false, error: 'A positive order total is required' };
      }

      // Find the affiliate link
      const linkResult = await wixData.query(LINKS_COLLECTION)
        .eq('linkCode', cleanCode)
        .limit(1)
        .find();

      if (linkResult.items.length === 0) {
        return { success: false, error: 'Affiliate link not found' };
      }

      const link = linkResult.items[0];

      // Verify affiliate is active
      const account = await wixData.get(ACCOUNTS_COLLECTION, link.affiliateId);
      if (!account || account.status !== 'active') {
        return { success: false, error: 'Affiliate account is not active' };
      }

      // Check for duplicate conversion
      const existingConversion = await wixData.query(COMMISSIONS_COLLECTION)
        .eq('affiliateId', link.affiliateId)
        .eq('orderId', cleanOrderId)
        .find();

      if (existingConversion.items.length > 0) {
        return { success: false, error: 'Conversion already recorded for this order' };
      }

      // Calculate commission
      const commissionAmount = Math.round(orderTotal * (account.commissionRate / 100) * 100) / 100;

      // Create commission record
      await wixData.insert(COMMISSIONS_COLLECTION, {
        affiliateId: link.affiliateId,
        memberId: account.memberId,
        linkId: link._id,
        orderId: cleanOrderId,
        orderTotal,
        commissionRate: account.commissionRate,
        commissionAmount,
        status: 'pending',
      });

      // Update link stats
      link.conversions = (link.conversions || 0) + 1;
      link.revenue = (link.revenue || 0) + orderTotal;
      await wixData.update(LINKS_COLLECTION, link);

      // Update affiliate total earned
      account.totalEarned = (account.totalEarned || 0) + commissionAmount;
      await wixData.update(ACCOUNTS_COLLECTION, account);

      // Check for tier upgrade
      const allLinks = await wixData.query(LINKS_COLLECTION)
        .eq('affiliateId', account._id)
        .find();
      const totalRevenue = allLinks.items.reduce((sum, l) => sum + (l.revenue || 0), 0);
      const totalConversions = allLinks.items.reduce((sum, l) => sum + (l.conversions || 0), 0);
      const newTier = calculateTier(totalRevenue, totalConversions);

      if (newTier !== account.tier) {
        account.tier = newTier;
        account.commissionRate = TIERS[newTier].rate;
        await wixData.update(ACCOUNTS_COLLECTION, account);
      }

      return { success: true, commissionAmount };
    } catch (err) {
      console.error('recordAffiliateConversion error:', err);
      return { success: false, error: 'Unable to record conversion' };
    }
  }
);

// ── getMyCommissions ────────────────────────────────────────────────

/**
 * Get commission history for the current affiliate.
 * @returns {Promise<{success: boolean, commissions?: Array, error?: string}>}
 */
export const getMyCommissions = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const commissions = await wixData.query(COMMISSIONS_COLLECTION)
        .eq('memberId', member._id)
        .descending('_createdDate')
        .limit(100)
        .find();

      return {
        success: true,
        commissions: commissions.items.map(c => ({
          id: c._id,
          orderId: c.orderId,
          orderTotal: c.orderTotal,
          commissionRate: c.commissionRate,
          commissionAmount: c.commissionAmount,
          status: c.status,
          createdDate: c._createdDate,
        })),
      };
    } catch (err) {
      console.error('getMyCommissions error:', err);
      return { success: false, error: 'Unable to load commissions' };
    }
  }
);

// ── getAffiliateDashboard ───────────────────────────────────────────

/**
 * Get comprehensive dashboard stats for the current affiliate.
 * @returns {Promise<{success: boolean, dashboard?: Object, error?: string}>}
 */
export const getAffiliateDashboard = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const account = await getAffiliateByMemberId(member._id);
      if (!account) {
        return { success: false, error: 'Affiliate account not found' };
      }

      // Aggregate link stats
      const links = await wixData.query(LINKS_COLLECTION)
        .eq('memberId', member._id)
        .find();

      const totalClicks = links.items.reduce((sum, l) => sum + (l.clicks || 0), 0);
      const totalConversions = links.items.reduce((sum, l) => sum + (l.conversions || 0), 0);
      const totalRevenue = links.items.reduce((sum, l) => sum + (l.revenue || 0), 0);
      const conversionRate = totalClicks > 0
        ? Math.round((totalConversions / totalClicks) * 10000) / 100
        : 0;

      // Aggregate commission stats
      const commissions = await wixData.query(COMMISSIONS_COLLECTION)
        .eq('memberId', member._id)
        .find();

      const pendingCommissions = commissions.items
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
      const approvedCommissions = commissions.items
        .filter(c => c.status === 'approved')
        .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

      return {
        success: true,
        dashboard: {
          tier: account.tier,
          commissionRate: account.commissionRate,
          totalEarned: account.totalEarned || 0,
          totalPaid: account.totalPaid || 0,
          availableBalance: (account.totalEarned || 0) - (account.totalPaid || 0),
          totalClicks,
          totalConversions,
          totalRevenue,
          conversionRate,
          pendingCommissions,
          approvedCommissions,
          linkCount: links.items.length,
        },
      };
    } catch (err) {
      console.error('getAffiliateDashboard error:', err);
      return { success: false, error: 'Unable to load dashboard' };
    }
  }
);

// ── requestPayout ───────────────────────────────────────────────────

/**
 * Request a payout from available affiliate earnings.
 * @param {number} amount - Payout amount (minimum $25)
 * @returns {Promise<{success: boolean, payoutId?: string, error?: string}>}
 */
export const requestPayout = webMethod(
  Permissions.SiteMember,
  async (amount) => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      if (!amount || amount <= 0) {
        return { success: false, error: 'A positive payout amount is required' };
      }

      if (amount < MIN_PAYOUT_AMOUNT) {
        return { success: false, error: `Minimum payout is $${MIN_PAYOUT_AMOUNT}` };
      }

      const account = await getAffiliateByMemberId(member._id);
      if (!account || account.status !== 'active') {
        return { success: false, error: 'You must have an active affiliate account' };
      }

      if (!account.paypalEmail) {
        return { success: false, error: 'Please configure payment info before requesting a payout' };
      }

      const availableBalance = (account.totalEarned || 0) - (account.totalPaid || 0);
      if (amount > availableBalance) {
        return { success: false, error: 'Requested amount exceeds available balance' };
      }

      // Check for existing pending payout
      const pendingPayouts = await wixData.query(PAYOUTS_COLLECTION)
        .eq('affiliateId', account._id)
        .eq('status', 'requested')
        .find();

      if (pendingPayouts.items.length > 0) {
        return { success: false, error: 'You already have a pending payout request' };
      }

      const payout = await wixData.insert(PAYOUTS_COLLECTION, {
        affiliateId: account._id,
        memberId: member._id,
        amount,
        status: 'requested',
        paymentMethod: 'paypal',
        paymentEmail: account.paypalEmail,
      });

      return { success: true, payoutId: payout._id };
    } catch (err) {
      console.error('requestPayout error:', err);
      return { success: false, error: 'Unable to submit payout request' };
    }
  }
);

// ── getMyPayouts ────────────────────────────────────────────────────

/**
 * Get payout history for the current affiliate.
 * @returns {Promise<{success: boolean, payouts?: Array, error?: string}>}
 */
export const getMyPayouts = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const payouts = await wixData.query(PAYOUTS_COLLECTION)
        .eq('memberId', member._id)
        .descending('_createdDate')
        .limit(50)
        .find();

      return {
        success: true,
        payouts: payouts.items.map(p => ({
          id: p._id,
          amount: p.amount,
          status: p.status,
          paymentMethod: p.paymentMethod,
          processedDate: p.processedDate || null,
          createdDate: p._createdDate,
        })),
      };
    } catch (err) {
      console.error('getMyPayouts error:', err);
      return { success: false, error: 'Unable to load payouts' };
    }
  }
);

// ── updatePaymentInfo ───────────────────────────────────────────────

/**
 * Update payment information for the current affiliate.
 * @param {Object} paymentInfo - Payment details
 * @param {string} paymentInfo.paypalEmail - PayPal email address
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const updatePaymentInfo = webMethod(
  Permissions.SiteMember,
  async (paymentInfo = {}) => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const account = await getAffiliateByMemberId(member._id);
      if (!account) {
        return { success: false, error: 'Affiliate account not found' };
      }

      const cleanEmail = sanitize(paymentInfo.paypalEmail, 254).trim().toLowerCase();
      if (!cleanEmail || !validateEmail(cleanEmail)) {
        return { success: false, error: 'A valid PayPal email address is required' };
      }

      account.paypalEmail = cleanEmail;
      await wixData.update(ACCOUNTS_COLLECTION, account);

      return { success: true };
    } catch (err) {
      console.error('updatePaymentInfo error:', err);
      return { success: false, error: 'Unable to update payment info' };
    }
  }
);
