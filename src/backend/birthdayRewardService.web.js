/**
 * @module birthdayRewardService
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
    .find();
  return result.items.length > 0;
}

/**
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
