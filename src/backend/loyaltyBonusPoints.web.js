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
import { validateId } from 'backend/utils/sanitize';
import crypto from 'crypto';

/** Point values for each bonus activity. */
export const BONUS_POINTS = {
  REVIEW: 50,
  PHOTO_REVIEW: 100,
  REFERRAL_COMPLETE: 200,
  ACCOUNT_CREATION: 25,
  BIRTHDAY: 100,
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
    pointsPerDollar: 1,
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
      console.error(`[loyaltyBonusPoints] FAILED — account: ${accountId}, activity: ${activityType}, error:`, err);
      return { success: false, message: 'Failed to award bonus points' };
    }
  }
);
