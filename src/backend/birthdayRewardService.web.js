/**
 * @module birthdayRewardService
 * @description Daily cron handlers for birthday, purchase-anniversary, and join-anniversary rewards.
 * Birthday: runs daily, queries all members, awards those within ±3 days of birthday (7-day window)
 *   using isBirthdayWindow(). Deduplicates via BirthdayRewards CMS so reward fires once per year.
 * Purchase Anniversary: checks 1-year and 2-year purchase anniversaries via getAnniversaryYear().
 * Join Anniversary: 1yr/3yr/5yr join milestones with tier-specific coupons/emails.
 * Coupon creation: 1yr join → createTierUpgradeCoupon(email, 'Silver') → 10%,
 *                  3yr join → createBirthdayCoupon(email, name) → 15%,
 *                  5yr join → createTierUpgradeCoupon(email, 'Gold') → 20%.
 *
 * CMS collections:
 * - MemberProfiles (read) — member birthday/joinDate/firstPurchaseDate/contactId data
 * - BirthdayRewards (read/write) — dedup ledger (memberId + rewardType + year)
 *
 * CF-p6v2
 *
 * @requires wix-web-module
 * @requires wix-crm-backend
 * @requires wix-data
 * @requires backend/couponsService.web
 * @requires backend/utils/errorHandler
 * @requires backend/utils/dateUtils
 */
import { webMethod, Permissions } from 'wix-web-module';
import { triggeredEmails } from 'wix-crm-backend';
import wixData from 'wix-data';
import { createBirthdayCoupon, createTierUpgradeCoupon } from 'backend/couponsService.web';
import { logError } from 'backend/utils/errorHandler';
import { isBirthdayWindow, getAnniversaryYear, getTodayET } from 'backend/utils/dateUtils';

// tier maps to createTierUpgradeCoupon newTier arg; null means use createBirthdayCoupon (15%)
const PURCHASE_ANNIVERSARY_MILESTONES = {
  1: { rewardType: 'purchase_anniversary_1yr', discountPercent: 10, emailTemplate: 'purchase_anniversary_1yr', tier: 'Silver' },
  2: { rewardType: 'purchase_anniversary_2yr', discountPercent: 15, emailTemplate: 'purchase_anniversary_2yr', tier: null },
};

const ANNIVERSARY_MILESTONES = {
  // tier maps to createTierUpgradeCoupon newTier arg; null means use createBirthdayCoupon (15%)
  1: { rewardType: 'anniversary_1yr', discountPercent: 10, emailTemplate: 'anniversary_1yr', tier: 'Silver' },
  3: { rewardType: 'anniversary_3yr', discountPercent: 15, emailTemplate: 'anniversary_3yr', tier: null },
  5: { rewardType: 'anniversary_5yr', discountPercent: 20, emailTemplate: 'anniversary_5yr', vipBadge: true, tier: 'Gold' },
};

async function isAlreadySent(memberId, rewardType, year) {
  const result = await wixData
    .query('BirthdayRewards')
    .eq('memberId', memberId)
    .eq('rewardType', rewardType)
    .eq('year', year)
    .limit(1)
    .find();
  return result.items.length > 0;
}

/**
 * Process a single member's reward: dedup check, coupon creation, email, dedup insert.
 *
 * @param {object} profile - MemberProfiles CMS record
 * @param {object} config - Reward configuration
 * @param {string} config.callerTag - Log prefix for error context
 * @param {string} config.rewardType - Dedup key (e.g. 'birthday', 'anniversary_1yr')
 * @param {number} config.year - Current year for dedup
 * @param {Function} config.createCoupon - Async coupon factory, returns { success, code }
 * @param {string} config.emailTemplate - Triggered email template ID
 * @param {object} config.emailVariables - Extra variables to merge into email (beyond couponCode)
 * @param {object} [config.extraDedupFields] - Extra fields to store in dedup record
 * @returns {Promise<'sent'|'skipped'|'failed'>}
 */
async function processRewardForMember(profile, config) {
  const { callerTag, rewardType, year, createCoupon, emailTemplate, emailVariables, extraDedupFields } = config;

  try {
    const already = await isAlreadySent(profile.memberId, rewardType, year);
    if (already) return 'skipped';
  } catch (e) {
    logError(`${callerTag}.isAlreadySent`, e);
    return 'failed';
  }

  let couponResult;
  try {
    couponResult = await createCoupon();
  } catch (e) {
    logError(`${callerTag}.createCoupon`, e);
    return 'failed';
  }
  if (!couponResult.success) {
    logError(`${callerTag}.createCoupon`, couponResult.message || 'Coupon creation failed', { silent: true });
    return 'failed';
  }

  try {
    const variables = { couponCode: couponResult.code, ...emailVariables };
    await triggeredEmails.emailContact(emailTemplate, profile.contactId, { variables });
  } catch (e) {
    logError(`${callerTag}.email`, e);
    return 'failed';
  }

  try {
    await wixData.insert('BirthdayRewards', {
      memberId: profile.memberId,
      rewardType,
      year,
      ...extraDedupFields,
    });
  } catch (e) {
    // Email was sent but dedup failed — member may receive duplicate reward on next cron run.
    logError(`${callerTag}.dedupInsert`, e, { memberId: profile.memberId, rewardType, year });
  }

  return 'sent';
}

/**
 * Runs processRewardForMember for each profile and tallies results.
 *
 * @param {Array} profiles - MemberProfiles items to process
 * @param {Function} configForProfile - Returns reward config for a profile, or null to skip
 * @returns {Promise<{sent: number, skipped: number, failed: number}>}
 */
