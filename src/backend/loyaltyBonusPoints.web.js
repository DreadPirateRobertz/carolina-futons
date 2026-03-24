/**
 * @module loyaltyBonusPoints
 * @description Bonus point awards for non-purchase activities (reviews, referrals, etc.).
 * Extends the core loyaltyService with activity-based earning rules.
 *
 * @requires wix-web-module
 * @requires wix-loyalty.v2
 */
import { Permissions, webMethod } from 'wix-web-module';
import { accounts } from 'wix-loyalty.v2';
import wixData from 'wix-data';
import { validateId } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';
import { getTodayET, isBirthdayWindow, getAnniversaryYear } from 'backend/utils/dateUtils';
import crypto from 'crypto';

/** Point values for each bonus activity. */
export const BONUS_POINTS = {
  REVIEW: 100,
  PHOTO_REVIEW: 150,
  REFERRAL_COMPLETE: 500,
  ACCOUNT_CREATION: 50,
  BIRTHDAY: 200,
};

const ACTIVITY_MAP = {
  review: { points: BONUS_POINTS.REVIEW, description: 'Bonus: product review submitted' },
  photoReview: { points: BONUS_POINTS.PHOTO_REVIEW, description: 'Bonus: photo review submitted' },
  referralComplete: { points: BONUS_POINTS.REFERRAL_COMPLETE, description: 'Bonus: referral purchase completed' },
  accountCreation: { points: BONUS_POINTS.ACCOUNT_CREATION, description: 'Bonus: account creation welcome' },
  birthday: { points: BONUS_POINTS.BIRTHDAY, description: 'Bonus: birthday reward' },
};

/** Tier multipliers for display only — purchase-based multipliers are
 *  configured in the Wix Dashboard earning rules, not applied here. */
const TIER_MULTIPLIERS = {
  Bronze: 1,
  Silver: 1,
  Gold: 1.5,
  Platinum: 2,
};

const APP_ID = 'cf-loyalty-bonus';

/**
 * Get the earning configuration for display in the loyalty dashboard.
 *
 * @function getEarningConfig
 * @returns {Promise<Object>} Earning rules configuration
 * @permission Anyone — public info
 */
export const getEarningConfig = webMethod(
  Permissions.Anyone,
  async () => ({
    pointsPerDollar: 2,
    bonusPoints: {
      review: BONUS_POINTS.REVIEW,
      photoReview: BONUS_POINTS.PHOTO_REVIEW,
      referralComplete: BONUS_POINTS.REFERRAL_COMPLETE,
      accountCreation: BONUS_POINTS.ACCOUNT_CREATION,
      birthday: BONUS_POINTS.BIRTHDAY,
    },
    tierMultipliers: { ...TIER_MULTIPLIERS },
  })
);

/**
 * Award bonus points to a loyalty account for a non-purchase activity.
 *
 * @function awardBonusPoints
 * @param {string} accountId - The loyalty account ID
 * @param {string} activityType - One of: review, photoReview, referralComplete, accountCreation, birthday
 * @param {Object} [options] - Optional overrides
 * @param {number} [options.points] - Custom point amount (overrides default)
 * @returns {Promise<Object>} { success, pointsAwarded?, reason?, message? }
 * @permission Admin — only backend event handlers should call this
 */
export const awardBonusPoints = webMethod(
  Permissions.Admin,
  async (accountId, activityType, options = {}) => {
    try {
      if (!accountId) {
        return { success: false, message: 'Account ID is required' };
      }

      const cleanId = validateId(accountId);
      if (!cleanId) {
        return { success: false, message: 'Invalid account ID format' };
      }

      const activity = ACTIVITY_MAP[activityType];
      if (!activity) {
        const safe = String(activityType).slice(0, 50);
        return { success: false, message: `Unknown activity type: ${safe}` };
      }

      const pointsToAward = options.points ?? activity.points;
      if (typeof pointsToAward !== 'number' || pointsToAward <= 0) {
        return { success: false, message: 'Points must be a positive number' };
      }

      await accounts.earnPoints(cleanId, {
        points: pointsToAward,
        description: activity.description,
        appId: APP_ID,
        idempotencyKey: crypto.randomUUID(),
      });

      return {
        success: true,
        pointsAwarded: pointsToAward,
        reason: activityType,
      };
    } catch (err) {
      logError(`[loyaltyBonusPoints] FAILED — account: ${accountId}, activity: ${activityType}`, err);
      return { success: false, message: 'Failed to award bonus points' };
    }
  }
);

