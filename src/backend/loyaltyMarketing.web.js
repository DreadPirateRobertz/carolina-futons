/**
 * @module loyaltyMarketing
 * @description Loyalty program marketing: tier-up notifications, monthly points
 * statements, enrollment prompts, and tier explainer data.
 *
 * CF-a2o4
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';
import { logAuditEvent } from 'backend/utils/auditLog';
import { logError } from 'backend/utils/errorHandler';

const TIER_THRESHOLDS = {
  Bronze: { minSpend: 0, next: 'Silver', nextMin: 500 },
  Silver: { minSpend: 500, next: 'Gold', nextMin: 1500 },
  Gold: { minSpend: 1500, next: null, nextMin: null },
};

const TIER_BENEFITS = {
  Bronze: {
    discount: '0%',
    freeShipping: '$150+',
    earlyAccess: false,
    pointsMultiplier: '1x',
    birthdayBonus: '50 pts',
  },
  Silver: {
    discount: '5%',
    freeShipping: '$100+',
    earlyAccess: false,
    pointsMultiplier: '1.5x',
    birthdayBonus: '100 pts',
  },
  Gold: {
    discount: '10%',
    freeShipping: '$50+',
    earlyAccess: true,
    pointsMultiplier: '2x',
    birthdayBonus: '200 pts',
  },
};

const TIER_UP_THRESHOLD_PERCENT = 0.8; // Alert at 80% of next tier

/**
 * Get tier explainer data for the /loyalty page.
 * Returns tier comparison table data with benefits and thresholds.
 *
 * @returns {Promise<{success: boolean, tiers: Array}>}
 * @permission Anyone
 */
export const getTierExplainerData = webMethod(
  Permissions.Anyone,
  async () => {
    const tiers = Object.entries(TIER_BENEFITS).map(([name, benefits]) => ({
      name,
      minSpend: TIER_THRESHOLDS[name].minSpend,
      nextTier: TIER_THRESHOLDS[name].next,
      nextTierMinSpend: TIER_THRESHOLDS[name].nextMin,
      ...benefits,
    }));

    return { success: true, tiers };
  }
);

/**
 * Get enrollment prompt data for Thank You page.
 * Returns Bronze tier benefits and enrollment CTA for first-time purchasers.
 *
 * @param {string} memberEmail
 * @returns {Promise<{success: boolean, shouldPrompt: boolean, benefits: Object|null}>}
 * @permission Anyone
 */
export const getEnrollmentPrompt = webMethod(
  Permissions.Anyone,
  async (memberEmail) => {
    try {
      if (!memberEmail) return { success: true, shouldPrompt: false, benefits: null };

      const cleanEmail = sanitize(memberEmail, 254).toLowerCase();

      // Check if already enrolled
      const existing = await wixData.query('LoyaltyAccounts')
        .eq('email', cleanEmail)
        .find();

      if (existing.items.length > 0) {
        return { success: true, shouldPrompt: false, benefits: null };
      }

      return {
        success: true,
        shouldPrompt: true,
        benefits: {
          tier: 'Bronze',
          welcomePoints: 50,
          ...TIER_BENEFITS.Bronze,
          nextTier: 'Silver',
          nextTierSpend: TIER_THRESHOLDS.Bronze.nextMin,
        },
      };
    } catch (err) {
      console.error('[loyaltyMarketing] getEnrollmentPrompt error:', err);
      return { success: false, shouldPrompt: false, benefits: null };
    }
  }
);

/**
 * Check all loyalty members for tier-up proximity and queue notification emails.
 * Triggers at 80% of next tier threshold.
 *
 * @returns {Promise<{success: boolean, notified: number}>}
 * @permission Admin
 */