async function processProfiles(profiles, configForProfile) {
  let sent = 0, skipped = 0, failed = 0;

  for (const profile of profiles) {
    const config = configForProfile(profile);
    if (!config) continue;

    const outcome = await processRewardForMember(profile, config);
    if (outcome === 'sent') sent++;
    else if (outcome === 'skipped') skipped++;
    else failed++;
  }

  return { sent, skipped, failed };
}

/**
 * Check and send birthday rewards for members within ±3 days of their birthday (7-day window).
 * Intended to run daily via Wix scheduled job.
 * Deduplication via BirthdayRewards ensures each member is rewarded once per calendar year
 * even though this runs every day of the 7-day window.
 *
 * @returns {Promise<{sent: number, skipped: number, failed: number}>}
 */
export const checkAndSendBirthdayRewards = webMethod(
  Permissions.Admin,
  async () => {
    const todayET = getTodayET();
    const year = Number(todayET.slice(0, 4));

    let profilesResult;
    try {
      profilesResult = await wixData
        .query('MemberProfiles')
        .isNotEmpty('birthdayMonth')
        .isNotEmpty('birthdayDay')
        .limit(1000)
        .find();
    } catch (e) {
      logError('birthdayRewardService.checkAndSendBirthdayRewards.queryProfiles', e);
      return { sent: 0, skipped: 0, failed: 0 };
    }

    const windowProfiles = profilesResult.items.filter((profile) => {
      if (!profile.birthdayMonth || !profile.birthdayDay) return false;
      const mm = String(profile.birthdayMonth).padStart(2, '0');
      const dd = String(profile.birthdayDay).padStart(2, '0');
      return isBirthdayWindow(`${mm}-${dd}`, todayET);
    });

    return processProfiles(windowProfiles, (profile) => ({
      callerTag: 'birthdayRewardService.checkAndSendBirthdayRewards',
      rewardType: 'birthday',
      year,
      createCoupon: () => createBirthdayCoupon(profile.email, profile.memberName),
      emailTemplate: 'birthday_reward',
      emailVariables: {},
    }));
  }
);

/**
 * Check and send anniversary rewards for members at 1yr, 3yr, or 5yr join milestones.
 * Intended to run daily via Wix scheduled job.
 *
 * @returns {Promise<{sent: number, skipped: number, failed: number}>}
 */
export const checkAndSendAnniversaryRewards = webMethod(
  Permissions.Admin,
  async () => {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    const year = today.getFullYear();

    let profilesResult;
    try {
      profilesResult = await wixData.query('MemberProfiles').limit(1000).find();
    } catch (e) {
      logError('birthdayRewardService.checkAndSendAnniversaryRewards.queryProfiles', e);
      return { sent: 0, skipped: 0, failed: 0 };
    }

    return processProfiles(profilesResult.items, (profile) => {
      const joinDate = new Date(profile.joinDate);
      if (joinDate.getMonth() + 1 !== todayMonth || joinDate.getDate() !== todayDay) return null;

      const yearsElapsed = year - joinDate.getFullYear();
      const milestone = ANNIVERSARY_MILESTONES[yearsElapsed];
      if (!milestone) return null;

      return {
        callerTag: 'birthdayRewardService.checkAndSendAnniversaryRewards',
        rewardType: milestone.rewardType,
        year,
        createCoupon: milestone.tier
          ? () => createTierUpgradeCoupon(profile.email, milestone.tier)
          : () => createBirthdayCoupon(profile.email, profile.memberName), // 3yr: no tier maps to 15%
        emailTemplate: milestone.emailTemplate,
        emailVariables: milestone.vipBadge ? { vipBadge: true } : {},
        extraDedupFields: { discountPercent: milestone.discountPercent },
      };
    });
  }
);

/**
 * Check and send purchase anniversary rewards for members at 1yr and 2yr
 * since their first purchase. Intended to run daily via Wix scheduled job.
 * Uses getAnniversaryYear() so Feb 29 first-purchases are treated as Feb 28
 * in non-leap anniversary years. Deduplicates via BirthdayRewards CMS.
 *
 * @returns {Promise<{sent: number, skipped: number, failed: number}>}
 */
export const checkAndSendPurchaseAnniversaryRewards = webMethod(
  Permissions.Admin,
  async () => {
    const todayET = getTodayET();
    const year = Number(todayET.slice(0, 4));

    let profilesResult;
    try {
      profilesResult = await wixData
        .query('MemberProfiles')
        .isNotEmpty('firstPurchaseDate')
        .limit(1000)
        .find();
    } catch (e) {
      logError('birthdayRewardService.checkAndSendPurchaseAnniversaryRewards.queryProfiles', e);
      return { sent: 0, skipped: 0, failed: 0 };
    }

    return processProfiles(profilesResult.items, (profile) => {
      const anniversaryYear = getAnniversaryYear(profile.firstPurchaseDate, todayET);
      const milestone = PURCHASE_ANNIVERSARY_MILESTONES[anniversaryYear];
      if (!milestone) return null;

      return {
        callerTag: 'birthdayRewardService.checkAndSendPurchaseAnniversaryRewards',
        rewardType: milestone.rewardType,
        year,
        createCoupon: milestone.tier
          ? () => createTierUpgradeCoupon(profile.email, milestone.tier)
          : () => createBirthdayCoupon(profile.email, profile.memberName),
        emailTemplate: milestone.emailTemplate,
        emailVariables: {},
        extraDedupFields: { discountPercent: milestone.discountPercent },
      };
    });
  }
);
