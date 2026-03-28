/**
 * @module birthdayRewardService
<<<<<<< HEAD
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
=======
 * @description Daily cron triggers for birthday and join-anniversary reward emails.
 * Queries eligible members, creates personalized coupons, sends reward emails,
 * and records rewards to prevent same-year duplicates.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * CMS collection "BirthdayRewards":
 * - memberId (Text) — member who received the reward
 * - email (Text) — member email at time of reward
 * - memberName (Text) — display name at time of reward
 * - couponCode (Text) — issued coupon code
 * - type (Text) — 'birthday' | 'anniversary'
 * - rewardYear (Number) — calendar year, used for same-year dedup
 * - milestone (Number) — anniversary year milestone (1, 3, 5) or 0 for birthday
 * - _createdDate (DateTime) — auto
 *
 * Member data source: Members/PrivateMembersData
 * - birthday (Date) — member's date of birth
 * - _createdDate (DateTime) — join date (for anniversary calculation)
 * - loginEmail (Text) — contact email
 * - firstName (Text), lastName (Text)
 *
 * CF-28jp: Birthday + anniversary milestone reward trigger
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

const BIRTHDAY_REWARDS_COLLECTION = 'BirthdayRewards';
const MEMBERS_COLLECTION = 'Members/PrivateMembersData';

// Anniversary milestone tiers: [years, couponPercent, tierUpgrade]
const ANNIVERSARY_MILESTONES = [
  { years: 1, percent: 10, badge: null },
  { years: 3, percent: 15, badge: null },
  { years: 5, percent: 20, badge: 'vip_for_a_day' },
];

// ── helpers ────────────────────────────────────────────────────────

/**
 * Get today as { month, day, year } in local time (no timezone shift).
 * @param {Date} [now] - Injectable for tests
 * @returns {{ month: number, day: number, year: number }}
 */
export function getTodayParts(now = new Date()) {
  return {
    month: now.getUTCMonth() + 1, // 1-based
    day: now.getUTCDate(),
    year: now.getUTCFullYear(),
  };
}

/**
 * Whether a date falls on the given month+day (ignoring year).
 * @param {Date|string} date
 * @param {number} month - 1-based
 * @param {number} day
 * @returns {boolean}
 */
export function isAnniversaryToday(date, month, day) {
  if (!date) return false;
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  return (d.getUTCMonth() + 1) === month && d.getUTCDate() === day;
}

/**
 * Calculate how many full years have elapsed since joinDate relative to now.
 * @param {Date|string} joinDate
 * @param {Date} [now]
 * @returns {number}
 */
export function yearsElapsed(joinDate, now = new Date()) {
  if (!joinDate) return 0;
  const d = new Date(joinDate);
  if (isNaN(d.getTime())) return 0;
  const years = now.getUTCFullYear() - d.getUTCFullYear();
  // Adjust if today is before the anniversary day in this year
  const passedAnniversaryThisYear =
    now.getUTCMonth() > d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() >= d.getUTCDate());
  return passedAnniversaryThisYear ? years : years - 1;
}

/**
 * Whether a BirthdayRewards record already exists for this member + type + year.
 * @param {string} memberId
 * @param {'birthday'|'anniversary'} type
 * @param {number} year
 * @returns {Promise<boolean>}
 */
async function alreadyRewarded(memberId, type, year) {
  const result = await wixData.query(BIRTHDAY_REWARDS_COLLECTION)
    .eq('memberId', memberId)
    .eq('type', type)
    .eq('rewardYear', year)
>>>>>>> origin/cf-28jp-birthday-anniversary-rewards
    .find();
  return result.items.length > 0;
}

/**
<<<<<<< HEAD
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
      /* c8 ignore next -- wix-data isNotEmpty() pre-filters nulls; guard is for production safety */
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
=======
 * Record that a reward was sent to prevent duplicates.
 * @param {Object} params
 */
async function recordReward({ memberId, email, memberName, couponCode, type, rewardYear, milestone }) {
  await wixData.insert(BIRTHDAY_REWARDS_COLLECTION, {
    memberId,
    email,
    memberName,
    couponCode,
    type,
    rewardYear,
    milestone: milestone || 0,
  });
}

// ── checkAndSendBirthdayRewards ────────────────────────────────────

/**
 * Daily cron: find members whose birthday is today and send them a reward.
 * Idempotent — members already rewarded this year are skipped.
 *
 * @param {Object} [opts] - Injectable overrides for testing
 * @param {Date} [opts.now] - Override current date
 * @param {Function} [opts.createCoupon] - Override coupon creation (email, name) => {success, code}
 * @param {Function} [opts.sendEmail] - Override email sending (email, name, couponCode) => void
 * @returns {Promise<{sent: number, skipped: number, errors: number}>}
 */
