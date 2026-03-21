/**
 * @module birthdayRewardService
 * @description Daily cron handlers for birthday and anniversary milestone rewards.
 * Birthday: runs daily, queries members whose birthday month+day matches today,
 * calls createBirthdayCoupon(), sends birthday_reward email, deduplicates via BirthdayRewards CMS.
 * Anniversary: runs daily, queries all members (MemberProfiles has birthdayMonth/birthdayDay integers),
 * filters for 1yr/3yr/5yr join anniversaries, sends tier-specific email, deduplicates via BirthdayRewards CMS.
 * Coupon creation: 1yr → createTierUpgradeCoupon(email, 'Silver') → 10%,
 *                  3yr → createBirthdayCoupon(email, name) → 15% (no tier maps to 15%),
 *                  5yr → createTierUpgradeCoupon(email, 'Gold') → 20%.
 *
 * CMS collections:
 * - MemberProfiles (read) — member birthday/joinDate/contactId data
 * - BirthdayRewards (read/write) — dedup ledger (memberId + rewardType + year)
 *
 * @requires wix-web-module
 * @requires wix-crm-backend
 * @requires wix-data
 * @requires backend/couponsService.web
 * @requires backend/utils/errorHandler
 */
import { webMethod, Permissions } from 'wix-web-module';
import { triggeredEmails } from 'wix-crm-backend';
import wixData from 'wix-data';
import { createBirthdayCoupon, createTierUpgradeCoupon } from 'backend/couponsService.web';
import { logError } from 'backend/utils/errorHandler';

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
    // Email was sent but dedup failed — member may receive duplicate next run.
    logError(`${callerTag}.dedupInsert`, e);
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
 * Check and send birthday rewards for members whose birthday is today.
 * Intended to run daily via Wix scheduled job.
 *
 * @returns {Promise<{sent: number, skipped: number, failed: number}>}
 */
export const checkAndSendBirthdayRewards = webMethod(
  Permissions.Admin,
  async () => {
    const today = new Date();
    const year = today.getFullYear();

    let profilesResult;
    try {
      profilesResult = await wixData
        .query('MemberProfiles')
        .eq('birthdayMonth', today.getMonth() + 1)
        .eq('birthdayDay', today.getDate())
        .limit(1000)
        .find();
    } catch (e) {
      logError('birthdayRewardService.checkAndSendBirthdayRewards.queryProfiles', e);
      return { sent: 0, skipped: 0, failed: 0 };
    }

    return processProfiles(profilesResult.items, (profile) => ({
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