export const checkTierUpNotifications = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await wixData.query('LoyaltyAccounts')
        .ne('currentTier', 'Gold') // Gold members can't tier up
        .limit(1000)
        .find();

      let notified = 0;

      for (const account of result.items) {
        const tier = account.currentTier || 'Bronze';
        const tierInfo = TIER_THRESHOLDS[tier];
        if (!tierInfo || !tierInfo.next) continue;

        const totalSpend = account.totalSpend || 0;
        const thresholdForAlert = tierInfo.nextMin * TIER_UP_THRESHOLD_PERCENT;

        if (totalSpend >= thresholdForAlert && totalSpend < tierInfo.nextMin) {
          // Check if already notified for this tier transition
          const alreadyNotified = await wixData.query('EmailQueue')
            .eq('recipientEmail', account.email)
            .eq('templateId', 'tier_up_notification')
            .eq('checkoutId', tierInfo.next) // reuse checkoutId for tier name dedup
            .find();

          if (alreadyNotified.items.length > 0) continue;

          const remaining = tierInfo.nextMin - totalSpend;
          const nextBenefits = TIER_BENEFITS[tierInfo.next];

          await wixData.insert('EmailQueue', {
            templateId: 'tier_up_notification',
            recipientEmail: account.email,
            recipientContactId: account.memberId || '',
            variables: JSON.stringify({
              firstName: account.firstName || '',
              currentTier: tier,
              nextTier: tierInfo.next,
              remainingSpend: remaining.toFixed(2),
              nextDiscount: nextBenefits.discount,
              nextFreeShipping: nextBenefits.freeShipping,
              email: account.email,
            }),
            sequenceType: 'loyalty_marketing',
            sequenceStep: 1,
            scheduledFor: new Date(),
            status: 'pending',
            createdAt: new Date(),
            checkoutId: tierInfo.next,
          });

          notified++;
        }
      }

      logAuditEvent('LoyaltyMarketing', 'tier_up_check', 'system', {
        checked: result.items.length,
        notified,
      });

      return { success: true, notified };
    } catch (err) {
      console.error('[loyaltyMarketing] checkTierUpNotifications error:', err);
      return { success: false, notified: 0 };
    }
  }
);

/**
 * Generate monthly points statement for a member.
 *
 * @param {string} memberId
 * @returns {Promise<{success: boolean, statement: Object|null}>}
 * @permission Admin
 */
export const generateMonthlyStatement = webMethod(
  Permissions.Admin,
  async (memberId) => {
    try {
      if (!memberId) return { success: false, statement: null };
      const cleanId = sanitize(memberId, 50);

      // Get account
      const accounts = await wixData.query('LoyaltyAccounts')
        .eq('memberId', cleanId)
        .find();

      if (accounts.items.length === 0) {
        return { success: false, statement: null };
      }

      const account = accounts.items[0];
      const tier = account.currentTier || 'Bronze';
      const tierInfo = TIER_THRESHOLDS[tier];

      // Get points activity from last 30 days
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const activity = await wixData.query('PointsHistory')
        .eq('memberId', cleanId)
        .ge('timestamp', since)
        .limit(1000)
        .find();

      let earned = 0;
      let redeemed = 0;
      const breakdown = {};

      for (const entry of activity.items) {
        const amount = entry.points || 0;
        if (amount > 0) {
          earned += amount;
          const source = entry.source || 'other';
          breakdown[source] = (breakdown[source] || 0) + amount;
        } else {
          redeemed += Math.abs(amount);
        }
      }

      const statement = {
        memberId: cleanId,
        email: account.email,
        firstName: account.firstName || '',
        currentTier: tier,
        totalPoints: account.totalPoints || 0,
        monthlyEarned: earned,
        monthlyRedeemed: redeemed,
        netChange: earned - redeemed,
        breakdown: Object.entries(breakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([source, points]) => ({ source, points })),
        nextTier: tierInfo.next,
        nextTierSpend: tierInfo.nextMin,
        currentSpend: account.totalSpend || 0,
        spendToNextTier: tierInfo.next
          ? Math.max(0, tierInfo.nextMin - (account.totalSpend || 0))
          : null,
        generatedAt: new Date().toISOString(),
      };

      return { success: true, statement };
    } catch (err) {
      console.error('[loyaltyMarketing] generateMonthlyStatement error:', err);
      return { success: false, statement: null };
    }
  }
);

// ── Points Calculator ────────────────────────────────────────────────

/**
 * Calculate points earned, resulting tier, and benefits for a given spend amount.
 * Used by the /loyalty page "Points Calculator" widget.
 *
 * @param {number} spendAmount - Dollar amount to calculate
 * @returns {{success: boolean, result: Object}}
 * @permission Anyone
 * CF-h3li
 */