// ── Calendar rewards (CF-p6v2) ────────────────────────────────────────────────

export const ANNIVERSARY_POINTS = { 1: 150, 2: 250 };

/**
 * Award the 7-day birthday window reward (100 pts).
 * Fetches the member's birthday from MemberProfiles CMS — callers must not
 * pass birthday data directly to prevent injection of arbitrary dates.
 * Idempotent: uses memberId + year as the idempotency key so Wix deduplicates
 * even if called multiple times within the same calendar year.
 *
 * @param {string} accountId - Wix loyalty account ID
 * @param {string} memberId - Member ID; used to fetch birthday + build idempotency key
 * @returns {Promise<{success: boolean, pointsAwarded?: number, reason?: string}>}
 */
export const checkBirthdayReward = webMethod(
  Permissions.Admin,
  async (accountId, memberId) => {
    if (!accountId || !memberId) return { success: false, reason: 'missing_params' };

    // Fetch birthday from CMS — prevents callers from passing arbitrary dates
    let birthdayMMDD = null;
    try {
      const result = await wixData.query('MemberProfiles')
        .eq('memberId', memberId)
        .limit(1)
        .find({ suppressAuth: true });
      const profile = result.items[0];
      if (profile?.birthdayMonth != null && profile?.birthdayDay != null) {
        birthdayMMDD = `${String(profile.birthdayMonth).padStart(2, '0')}-${String(profile.birthdayDay).padStart(2, '0')}`;
      }
    } catch (err) {
      logError(`[loyaltyBonusPoints] checkBirthdayReward: profile fetch failed — member: ${memberId}`, err);
      return { success: false, reason: 'profile_fetch_failed' };
    }

    if (!birthdayMMDD) return { success: false, reason: 'no_birthday_on_file' };

    const todayET = getTodayET();
    if (!isBirthdayWindow(birthdayMMDD, todayET)) {
      return { success: false, reason: 'outside_window' };
    }

    const year = todayET.slice(0, 4);
    try {
      await accounts.earnPoints(accountId, {
        points: BONUS_POINTS.BIRTHDAY,
        description: 'Bonus: birthday week reward',
        appId: APP_ID,
        idempotencyKey: `${memberId}_birthday_${year}`,
      });
      return { success: true, pointsAwarded: BONUS_POINTS.BIRTHDAY };
    } catch (err) {
      logError(`[loyaltyBonusPoints] checkBirthdayReward failed — account: ${accountId}`, err);
      return { success: false, message: 'Failed to award birthday points' };
    }
  }
);

/**
 * Award the 1-year or 2-year purchase anniversary reward.
 * Only fires on the exact calendar-day anniversary.
 * Idempotent: memberId + anniversaryYear + year as the idempotency key.
 *
 * @param {string} accountId - Wix loyalty account ID
 * @param {string|null} firstPurchaseDateStr - "YYYY-MM-DD"
 * @param {string} memberId - Used to build the idempotency key
 * @returns {Promise<{success: boolean, anniversaryYear?: number, pointsAwarded?: number, reason?: string}>}
 */
export const checkAnniversaryReward = webMethod(
  Permissions.Admin,
  async (accountId, firstPurchaseDateStr, memberId) => {
  if (!accountId) return { success: false, reason: 'missing_params' };

  const todayET = getTodayET();
  const anniversaryYear = getAnniversaryYear(firstPurchaseDateStr, todayET);
  if (!anniversaryYear) return { success: false, reason: 'not_anniversary' };

  const pts = ANNIVERSARY_POINTS[anniversaryYear];
  const year = todayET.slice(0, 4);
  try {
    await accounts.earnPoints(accountId, {
      points: pts,
      description: `Bonus: ${anniversaryYear}-year purchase anniversary`,
      appId: APP_ID,
      idempotencyKey: `${memberId}_anniversary_${anniversaryYear}_${year}`,
    });
    return { success: true, anniversaryYear, pointsAwarded: pts };
  } catch (err) {
    logError(`[loyaltyBonusPoints] checkAnniversaryReward failed — account: ${accountId}`, err);
    return { success: false, message: 'Failed to award anniversary points' };
  }
});