export const checkAndSendBirthdayRewards = webMethod(
  Permissions.Admin,
  async (opts = {}) => {
    const now = opts.now || new Date();
    const { month, day, year } = getTodayParts(now);

    const createCoupon = opts.createCoupon || _defaultCreateBirthdayCoupon;
    const sendEmail = opts.sendEmail || _defaultSendBirthdayEmail;

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Query members whose birthday month+day matches today
      const result = await wixData.query(MEMBERS_COLLECTION)
        .eq('birthday_month', month)
        .eq('birthday_day', day)
        .find();

      for (const member of result.items) {
        try {
          const memberId = member._id;
          const email = (member.loginEmail || '').toLowerCase().trim();
          const memberName = sanitize(member.firstName || member.name || 'Friend', 100);

          if (!email || !memberId) { skipped++; continue; }

          // Idempotency: skip if already rewarded this year
          if (await alreadyRewarded(memberId, 'birthday', year)) {
            skipped++;
            continue;
          }

          const couponResult = await createCoupon(email, memberName);
          if (!couponResult.success) {
            console.warn('[birthdayRewardService] Birthday coupon creation failed for', email, ':', couponResult.message);
            errors++;
            continue;
          }

          await sendEmail(email, memberName, couponResult.code);
          await recordReward({ memberId, email, memberName, couponCode: couponResult.code, type: 'birthday', rewardYear: year, milestone: 0 });
          sent++;
        } catch (memberErr) {
          console.error('[birthdayRewardService] Error processing birthday for member', member._id, ':', memberErr?.message ?? memberErr);
          errors++;
        }
      }
    } catch (err) {
      console.error('[birthdayRewardService] checkAndSendBirthdayRewards failed:', err?.message ?? err);
      return { sent, skipped, errors: errors + 1 };
    }

    return { sent, skipped, errors };
  }
);

// ── checkAndSendAnniversaryRewards ────────────────────────────────

/**
 * Daily cron: find members whose join anniversary hits a milestone today (1yr, 3yr, 5yr).
 * Idempotent — members already rewarded for this milestone year are skipped.
 *
 * @param {Object} [opts] - Injectable overrides for testing
 * @param {Date} [opts.now] - Override current date
 * @param {Function} [opts.createCoupon] - Override coupon creation (email, name, percent) => {success, code}
 * @param {Function} [opts.sendEmail] - Override email sending (email, name, couponCode, milestone) => void
 * @returns {Promise<{sent: number, skipped: number, errors: number}>}
 */
export const checkAndSendAnniversaryRewards = webMethod(
  Permissions.Admin,
  async (opts = {}) => {
    const now = opts.now || new Date();
    const { month, day, year } = getTodayParts(now);

    const createCoupon = opts.createCoupon || _defaultCreateAnniversaryCoupon;
    const sendEmail = opts.sendEmail || _defaultSendAnniversaryEmail;

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Query members whose join anniversary month+day matches today
      const result = await wixData.query(MEMBERS_COLLECTION)
        .eq('join_month', month)
        .eq('join_day', day)
        .find();

      for (const member of result.items) {
        try {
          const memberId = member._id;
          const email = (member.loginEmail || '').toLowerCase().trim();
          const memberName = sanitize(member.firstName || member.name || 'Friend', 100);
          const joinDate = member._createdDate;

          if (!email || !memberId || !joinDate) { skipped++; continue; }

          const years = yearsElapsed(joinDate, now);
          const milestone = ANNIVERSARY_MILESTONES.find(m => m.years === years);

          // Only send on milestone years (1, 3, 5)
          if (!milestone) { skipped++; continue; }

          // Idempotency: skip if already rewarded for this milestone this year
          if (await alreadyRewarded(memberId, 'anniversary', year)) {
            skipped++;
            continue;
          }

          const couponResult = await createCoupon(email, memberName, milestone.percent);
          if (!couponResult.success) {
            console.warn('[birthdayRewardService] Anniversary coupon creation failed for', email, ':', couponResult.message);
            errors++;
            continue;
          }

          await sendEmail(email, memberName, couponResult.code, milestone.years, milestone.badge);
          await recordReward({ memberId, email, memberName, couponCode: couponResult.code, type: 'anniversary', rewardYear: year, milestone: milestone.years });
          sent++;
        } catch (memberErr) {
          console.error('[birthdayRewardService] Error processing anniversary for member', member._id, ':', memberErr?.message ?? memberErr);
          errors++;
        }
      }
    } catch (err) {
      console.error('[birthdayRewardService] checkAndSendAnniversaryRewards failed:', err?.message ?? err);
      return { sent, skipped, errors: errors + 1 };
    }

    return { sent, skipped, errors };
  }
);

// ── Default implementations (dynamically imported to stay testable) ─

async function _defaultCreateBirthdayCoupon(email, memberName) {
  try {
    const { createBirthdayCoupon } = await import('backend/couponsService.web');
    return await createBirthdayCoupon(email, memberName);
  } catch (err) {
    console.error('[birthdayRewardService] createBirthdayCoupon import failed:', err?.message ?? err);
    return { success: false, message: 'coupon service unavailable' };
  }
}

async function _defaultCreateAnniversaryCoupon(email, memberName, percent) {
  try {
    const { createDiscountCoupon } = await import('backend/couponsService.web');
    return await createDiscountCoupon(email, memberName, percent, `anniversary_${percent}pct`);
  } catch (err) {
    console.error('[birthdayRewardService] createAnniversaryCoupon import failed:', err?.message ?? err);
    return { success: false, message: 'coupon service unavailable' };
  }
}

async function _defaultSendBirthdayEmail(email, memberName, couponCode) {
  try {
    const { triggerWelcomeSequence } = await import('backend/emailAutomation.web');
    await triggerWelcomeSequence({ email, name: memberName, source: 'birthday_reward', couponCode });
  } catch (err) {
    console.warn('[birthdayRewardService] Birthday email send failed for', email, ':', err?.message ?? err);
  }
}

async function _defaultSendAnniversaryEmail(email, memberName, couponCode, milestoneYears, badge) {
  try {
    const { triggerWelcomeSequence } = await import('backend/emailAutomation.web');
    await triggerWelcomeSequence({ email, name: memberName, source: `anniversary_${milestoneYears}yr`, couponCode, badge });
  } catch (err) {
    console.warn('[birthdayRewardService] Anniversary email send failed for', email, ':', err?.message ?? err);
  }
}
>>>>>>> origin/cf-28jp-birthday-anniversary-rewards