export const calculatePointsFromSpend = webMethod(
  Permissions.Anyone,
  (spendAmount) => {
    const spend = typeof spendAmount === 'number' ? Math.max(0, spendAmount) : 0;

    // Base rate: 1 point per dollar (Bronze), 1.5x (Silver), 2x (Gold)
    let tier = 'Bronze';
    let multiplier = 1;
    if (spend >= TIER_THRESHOLDS.Gold.minSpend) {
      tier = 'Gold';
      multiplier = 2;
    } else if (spend >= TIER_THRESHOLDS.Silver.minSpend) {
      tier = 'Silver';
      multiplier = 1.5;
    }

    const basePoints = Math.round(spend);
    const bonusPoints = Math.round(spend * (multiplier - 1));
    const totalPoints = basePoints + bonusPoints;

    const tierInfo = TIER_THRESHOLDS[tier];
    const nextTier = tierInfo.next;
    const spendToNextTier = nextTier ? Math.max(0, tierInfo.nextMin - spend) : null;

    return {
      success: true,
      result: {
        spend,
        tier,
        multiplier: `${multiplier}x`,
        basePoints,
        bonusPoints,
        totalPoints,
        benefits: TIER_BENEFITS[tier],
        nextTier,
        spendToNextTier,
      },
    };
  }
);

// ── Loyalty FAQ ─────────────────────────────────────────────────────

/**
 * Get FAQ data for the /loyalty page.
 *
 * @returns {{success: boolean, faqs: Array}}
 * @permission Anyone
 * CF-h3li
 */
export const getLoyaltyFaq = webMethod(
  Permissions.Anyone,
  () => {
    return {
      success: true,
      faqs: [
        {
          question: 'How do I earn points?',
          answer: 'Earn 1 point per $1 spent at Bronze tier. Silver members earn 1.5x and Gold members earn 2x points on every purchase. You also earn points for writing reviews (50 pts), sharing referrals (100 pts), and completing daily quests.',
        },
        {
          question: 'How do I move up tiers?',
          answer: 'Tiers are based on total spending. Spend $500+ to reach Silver, $1,500+ for Gold. Your tier is evaluated after each purchase and never decreases.',
        },
        {
          question: 'What can I redeem points for?',
          answer: 'Points can be redeemed in our Rewards Store for discounts, free accessories, exclusive products, and free shipping upgrades. 100 points = $1 in store credit.',
        },
        {
          question: 'Do my points expire?',
          answer: 'Points remain active as long as you make at least one purchase per year. After 12 months of inactivity, points may expire.',
        },
        {
          question: 'What is the birthday bonus?',
          answer: 'All members receive bonus points on their birthday: Bronze gets 50 pts, Silver gets 100 pts, and Gold gets 200 pts. Make sure your birthday is in your profile!',
        },
        {
          question: 'Can I earn points on sale items?',
          answer: 'Yes! You earn points on every purchase, including sale items, bundles, and clearance. The only exception is gift card purchases.',
        },
        {
          question: 'How does the referral program work?',
          answer: 'Share your referral link with friends. When they make their first purchase, you earn 100 points and they get a discount. Gold members earn 150 referral points.',
        },
      ],
    };
  }
);

// ── Enrollment (CF-nru7) ────────────────────────────────────────────

const WELCOME_POINTS = 50;
const BIRTHDAY_BONUS_POINTS = 50;
const POINTS_PER_DOLLAR = 1;

/**
 * Parse and validate a birthday from a YYYY-MM-DD string.
 * Returns { month, day } or null if invalid.
 * Cross-validates day against month using Date overflow detection.
 * @param {string} birthday - YYYY-MM-DD
 * @returns {{ month: number, day: number } | null}
 */
function _parseBirthday(birthday) {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const [, m, d] = birthday.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Detect calendar overflow (e.g. Feb 30): year 2000 = leap year so Feb 29 passes
  if (new Date(2000, m - 1, d).getMonth() !== m - 1) return null;
  return { month: m, day: d };
}

