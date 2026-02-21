/**
 * @module referralService
 * @description Two-sided referral tracking system. Members can generate
 * referral links, track referrals, and earn credits when their referrals
 * make a purchase. Both referrer and referee receive credit.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection "Referrals" with fields:
 * - referrerMemberId (Text) - The member who shared the referral
 * - referrerEmail (Text) - Referrer's email
 * - referrerName (Text) - Referrer's display name
 * - referralCode (Text) - Unique referral code
 * - refereeName (Text) - Who was referred
 * - refereeEmail (Text) - Referee's email
 * - refereeMemberId (Text) - Referee's member ID (after signup)
 * - status (Text) - "pending" | "signed_up" | "purchased" | "credited" | "expired"
 * - referrerCredit (Number) - Credit amount for referrer
 * - refereeCredit (Number) - Credit amount for referee
 * - orderNumber (Text) - The qualifying order
 * - _createdDate (DateTime) - Auto
 *
 * Create CMS collection "ReferralCredits" with fields:
 * - memberId (Text) - Member who owns the credit
 * - amount (Number) - Credit amount
 * - source (Text) - "referrer_bonus" | "referee_bonus"
 * - referralId (Text) - Reference to Referrals collection
 * - status (Text) - "available" | "applied" | "expired"
 * - expiresAt (DateTime) - When the credit expires
 * - _createdDate (DateTime) - Auto
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const REFERRALS_COLLECTION = 'Referrals';
const CREDITS_COLLECTION = 'ReferralCredits';
const REFERRER_CREDIT_AMOUNT = 50;  // $50 credit for referrer
const REFEREE_CREDIT_AMOUNT = 25;   // $25 credit for referee
const CREDIT_EXPIRY_DAYS = 90;
const REFERRAL_CODE_LENGTH = 8;

// ── generateReferralCode ────────────────────────────────────────────

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0/O, 1/I/L)
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ── getReferralLink ─────────────────────────────────────────────────

export const getReferralLink = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in to get a referral link' };
      }

      // Check for existing referral code
      const existing = await wixData.query(REFERRALS_COLLECTION)
        .eq('referrerMemberId', member._id)
        .eq('status', 'pending')
        .descending('_createdDate')
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        return {
          success: true,
          referralCode: existing.items[0].referralCode,
          alreadyExists: true,
        };
      }

      // Generate new unique code
      let code = generateCode();
      let attempts = 0;
      while (attempts < 5) {
        const conflict = await wixData.query(REFERRALS_COLLECTION)
          .eq('referralCode', code)
          .find();
        if (conflict.items.length === 0) break;
        code = generateCode();
        attempts++;
      }

      // Create pending referral record
      const record = await wixData.insert(REFERRALS_COLLECTION, {
        referrerMemberId: member._id,
        referrerEmail: member.loginEmail || '',
        referrerName: member.name || member.firstName || '',
        referralCode: code,
        refereeName: '',
        refereeEmail: '',
        refereeMemberId: '',
        status: 'pending',
        referrerCredit: REFERRER_CREDIT_AMOUNT,
        refereeCredit: REFEREE_CREDIT_AMOUNT,
        orderNumber: '',
      });

      return {
        success: true,
        referralCode: code,
        alreadyExists: false,
      };
    } catch (err) {
      console.error('getReferralLink error:', err);
      return { success: false, error: 'Unable to generate referral link' };
    }
  }
);

// ── redeemReferralCode ──────────────────────────────────────────────

export const redeemReferralCode = webMethod(
  Permissions.Anyone,
  async (code, refereeData = {}) => {
    try {
      const cleanCode = sanitize(code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!cleanCode) {
        return { success: false, error: 'Referral code is required' };
      }

      const { name, email } = refereeData;
      const cleanEmail = (email || '').trim().toLowerCase();

      if (cleanEmail && !validateEmail(cleanEmail)) {
        return { success: false, error: 'Please provide a valid email address' };
      }

      // Find the referral
      const result = await wixData.query(REFERRALS_COLLECTION)
        .eq('referralCode', cleanCode)
        .eq('status', 'pending')
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Invalid or expired referral code' };
      }

      const referral = result.items[0];

      // Prevent self-referral
      if (cleanEmail && cleanEmail === (referral.referrerEmail || '').toLowerCase()) {
        return { success: false, error: 'You cannot use your own referral code' };
      }

      // Update the referral with referee info
      referral.refereeName = sanitize(name, 100) || '';
      referral.refereeEmail = cleanEmail;
      referral.status = 'signed_up';

      await wixData.update(REFERRALS_COLLECTION, referral);

      return {
        success: true,
        referrerName: referral.referrerName,
        refereeDiscount: REFEREE_CREDIT_AMOUNT,
        message: `You've been referred by ${referral.referrerName || 'a friend'}! You'll receive a $${REFEREE_CREDIT_AMOUNT} credit on your first purchase.`,
      };
    } catch (err) {
      console.error('redeemReferralCode error:', err);
      return { success: false, error: 'Unable to redeem referral code' };
    }
  }
);

// ── completeReferral ────────────────────────────────────────────────

export const completeReferral = webMethod(
  Permissions.SiteMember,
  async (referralCode, orderNumber) => {
    try {
      const cleanCode = sanitize(referralCode, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanOrder = sanitize(orderNumber, 50);

      if (!cleanCode || !cleanOrder) {
        return { success: false, error: 'Referral code and order number required' };
      }

      // Find the signed-up referral
      const result = await wixData.query(REFERRALS_COLLECTION)
        .eq('referralCode', cleanCode)
        .eq('status', 'signed_up')
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Referral not found or not eligible' };
      }

      const referral = result.items[0];

      // Get referee member ID
      const member = await currentMember.getMember();
      if (member?._id) {
        referral.refereeMemberId = member._id;
      }

      // Mark as purchased
      referral.status = 'purchased';
      referral.orderNumber = cleanOrder;
      await wixData.update(REFERRALS_COLLECTION, referral);

      // Issue credits
      const expiresAt = new Date(Date.now() + CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      // Credit for referrer
      await wixData.insert(CREDITS_COLLECTION, {
        memberId: referral.referrerMemberId,
        amount: REFERRER_CREDIT_AMOUNT,
        source: 'referrer_bonus',
        referralId: referral._id,
        status: 'available',
        expiresAt,
      });

      // Credit for referee
      if (member?._id) {
        await wixData.insert(CREDITS_COLLECTION, {
          memberId: member._id,
          amount: REFEREE_CREDIT_AMOUNT,
          source: 'referee_bonus',
          referralId: referral._id,
          status: 'available',
          expiresAt,
        });
      }

      // Update status to credited
      referral.status = 'credited';
      await wixData.update(REFERRALS_COLLECTION, referral);

      return {
        success: true,
        referrerCredit: REFERRER_CREDIT_AMOUNT,
        refereeCredit: REFEREE_CREDIT_AMOUNT,
      };
    } catch (err) {
      console.error('completeReferral error:', err);
      return { success: false, error: 'Unable to process referral credit' };
    }
  }
);

// ── getMyReferrals ──────────────────────────────────────────────────

export const getMyReferrals = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const referrals = await wixData.query(REFERRALS_COLLECTION)
        .eq('referrerMemberId', member._id)
        .descending('_createdDate')
        .limit(50)
        .find();

      return {
        success: true,
        referrals: referrals.items.map(r => ({
          code: r.referralCode,
          refereeName: r.refereeName || '',
          refereeEmail: r.refereeEmail || '',
          status: r.status,
          credit: r.referrerCredit,
          orderNumber: r.orderNumber || '',
          createdDate: r._createdDate,
        })),
        totalCount: referrals.totalCount,
      };
    } catch (err) {
      console.error('getMyReferrals error:', err);
      return { success: false, error: 'Unable to load referrals' };
    }
  }
);

// ── getMyCredits ────────────────────────────────────────────────────

export const getMyCredits = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const credits = await wixData.query(CREDITS_COLLECTION)
        .eq('memberId', member._id)
        .eq('status', 'available')
        .find();

      const totalAvailable = credits.items.reduce((sum, c) => sum + (c.amount || 0), 0);

      return {
        success: true,
        totalAvailable,
        credits: credits.items.map(c => ({
          amount: c.amount,
          source: c.source,
          status: c.status,
          expiresAt: c.expiresAt,
          createdDate: c._createdDate,
        })),
      };
    } catch (err) {
      console.error('getMyCredits error:', err);
      return { success: false, error: 'Unable to load credits' };
    }
  }
);

// ── applyCredit ─────────────────────────────────────────────────────

export const applyCredit = webMethod(
  Permissions.SiteMember,
  async (creditId) => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      const cleanId = sanitize(creditId, 50);
      if (!cleanId) {
        return { success: false, error: 'Credit ID required' };
      }

      const credit = await wixData.get(CREDITS_COLLECTION, cleanId);
      if (!credit) {
        return { success: false, error: 'Credit not found' };
      }

      if (credit.memberId !== member._id) {
        return { success: false, error: 'Credit does not belong to you' };
      }

      if (credit.status !== 'available') {
        return { success: false, error: 'Credit is not available' };
      }

      // Check expiry
      if (credit.expiresAt && new Date(credit.expiresAt) < new Date()) {
        credit.status = 'expired';
        await wixData.update(CREDITS_COLLECTION, credit);
        return { success: false, error: 'Credit has expired' };
      }

      credit.status = 'applied';
      await wixData.update(CREDITS_COLLECTION, credit);

      return {
        success: true,
        amount: credit.amount,
        message: `$${credit.amount} credit applied to your order!`,
      };
    } catch (err) {
      console.error('applyCredit error:', err);
      return { success: false, error: 'Unable to apply credit' };
    }
  }
);

// ── getReferralStats ────────────────────────────────────────────────

export const getReferralStats = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member || !member._id) {
        return { success: false, error: 'You must be logged in' };
      }

      // Count referrals by status
      const all = await wixData.query(REFERRALS_COLLECTION)
        .eq('referrerMemberId', member._id)
        .find();

      const pending = all.items.filter(r => r.status === 'pending').length;
      const signedUp = all.items.filter(r => r.status === 'signed_up').length;
      const purchased = all.items.filter(r => r.status === 'purchased' || r.status === 'credited').length;

      // Get total credits earned
      const credits = await wixData.query(CREDITS_COLLECTION)
        .eq('memberId', member._id)
        .find();

      const totalEarned = credits.items.reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalAvailable = credits.items
        .filter(c => c.status === 'available')
        .reduce((sum, c) => sum + (c.amount || 0), 0);
      const totalApplied = credits.items
        .filter(c => c.status === 'applied')
        .reduce((sum, c) => sum + (c.amount || 0), 0);

      return {
        success: true,
        stats: {
          totalReferrals: all.items.length,
          pendingReferrals: pending,
          signedUpReferrals: signedUp,
          completedReferrals: purchased,
          totalEarned,
          totalAvailable,
          totalApplied,
        },
      };
    } catch (err) {
      console.error('getReferralStats error:', err);
      return { success: false, error: 'Unable to load stats' };
    }
  }
);