/**
 * Enroll a new member in the loyalty program.
 *
 * @param {Object} params
 * @param {string} params.memberId
 * @param {string} params.email
 * @param {string} [params.firstName]
 * @param {string} [params.birthday] - YYYY-MM-DD (optional, +50 bonus pts)
 * @returns {Promise<{success: boolean, welcomePoints: number, account: Object|null}>}
 * @permission SiteMember
 */
export const enrollMember = webMethod(
  Permissions.SiteMember,
  async (params = {}) => {
    try {
      const memberId = sanitize(params.memberId, 50);
      const email = sanitize(params.email, 254).toLowerCase();
      if (!memberId || !email) {
        return { success: false, welcomePoints: 0, account: null, error: 'Member ID and email required' };
      }

      // Check if already enrolled
      const existing = await wixData.query('LoyaltyAccounts')
        .eq('memberId', memberId)
        .find();

      if (existing.items.length > 0) {
        return { success: false, welcomePoints: 0, account: existing.items[0], error: 'Already enrolled' };
      }

      const bday = _parseBirthday(params.birthday);
      const totalWelcome = WELCOME_POINTS + (bday ? BIRTHDAY_BONUS_POINTS : 0);

      const account = await wixData.insert('LoyaltyAccounts', {
        memberId,
        email,
        firstName: sanitize(params.firstName || '', 200),
        birthday: bday ? params.birthday : null,
        currentTier: 'Bronze',
        totalPoints: totalWelcome,
        totalSpend: 0,
        enrolledAt: new Date(),
      });

      // Log points: balance already in LoyaltyAccounts — PointsHistory is the audit trail
      await wixData.insert('PointsHistory', {
        memberId,
        points: WELCOME_POINTS,
        source: 'welcome',
        description: 'Welcome bonus',
        timestamp: new Date(),
      });

      if (bday) {
        await wixData.insert('PointsHistory', {
          memberId,
          points: BIRTHDAY_BONUS_POINTS,
          source: 'birthday_enrollment',
          description: 'Birthday bonus for sharing DOB',
          timestamp: new Date(),
        });

        // Also write to MemberProfiles so annual checkBirthdayReward fires correctly
        const profileResult = await wixData.query('MemberProfiles')
          .eq('memberId', memberId)
          .limit(1)
          .find();
        const existingProfile = profileResult.items[0];
        if (existingProfile) {
          if (existingProfile.birthdayMonth == null) {
            await wixData.update('MemberProfiles', { ...existingProfile, birthdayMonth: bday.month, birthdayDay: bday.day });
          }
        } else {
          await wixData.insert('MemberProfiles', { memberId, birthdayMonth: bday.month, birthdayDay: bday.day });
        }
      }

      logAuditEvent('LoyaltyAccounts', 'enroll', memberId, { email, welcomePoints: totalWelcome });

      return { success: true, welcomePoints: totalWelcome, account };
    } catch (err) {
      console.error('[loyaltyMarketing] enrollMember error:', err);
      return { success: false, welcomePoints: 0, account: null, error: 'Enrollment failed' };
    }
  }
);

/**
 * Calculate points a member would earn for an order total.
 *
 * @param {number} orderTotal
 * @param {string} [currentTier='Bronze']
 * @returns {{points: number, multiplier: string, tier: string}}
 * @permission Anyone
 */
export const calculatePointsForOrder = webMethod(
  Permissions.Anyone,
  (orderTotal, currentTier) => {
    const total = typeof orderTotal === 'number' ? Math.max(0, orderTotal) : 0;
    const tier = currentTier || 'Bronze';
    const multipliers = { Bronze: 1, Silver: 1.5, Gold: 2 };
    const mult = multipliers[tier] || 1;

    const points = Math.round(total * POINTS_PER_DOLLAR * mult);
    return { points, multiplier: `${mult}x`, tier };
  }
);

// ── Birthday capture (CF-c5z6) ───────────────────────────────────────────────

/**
 * Save a member's birthday and award the one-time 50-point enrollment bonus.
 *
 * Writes birthdayMonth/birthdayDay to MemberProfiles so the annual birthday
 * reward (checkBirthdayReward in loyaltyBonusPoints.web.js) can fire.
 * Idempotent: points are only awarded once (guarded by PointsHistory source).
 *
 * @param {string} memberId
 * @param {number} month - 1–12
 * @param {number} day   - 1–31
 * @returns {Promise<{success: boolean, pointsAwarded: number, message?: string, reason?: string}>}
 * @permission SiteMember
 */
export const saveBirthday = webMethod(
  Permissions.SiteMember,
  async (month, day) => {
    try {
      const member = await currentMember.getMember();
      const mid = member?._id;
      const m = parseInt(month, 10);
      const d = parseInt(day, 10);
      if (!mid) return { success: false, reason: 'invalid_member' };
      if (!Number.isInteger(m) || m < 1 || m > 12) return { success: false, reason: 'invalid_month' };
      if (!Number.isInteger(d) || d < 1 || d > 31) return { success: false, reason: 'invalid_day' };
      // Cross-field calendar validation (year 2000 = leap year so Feb 29 is valid)
      if (new Date(2000, m - 1, d).getMonth() !== m - 1) return { success: false, reason: 'invalid_day' };

      // Check if birthday already on file — check BEFORE any writes
      const profileResult = await wixData.query('MemberProfiles')
        .eq('memberId', mid)
        .limit(1)
        .find();
      const existingProfile = profileResult.items[0];
      if (existingProfile?.birthdayMonth != null) {
        return { success: false, reason: 'already_set' };
      }

      // Fetch loyalty account and idempotency guard before any writes
      const accountResult = await wixData.query('LoyaltyAccounts')
        .eq('memberId', mid)
        .limit(1)
        .find();
      const account = accountResult.items[0];

      let alreadyAwarded = false;
      if (account) {
        const priorAward = await wixData.query('PointsHistory')
          .eq('memberId', mid)
          .eq('source', 'birthday_enrollment')
          .limit(1)
          .find();
        alreadyAwarded = priorAward.items.length > 0;
      }

      // Upsert MemberProfiles
      if (existingProfile) {
        await wixData.update('MemberProfiles', { ...existingProfile, birthdayMonth: m, birthdayDay: d });
      } else {
        await wixData.insert('MemberProfiles', { memberId: mid, birthdayMonth: m, birthdayDay: d });
      }

      if (!account) {
        return { success: true, pointsAwarded: 0, message: 'Birthday saved' };
      }
      if (alreadyAwarded) {
        return { success: true, pointsAwarded: 0, message: 'Birthday saved (points already credited)' };
      }

      // Award points: update balance first, then append audit trail
      // (if PointsHistory insert fails, balance is updated but no audit entry — retryable)
      await wixData.update('LoyaltyAccounts', {
        ...account,
        totalPoints: (account.totalPoints || 0) + BIRTHDAY_BONUS_POINTS,
      });
      await wixData.insert('PointsHistory', {
        memberId: mid,
        points: BIRTHDAY_BONUS_POINTS,
        source: 'birthday_enrollment',
        description: 'Birthday bonus for sharing DOB',
        timestamp: new Date(),
      });
      logAuditEvent('LoyaltyAccounts', 'birthday_bonus', mid, { pointsAwarded: BIRTHDAY_BONUS_POINTS });

      return { success: true, pointsAwarded: BIRTHDAY_BONUS_POINTS, message: 'Birthday saved! 50 bonus points added' };
    } catch (err) {
      logError(`[loyaltyMarketing] saveBirthday — member: ${mid}`, err);
      return { success: false, reason: 'error' };
    }
  }
);

/**
 * Check whether a member has a birthday on file in MemberProfiles.
 * Used by initBirthdayCapture to avoid showing the prompt unnecessarily.
 *
 * @returns {Promise<{hasBirthday: boolean}>}
 * @permission SiteMember
 */
export const getBirthdayStatus = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      const mid = member?._id;
      if (!mid) return { hasBirthday: false };
      const result = await wixData.query('MemberProfiles')
        .eq('memberId', mid)
        .limit(1)
        .find();
      const profile = result.items[0];
      return { hasBirthday: profile?.birthdayMonth != null };
    } catch {
      return { hasBirthday: false };
    }
  }
);

// Exports for testing
export const _TIER_THRESHOLDS = TIER_THRESHOLDS;
export const _TIER_BENEFITS = TIER_BENEFITS;
export const _TIER_UP_THRESHOLD_PERCENT = TIER_UP_THRESHOLD_PERCENT;
