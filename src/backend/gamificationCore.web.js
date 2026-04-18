/**
 * @module gamificationCore.web
 * @description Core gamification engine — event processing, points, streaks, challenges,
 * leaderboard, tier system, and activity feed.
 * Awards points to members based on trackEvent calls and returns updated tier state.
 * After awarding points, checks BonusSpinGrants for active grants matching the event
 * and increments bonusSpinsAvailable on MemberPoints accordingly.
 *
 * Supported events:
 *   gamification_add_to_cart      — +5 pts
 *   gamification_submit_review    — +100 pts (+50 bonus if has_photo)
 *   gamification_referral_shared   — +100 pts (streak-multiplied)
 *   gamification_referral_accepted — +POINT_VALUES.REFERRAL_ACCEPTED (500 pts, streak-multiplied)
 *   gamification_order_complete    — +Math.floor(orderTotal) pts (streak-multiplied)
 *   gamification_ar_used          — +POINT_VALUES.AR_USED (10 pts)
 *   gamification_ar_discovery     — +POINT_VALUES.AR_TRY_ON (25 pts), first AR session only
 *   gamification_wishlist_add     — +POINT_VALUES.WISHLIST_ADD (25 pts), capped at 1/month
 *   gamification_spin_completed   — +0 pts (tracked for bonus-spin grant only)
 *   (unknown)                     — no-op, returns current total
 *
 * CF-eo88, CF-9l0
 *
 * Permission model (CF-cvez):
 *   Anyone:      getLeaderboard (public opt-in data), getActiveChallengeOfWeek
 *   SiteMember:  getStreakData, getMemberTier, getActivityFeed, getGamificationStats
 *   Member:      receiveGamificationEvent, getActiveChallenges, recordChallengeProgress, recoverStreak
 */

import { Permissions, webMethod } from 'wix-web-module';
import { POINT_VALUES, STREAK_RECOVERY_COST, getTierForPoints, getStreakMultiplier, TIER_NAMES } from 'public/gamificationTokens.js';
import { logError } from 'backend/utils/errorHandler';
import { getTodayET, getYesterdayOf, tsToETDate } from 'backend/utils/dateUtils';
import wixData from 'wix-data';
import { recordChallengeCompleteEvent } from 'backend/loyaltyService.web';
import { insertLedgerEntry } from 'backend/utils/memberPointsLedger';
import { insertAnalyticsEvent } from 'backend/utils/analyticsEvents';
import { dispatchBusEvent } from 'backend/utils/eventBusDispatcher';

export const MEMBER_POINTS_COLLECTION = 'MemberPoints';
// ── MemberPoints: two activity fields, do not conflate ──────────────────────
// lastActivityDate — ET *date string* ("2026-04-13"). Day-granularity,
//   timezone-bound. Read by streak engine, pointsExpiryService,
//   gamificationNotifs (streak danger), loyaltyService. NEVER compare to
//   lastActivityAt — different type AND different granularity.
// lastActivityAt   — UTC *Date*. Millisecond-granularity timestamp stamped
//   on every user-initiated MemberPoints write (cf-bvn). Read by
//   leaderboardService (tie-breaker) and re-engagement dormancy (cf-bpt).
//   Consumers must query with a Date value, never with an ET string.
// ──────────────────────────────────────────────────────────────────────────
export const MEMBER_BADGES_COLLECTION = 'MemberBadges';
const BONUS_SPIN_GRANTS_COLLECTION = 'BonusSpinGrants';
export const CHALLENGE_PROGRESS_COLLECTION = 'MemberChallengeProgress';
const WISHLIST_ADD_LOG_COLLECTION = 'WishlistAddLog';
const WISHLIST_MONTHLY_CAP = 1;
const CHALLENGES_COLLECTION = 'Challenges';

// ── getActiveChallenges rate limit (in-memory, per server instance) ───────────
// 10 calls/hr per member. Resets on server restart — acceptable for Wix serverless.
const _activeChallengesRateLimit = new Map(); // memberId → { count, windowStart }
const ACTIVE_CHALLENGES_RATE_LIMIT = 10;
const ACTIVE_CHALLENGES_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Exported for testing only.
export function _resetActiveChallengesRateLimit() {
  _activeChallengesRateLimit.clear();
}

// ── recordChallengeProgress rate limit (in-memory, per server instance) ───────
// 20 calls/hr per member.
const _recordChallengeProgressRateLimit = new Map();
const RECORD_CHALLENGE_PROGRESS_RATE_LIMIT = 20;
const RECORD_CHALLENGE_PROGRESS_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Exported for testing only.
export function _resetRecordChallengeProgressRateLimit() {
  _recordChallengeProgressRateLimit.clear();
}

// Point values not in POINT_VALUES (which covers review/AR/referral-accepted/etc.)
const ADD_TO_CART_POINTS = 5;
const REFERRAL_SHARED_POINTS = 100; // distinct from REFERRAL_ACCEPTED (200 pts for completed referrals)

// Events whose point awards are fixed and must NOT be multiplied by the streak multiplier.
// Birthday and anniversary bonuses are flat rewards — doubling them would be incorrect.
const FIXED_AWARD_EVENTS = new Set([
  'gamification_birthday_bonus',
  'gamification_anniversary_bonus',
  'video_review_approved', // 500 pts, not streak-multiplied — one-time exclusive award
]);

/**
 * Receive a gamification event and award points to the member.
 *
 * @param {string} eventName  - e.g. 'gamification_add_to_cart'
 * @param {Object} payload    - Event-specific data (product_id, has_photo, etc.)
 * @param {string} memberId   - Wix member ID
 * @returns {Promise<{success: boolean, newTotal?: number, tierChanged?: boolean, newTier?: string,
 *   pointsEarned?: number, badgeUnlocked?: string|null, error?: string}>}
 */
export const receiveGamificationEvent = webMethod(
  Permissions.SiteMember,
  async (eventName, payload, memberId) => {
    if (!memberId) {
      return { success: false, error: 'memberId is required' };
    }

    const basePoints = resolvePoints(eventName, payload);

    // Unknown event: return current total without writing
    if (basePoints === null) {
      logError(
        `gamificationEventReceiver — unknown event "${eventName}" for member ${memberId}`,
        new Error('Unknown gamification event'),
        { silent: true }
      );
      try {
        const record = await findMemberRecord(memberId);
        const totalPoints = record ? record.totalPoints : 0;
        return {
          success: true,
          newTotal: totalPoints,
          tierChanged: false,
          newTier: getTierForPoints(totalPoints),
          pointsEarned: 0,
          badgeUnlocked: null,
        };
      } catch (err) {
        logError(`gamificationEventReceiver — query failed for member ${memberId}`, err);
        return { success: false, error: 'Failed to retrieve points' };
      }
    }

    try {
      const record = await findMemberRecord(memberId);
      const oldTotal = record ? record.totalPoints : 0;
      const oldTier = record ? record.tier : getTierForPoints(0);

      // Phase 2: compute streak state (pure, no DB calls)
      // Use payload.ts (event origin time) when present to avoid streak breaks from webhook lag.
      const todayET = payload?.ts ? tsToETDate(payload.ts) : getTodayET();
      const yesterdayET = getYesterdayOf(todayET);
      const streakState = updateStreakState(record || {}, todayET, yesterdayET);

      // Phase 4: wishlist monthly cap — use same event-derived date as streak logic
      const capResult = eventName === 'gamification_wishlist_add'
        ? await checkWishlistMonthlyCap(memberId, todayET)
        : null;
      const canEarnWishlist = capResult?.canEarn ?? false;

      // Phase 4b: AR discovery one-time cap (CF-0gly)
      let canEarnARDiscovery = true;
      if (eventName === 'gamification_ar_discovery') {
        try {
          const priorAR = await wixData
            .query('AnalyticsEvents')
            .eq('memberId', memberId)
            .eq('eventType', 'ar_discovery')
            .limit(1)
            .find({ suppressAuth: true });
          canEarnARDiscovery = priorAR.items.length === 0;
        } catch (err) {
          logError(`receiveGamificationEvent — AR discovery cap check failed for ${memberId}`, err, { silent: true });
          canEarnARDiscovery = false; // fail closed
        }
      }

      let effectiveBase = eventName !== 'gamification_wishlist_add' || canEarnWishlist
        ? basePoints
        : 0;
      if (eventName === 'gamification_ar_discovery' && !canEarnARDiscovery) {
        effectiveBase = 0;
      }

      // Apply streak multiplier to effective base points.
      // Fixed-award events (birthday, anniversary) are exempt — their value must not scale.
      const multiplier = FIXED_AWARD_EVENTS.has(eventName) ? 1 : streakState.streakMultiplier;
      const adjustedPoints = Math.round(effectiveBase * multiplier);
      // milestoneBonus is intentionally NOT multiplied — a streak milestone reward
      // doubling because of an active streak would be self-referential.
      const newTotal = oldTotal + adjustedPoints + streakState.milestoneBonus;
      const newTier = getTierForPoints(newTotal);
      const tierChanged = newTier !== oldTier;

      const bonusSpins = await maybeGrantBonusSpin(eventName, payload);
      const milestoneSpins = streakState.milestoneBonus > 0
        ? await maybeGrantBonusSpin('gamification_streak_milestone', payload)
        : 0;
      const currentBonusSpins = record ? (record.bonusSpinsAvailable || 0) : 0;
      const newBonusSpins = currentBonusSpins + bonusSpins + milestoneSpins;

      const updatedRecord = {
        totalPoints: newTotal,
        tier: newTier,
        bonusSpinsAvailable: newBonusSpins,
        currentStreakDays: streakState.currentStreakDays,
        streakStartDate: streakState.streakStartDate,
        lastActivityDate: streakState.lastActivityDate,
        streakMultiplier: streakState.streakMultiplier,
        graceTokenUsedDate: streakState.graceTokenUsedDate ?? null,
        // cf-bvn: authoritative "last activity" timestamp used by re-engagement
        // dormancy detection. Written on every gamification event so browse-only
        // members (quiz/login/wishlist with no purchase) are still reachable.
        lastActivityAt: new Date(),
      };

      if (record) {
        await wixData.update(MEMBER_POINTS_COLLECTION, { ...record, ...updatedRecord }, { suppressAuth: true });
      } else {
        await wixData.insert(MEMBER_POINTS_COLLECTION, { memberId, ...updatedRecord }, { suppressAuth: true });
      }

      // Audit ledger — write separate entries for earn and milestone bonus
      const baseTraceId = `${memberId}_${eventName}_${payload?.ts ?? Date.now()}`;
      if (adjustedPoints !== 0) {
        try {
          await insertLedgerEntry({
            memberId,
            traceId: baseTraceId,
            operationType: 'earn',
            delta: adjustedPoints,
            reason: eventName,
            previousBalance: oldTotal,
            newBalance: oldTotal + adjustedPoints,
            sourceData: { eventName, streakMultiplier: streakState.streakMultiplier },
          });
        } catch (err) {
          logError(`gamificationEventReceiver — ledger insert failed for ${memberId}`, err);
        }
      }
      if (streakState.milestoneBonus > 0) {
        const afterEarn = oldTotal + adjustedPoints;
        try {
          await insertLedgerEntry({
            memberId,
            traceId: `${baseTraceId}_milestone`,
            operationType: 'bonus',
            delta: streakState.milestoneBonus,
            reason: 'streak_milestone_bonus',
            previousBalance: afterEarn,
            newBalance: afterEarn + streakState.milestoneBonus,
            sourceData: { eventName, milestoneBonus: streakState.milestoneBonus },
          });
        } catch (err) {
          logError(`gamificationEventReceiver — milestone ledger insert failed for ${memberId}`, err);
        }
      }

      // Cross-rig event bus — web→mobile dispatch (best-effort)
      const totalDelta = newTotal - oldTotal;
      if (totalDelta !== 0) {
        try { await dispatchBusEvent({ event: 'points_earned', userId: memberId, delta: totalDelta, newTotal }); }
        catch (err) { logError(`gamificationEventReceiver — bus dispatch (points_earned) failed for ${memberId}`, err, { silent: true }); }
      }
      if (tierChanged) {
        try { await dispatchBusEvent({ event: 'tier_upgraded', userId: memberId, newTier, previousTier: oldTier }); }
        catch (err) { logError(`gamificationEventReceiver — bus dispatch (tier_upgraded) failed for ${memberId}`, err, { silent: true }); }
        // CF-c6el.2: Auto-deliver tier perks (coupon codes, emails, booking links)
        try {
          const { deliverTierPerks } = await import('backend/rewardEngine.web');
          await deliverTierPerks(memberId, oldTier, newTier);
        } catch (e) { logError(`gamificationEventReceiver — deliverTierPerks failed for ${memberId}`, e); }
        // cf-1d3: Personal tier-upgrade email + push (idempotent + opt-out aware)
        try {
          const { notifyTierUpgrade } = await import('backend/gamificationNotifs.web');
          await notifyTierUpgrade(memberId, newTier, oldTier);
        } catch (e) { logError(`gamificationEventReceiver — notifyTierUpgrade failed for ${memberId}`, e); }
      }

      // Phase 4: record wishlist add AFTER MemberPoints (best-effort)
      if (canEarnWishlist) {
        try {
          await recordWishlistAdd(memberId, todayET);
        } catch (err) {
          logError(`gamificationEventReceiver — recordWishlistAdd failed for ${memberId}`, err);
        }
      }

      // Phase 2: award week_wanderer badge on 7-day milestone.
      // Idempotent via computed _id = '${memberId}_week_wanderer' — DB-level unique key
      // prevents duplicate awards even under concurrent webhook delivery.
      let badgeUnlocked = null;
      if (streakState.milestoneBonus > 0) {
        try {
          await wixData.insert(MEMBER_BADGES_COLLECTION, {
            _id: `${memberId}_week_wanderer`,
            memberId,
            badgeId: 'week_wanderer',
          }, { suppressAuth: true });
          badgeUnlocked = 'week_wanderer';
        } catch (err) {
          const msg = String(err?.message ?? err).toLowerCase();
          const isDuplicate = msg.includes('duplicate') || msg.includes('unique constraint');
          logError(`gamificationEventReceiver — badge award failed for ${memberId}`, err, { silent: isDuplicate });
        }
      }

      // CF-ou66.2: video_reviewer exclusive badge — one-time award on video review approval
      if (eventName === 'video_review_approved') {
        try {
          await wixData.insert(MEMBER_BADGES_COLLECTION, {
            _id: `${memberId}_video_reviewer`,
            memberId,
            badgeId: 'video_reviewer',
          }, { suppressAuth: true });
          badgeUnlocked = 'video_reviewer';
        } catch (err) {
          const msg = String(err?.message ?? err).toLowerCase();
          const isDuplicate = msg.includes('duplicate') || msg.includes('unique constraint');
          logError(`gamificationEventReceiver — video_reviewer badge award failed for ${memberId}`, err, { silent: isDuplicate });
        }
      }

      // CF-3wl: AnalyticsEvents pipeline — best-effort, never throws
      const prevStreakDays = record ? (record.currentStreakDays || 0) : 0;
      try {
        if (tierChanged) {
          await insertAnalyticsEvent({ memberId, eventType: 'tier_upgrade', source: 'gamification', payload: { newTier, previousTier: oldTier } });
        }
        if (streakState.milestoneBonus > 0) {
          await insertAnalyticsEvent({ memberId, eventType: 'badge_earned', source: 'gamification', payload: { badgeId: 'week_wanderer' } });
        }
        if (badgeUnlocked === 'video_reviewer') {
          await insertAnalyticsEvent({ memberId, eventType: 'badge_earned', source: 'gamification', payload: { badgeId: 'video_reviewer' } });
        }
        if (streakState.currentStreakDays === prevStreakDays + 1) {
          await insertAnalyticsEvent({ memberId, eventType: 'streak_extended', source: 'gamification', payload: { currentStreakDays: streakState.currentStreakDays } });
        }
      } catch (err) {
        logError(`gamificationEventReceiver — analytics insert failed for ${memberId}`, err);
      }

      // CF-1faf: Cross-rig bus — badge + streak events (best-effort)
      if (badgeUnlocked) {
        try { await dispatchBusEvent({ event: 'badge_earned', userId: memberId, badgeId: badgeUnlocked }); }
        catch (err) { logError(`gamificationEventReceiver — bus dispatch (badge_earned) failed for ${memberId}`, err, { silent: true }); }
      }
      if (streakState.currentStreakDays > prevStreakDays) {
        try { await dispatchBusEvent({ event: 'streak_extended', userId: memberId, currentStreakDays: streakState.currentStreakDays }); }
        catch (err) { logError(`gamificationEventReceiver — bus dispatch (streak_extended) failed for ${memberId}`, err, { silent: true }); }
      }

      return {
        success: true,
        newTotal,
        tierChanged,
        newTier,
        currentStreakDays: streakState.currentStreakDays,
        streakMultiplier: streakState.streakMultiplier,
        milestoneUnlocked: streakState.milestoneBonus > 0,
        pointsEarned: adjustedPoints + streakState.milestoneBonus,
        badgeUnlocked,
      };
    } catch (err) {
      logError(`gamificationEventReceiver — ${eventName} failed for member ${memberId}`, err);
      return { success: false, error: 'Failed to award points' };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the point delta for a given event, or null for unknown events.
 * @param {string} eventName
 * @param {Object} payload
 * @returns {number|null}
 */
function resolvePoints(eventName, payload) {
  switch (eventName) {
    case 'gamification_add_to_cart':
      return ADD_TO_CART_POINTS;
    case 'gamification_submit_review':
      return POINT_VALUES.REVIEW + (payload?.has_photo ? POINT_VALUES.PHOTO_REVIEW_BONUS : 0);
    case 'gamification_referral_shared':
      return REFERRAL_SHARED_POINTS;
    case 'gamification_referral_accepted':
      return POINT_VALUES.REFERRAL_ACCEPTED;
    case 'gamification_order_complete':
      return Math.floor(payload?.orderTotal || 0);
    case 'gamification_spin_completed':
      return 0;
    case 'gamification_ar_used':
      return POINT_VALUES.AR_USED;
    case 'gamification_ar_discovery':
      return POINT_VALUES.AR_TRY_ON; // 25 pts — first AR session only (cap enforced in receiver)
    case 'gamification_wishlist_add':
      return POINT_VALUES.WISHLIST_ADD;
    case 'video_review_approved':
      return POINT_VALUES.VIDEO_REVIEW;
    default:
      return null;
  }
}

/**
 * Look up a member's current MemberPoints record.
 * Returns null if the member has no record yet.
 * @param {string} memberId
 * @returns {Promise<Object|null>}
 */
// idor-ok: internal backend helper — called from gamification pipeline only, no frontend import
export async function findMemberRecord(memberId) {
  const results = await wixData.query(MEMBER_POINTS_COLLECTION)
    .eq('memberId', memberId)
    .limit(1)
    .find({ suppressAuth: true });
  return results.items.length > 0 ? results.items[0] : null;
}

/**
 * Seed a new member with welcome points (endowed progress effect).
 * Only creates a record if one doesn't exist yet. Idempotent.
 *
 * CF-9swp
 *
 * @param {string} memberId
 * @param {number} [welcomePoints=50]
 * @returns {Promise<{ seeded: boolean, points: number }>}
 */
export async function seedWelcomePoints(memberId, welcomePoints = 50) {
  if (!memberId) return { seeded: false, points: 0 };

  try {
    const existing = await findMemberRecord(memberId);
    if (existing) return { seeded: false, points: existing.totalPoints ?? 0 };

    await wixData.insert(MEMBER_POINTS_COLLECTION, {
      memberId,
      totalPoints: welcomePoints,
      currentStreakDays: 0,
      streakStartDate: null,
      lastActivityDate: null,
      streakMultiplier: 1,
      milestoneBonus: 0,
      graceTokenUsedDate: null,
      graceApplied: false,
      tier: getTierForPoints(welcomePoints),
      bonusSpinsAvailable: 0,
      lastActivityAt: new Date(), // cf-bvn: seed dormancy timestamp on signup
    }, { suppressAuth: true });

    try {
      await insertLedgerEntry({
        memberId,
        traceId: `${memberId}_welcome_${Date.now()}`,
        operationType: 'earn',
        delta: welcomePoints,
        reason: 'welcome_bonus',
        previousBalance: 0,
        newBalance: welcomePoints,
      });
    } catch (err) {
      logError(`seedWelcomePoints — ledger insert failed for ${memberId}`, err);
    }

    return { seeded: true, points: welcomePoints };
  } catch (err) {
    logError(`seedWelcomePoints — failed for ${memberId}`, err);
    return { seeded: false, points: 0 };
  }
}

/**
 * Query BonusSpinGrants for an active grant matching the event.
 * Returns the number of bonus spins to award (0 if none).
 * @param {string} eventName
 * @param {Object} [payload] - Event payload; payload.orderTotal checked against grant.minOrderTotal
 * @returns {Promise<number>}
 */
async function maybeGrantBonusSpin(eventName, payload) {
  try {
    const results = await wixData.query(BONUS_SPIN_GRANTS_COLLECTION)
      .eq('triggerEvent', eventName)
      .eq('active', true)
      .limit(1)
      .find({ suppressAuth: true });
    if (results.items.length > 0) {
      const grant = results.items[0];
      const minTotal = grant.minOrderTotal || 0;
      const orderTotal = payload?.orderTotal || 0;
      if (orderTotal >= minTotal) {
        return grant.spinsGranted || 1;
      }
    }
    return 0;
  } catch (err) {
    logError(`maybeGrantBonusSpin — query failed for event ${eventName}`, err, { silent: true });
    return 0;
  }
}

// ── Streak helper (exported for testing) ──────────────────────────────────────

/**
 * Subtract one calendar day from a "YYYY-MM-DD" ET date string.
/**
 * Returns "YYYY-MM" from a "YYYY-MM-DD" string (month key for grace token eligibility).
 * @param {string} dateET
 * @returns {string}
 */
function _monthOf(dateET) {
  return dateET.slice(0, 7);
}

/**
 * Compute new streak state based on the member's last activity date.
 * Pure function — no DB calls. All three branches set milestoneBonus explicitly.
 *
 * Phase 2 v2: Branch 3 now checks grace token before resetting.
 * Grace token: one per calendar month (tracked via graceTokenUsedDate on MemberPoints).
 * Applies when exactly 1 day was missed and token is available this month.
 *
 * @param {Object} record - Current MemberPoints record (streak fields may be null for new members)
 * @param {string} todayET - Today's ET date string e.g. "2026-03-22"
 * @param {string} yesterdayET - Yesterday's ET date string e.g. "2026-03-21"
 * @returns {{ currentStreakDays, streakStartDate, lastActivityDate, streakMultiplier,
 *             milestoneBonus, graceTokenUsedDate, graceApplied? }}
 */
export function updateStreakState(record, todayET, yesterdayET) {
  const lastActivity = record.lastActivityDate || null;
  const existingDays = record.currentStreakDays || 0;
  const existingStart = record.streakStartDate || todayET;
  const existingMultiplier = record.streakMultiplier || 1;
  const graceUsed = record.graceTokenUsedDate || null;
  const existingLongest = record.longestStreakDays || 0;

  // Branch 1: already active today — no change
  if (lastActivity === todayET) {
    return {
      currentStreakDays: existingDays,
      streakStartDate: existingStart,
      lastActivityDate: todayET,
      streakMultiplier: existingMultiplier,
      milestoneBonus: 0,
      graceTokenUsedDate: graceUsed,
      longestStreakDays: Math.max(existingDays, existingLongest),
    };
  }

  // Branch 2: active yesterday — increment streak
  if (lastActivity === yesterdayET) {
    const currentStreakDays = existingDays + 1;
    const streakMultiplier = getStreakMultiplier(currentStreakDays);
    const milestoneBonus = currentStreakDays === 7 ? POINT_VALUES.STREAK_7_DAY : 0;
    return {
      currentStreakDays,
      streakStartDate: existingStart,
      lastActivityDate: todayET,
      streakMultiplier,
      milestoneBonus,
      graceTokenUsedDate: graceUsed,
      longestStreakDays: Math.max(currentStreakDays, existingLongest),
    };
  }

  // Branch 3a: exactly 1 missed day + grace token available this month → apply grace
  const twoDaysAgoET = getYesterdayOf(yesterdayET);
  const graceAvailable = !graceUsed || _monthOf(graceUsed) !== _monthOf(todayET);
  if (lastActivity === twoDaysAgoET && graceAvailable) {
    return {
      currentStreakDays: existingDays,
      streakStartDate: existingStart,
      lastActivityDate: todayET,
      streakMultiplier: existingMultiplier,
      milestoneBonus: 0,
      graceTokenUsedDate: todayET, // mark token used for this month
      graceApplied: true,
      longestStreakDays: Math.max(existingDays, existingLongest),
    };
  }

  // Branch 3b: missed 2+ days, or grace already used — reset streak
  // CF-qsxp: preserve longestStreakDays across streak breaks
  return {
    currentStreakDays: 1,
    streakStartDate: todayET,
    lastActivityDate: todayET,
    streakMultiplier: 1,
    milestoneBonus: 0,
    graceTokenUsedDate: graceUsed, // preserve existing (not consumed)
    longestStreakDays: Math.max(existingDays, existingLongest),
  };
}

// ── Challenge progress helper (exported for testing) ──────────────────────────

/**
 * Updates MemberChallengeProgress for one member + one challenge.
 * Handles idempotency (eventIds JSON array), bounded array (trim at 1000),
 * and challenge completion detection.
 *
 * @param {string} memberId
 * @param {Object} challenge  - Full challenge record from Challenges collection
 * @param {string} eventId    - Unique event ID for idempotency
 * @param {Date}   now        - Current timestamp (injected for testability)
 * @returns {Promise<{
 *   challengeId: string,
 *   title: string,
 *   progressValue: number,
 *   targetCount: number,
 *   justCompleted: boolean,
 *   completedAt: Date|null,
 *   alreadyProcessed?: boolean,
 *   alreadyCompleted?: boolean,
 *   progressError?: boolean,
 * }>}
 */
// idor-ok: internal backend helper — called from gamification event handlers only
export async function updateChallengeProgress(memberId, challenge, eventId, now) {
  const { challengeId, title, targetCount } = challenge;
  const base = { challengeId, title, targetCount };

  try {
    const results = await wixData
      .query(CHALLENGE_PROGRESS_COLLECTION)
      .eq('memberId', memberId)
      .eq('challengeId', challengeId)
      .find({ suppressAuth: true });

    let record = results.items[0];

    // If challenge already completed, do nothing
    if (record && record.completedAt) {
      return { ...base, progressValue: record.progressValue, justCompleted: false, completedAt: record.completedAt, alreadyCompleted: true };
    }

    // Parse eventIds — create record if none exists
    if (!record) {
      record = {
        memberId,
        challengeId,
        progressValue: 0,
        eventIds: '[]',
        completedAt: null,
        notifiedAt: null,
      };
    }

    const eventIds = JSON.parse(record.eventIds || '[]');

    // Idempotency check
    if (eventIds.includes(eventId)) {
      return { ...base, progressValue: record.progressValue, justCompleted: false, completedAt: record.completedAt, alreadyProcessed: true };
    }

    // Bounded array: trim oldest 500 if at 1000
    if (eventIds.length >= 1000) {
      eventIds.splice(0, 500);
    }
    eventIds.push(eventId);

    const newProgress = record.progressValue + 1;
    const justCompleted = newProgress >= targetCount;
    const completedAt = justCompleted ? now : null;

    const updatedRecord = {
      ...record,
      progressValue: newProgress,
      eventIds: JSON.stringify(eventIds),
      completedAt,
    };

    if (record._id) {
      await wixData.update(CHALLENGE_PROGRESS_COLLECTION, updatedRecord, { suppressAuth: true });
    } else {
      await wixData.insert(CHALLENGE_PROGRESS_COLLECTION, updatedRecord, { suppressAuth: true });
    }

    return { ...base, progressValue: newProgress, justCompleted, completedAt };
  } catch (err) {
    logError(`updateChallengeProgress — failed for member ${memberId} challenge ${challengeId}`, err, { silent: true });
    return { ...base, progressValue: 0, justCompleted: false, completedAt: null, progressError: true };
  }
}

// ── Phase 4: Wishlist monthly cap helpers ─────────────────────────────────────

/**
 * Check whether a member can earn points for a wishlist add this month.
 * Returns { canEarn: true } when count < WISHLIST_MONTHLY_CAP (1); { canEarn: false } when at cap.
 * Fails open on DB error — members earn points rather than being silently blocked.
 *
 * @param {string} memberId
 * @param {string} todayET  - ET date string e.g. "2026-03-22"
 * @returns {Promise<{ canEarn: boolean, count: number }>}
 */
// idor-ok: internal backend helper — called from wishlist add event handler only
export async function checkWishlistMonthlyCap(memberId, todayET) {
  try {
    const monthStart = todayET.slice(0, 7) + '-01'; // "2026-03-01"
    const [year, mon] = todayET.slice(0, 7).split('-').map(Number);
    const nextMonth = mon === 12 ? `${year + 1}-01-01` : `${year}-${String(mon + 1).padStart(2, '0')}-01`;
    const results = await wixData.query(WISHLIST_ADD_LOG_COLLECTION)
      .eq('memberId', memberId)
      .ge('date', monthStart)
      .lt('date', nextMonth)
      .find({ suppressAuth: true });
    const count = results.items.length;
    // Note: this cap is best-effort under concurrent load — Wix Data has no atomic
    // increment, so two rapid simultaneous wishlist adds could both pass the check.
    return { canEarn: count < WISHLIST_MONTHLY_CAP, count };
  } catch (err) {
    // Fail open — member earns points if the cap check itself is broken
    logError(`checkWishlistMonthlyCap — query failed for member ${memberId} on ${todayET}`, err, { silent: true });
    return { canEarn: true, count: 0 };
  }
}

/**
 * Record a wishlist add in WishlistAddLog.
 * Must be called AFTER the MemberPoints write — this ordering ensures points are awarded
 * even if the log insert fails (critical write first, audit write second).
 *
 * @param {string} memberId
 * @param {string} todayET  - ET date string e.g. "2026-03-22"
 */
export async function recordWishlistAdd(memberId, todayET) {
  await wixData.insert(WISHLIST_ADD_LOG_COLLECTION, { memberId, date: todayET }, { suppressAuth: true });
}
// ── getActiveChallenges ───────────────────────────────────────────────────────

/**
 * Returns up to 5 active, non-expired challenges for a member, merged with their
 * progress records. Sorted by expiresAt ASC (soonest-expiring first).
 * Rate limited to 10 calls/hr per member (in-memory).
 *
 * @param {string} memberId
 * @returns {Promise<{ challenges: Array } | { status: 429, error: string }>}
 */
export const getActiveChallenges = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (!memberId) {
      // Permissions.SiteMember should gate anonymous callers before we get
      // here; reaching this branch means Velo let an unauthenticated request
      // through (stale session, misconfiguration). Surface it as a distinct
      // error instead of returning "no challenges" — that's silent-failure
      // masquerade. See cf-1y7 (cf-2ag cascade).
      console.warn('[gamificationCore] getActiveChallenges: no memberId on session (cf-1y7)');
      return { challenges: [], error: 'auth_required' };
    }

    // Rate limit: 10 calls/hr per member
    const now = Date.now();
    const rl = _activeChallengesRateLimit.get(memberId) || { count: 0, windowStart: now };
    if (now - rl.windowStart > ACTIVE_CHALLENGES_WINDOW_MS) {
      rl.count = 0;
      rl.windowStart = now;
    }
    rl.count += 1;
    _activeChallengesRateLimit.set(memberId, rl);
    if (rl.count > ACTIVE_CHALLENGES_RATE_LIMIT) {
      return { status: 429, error: 'Rate limit exceeded' };
    }

    try {
      const nowDate = new Date();

      // Fetch all active challenge definitions
      const challengeResults = await wixData
        .query(CHALLENGES_COLLECTION)
        .eq('active', true)
        .find({ suppressAuth: true });

      // CF+ exclusive gate: use authenticated caller identity ONLY — never the client-supplied
      // memberId parameter, which is untrusted. Fail closed: any error → isCFPlus=false.
      let isCFPlus = false;
      try {
        const { currentMember: cm } = await import('wix-members-backend');
        const caller = await cm.getMember();
        if (caller?._id) {
          const premiumResult = await wixData
            .query('PremiumMemberships')
            .eq('memberId', caller._id)
            .eq('status', 'active')
            .limit(1)
            .find({ suppressAuth: true });
          isCFPlus = Array.isArray(premiumResult?.items) && premiumResult.items.length > 0;
        }
      } catch (err) {
        logError(`getActiveChallenges — CF+ check failed, denying CF+ access`, err);
      }

      // Filter expired + CF+ gate, sort by expiresAt ASC, cap at 5
      const active = challengeResults.items
        .filter(c => c.expiresAt && new Date(c.expiresAt) > nowDate)
        .filter(c => !c.cfPlusOnly || isCFPlus)
        .sort((a, b) => new Date(a.expiresAt) - new Date(b.expiresAt))
        .slice(0, 5);

      if (active.length === 0) return { challenges: [] };

      // Fetch member progress for each challenge in parallel
      const progressResults = await Promise.all(
        active.map(c =>
          wixData
            .query(CHALLENGE_PROGRESS_COLLECTION)
            .eq('memberId', memberId)
            .eq('challengeId', c.challengeId || c._id)
            .find({ suppressAuth: true })
            .then(r => ({ challengeId: c.challengeId || c._id, record: r.items[0] || null }))
            .catch(() => ({ challengeId: c.challengeId || c._id, record: null }))
        )
      );
      const progressMap = Object.fromEntries(progressResults.map(p => [p.challengeId, p.record]));

      const challenges = active.map(c => {
        const cId = c.challengeId || c._id;
        const prog = progressMap[cId];
        return {
          challengeId: cId,
          title: c.title,
          description: c.description || null,
          conditionType: c.conditionType,
          targetCount: c.targetCount,
          rewardPoints: c.rewardPoints,
          rewardBadgeId: c.rewardBadgeId || null,
          expiresAt: c.expiresAt instanceof Date ? c.expiresAt.toISOString() : c.expiresAt,
          progressValue: prog ? prog.progressValue : 0,
          completedAt: prog ? prog.completedAt : null,
        };
      });

      return { challenges };
    } catch (err) {
      // cf-tlt: surface internal_error instead of bare { challenges: [] } so
      // callers can distinguish a DB failure from a legitimate empty-but-authed
      // result. Same cf-2ag pattern as the null-member branch above, and uses
      // the project-wide `internal_error` convention (see line 969 below).
      logError(`getActiveChallenges — failed for member ${memberId}`, err);
      return { challenges: [], error: 'internal_error' };
    }
  }
);

// ── recordChallengeProgress ───────────────────────────────────────────────────

/**
 * Record one unit of progress for a member on a challenge.
 * Idempotent: re-calling after completion returns completed=true, pointsAwarded=0.
 *
 * @param {{ memberId: string, challengeId: string }} params
 * @returns {Promise<{ success: true, newProgress: number, completed: boolean, pointsAwarded: number }
 *                  | { success: false, error: string }
 *                  | { status: 429, error: string }>}
 */
export const recordChallengeProgress = webMethod(
  Permissions.SiteMember,
  async ({ memberId, challengeId } = {}) => {
    if (!memberId) return { success: false, error: 'memberId is required' };
    if (!challengeId) return { success: false, error: 'challengeId is required' };

    // Rate limit: 20 calls/hr per member
    const now = Date.now();
    const rl = _recordChallengeProgressRateLimit.get(memberId) || { count: 0, windowStart: now };
    if (now - rl.windowStart > RECORD_CHALLENGE_PROGRESS_WINDOW_MS) {
      rl.count = 0;
      rl.windowStart = now;
    }
    rl.count += 1;
    _recordChallengeProgressRateLimit.set(memberId, rl);
    if (rl.count > RECORD_CHALLENGE_PROGRESS_RATE_LIMIT) {
      return { status: 429, error: 'Rate limit exceeded' };
    }

    try {
      // Look up challenge definition
      const challengeQuery = await wixData
        .query(CHALLENGES_COLLECTION)
        .eq('challengeId', challengeId)
        .find({ suppressAuth: true });
      const challenge = challengeQuery.items[0];
      if (!challenge) return { success: false, error: 'challenge_not_found' };
      if (challenge.expiresAt && new Date(challenge.expiresAt) <= new Date()) {
        return { success: false, error: 'challenge_expired' };
      }

      // Look up existing progress record
      const progressQuery = await wixData
        .query(CHALLENGE_PROGRESS_COLLECTION)
        .eq('memberId', memberId)
        .eq('challengeId', challengeId)
        .find({ suppressAuth: true });
      const existing = progressQuery.items[0];

      // Idempotent: already completed
      if (existing && existing.completedAt) {
        return { success: true, newProgress: existing.progressValue, completed: true, pointsAwarded: 0 };
      }

      const newProgress = (existing ? existing.progressValue : 0) + 1;
      const completed = newProgress >= challenge.targetCount;
      const completedAt = completed ? new Date() : null;

      if (existing) {
        await wixData.update(CHALLENGE_PROGRESS_COLLECTION, {
          ...existing,
          progressValue: newProgress,
          completedAt,
        }, { suppressAuth: true });
      } else {
        await wixData.insert(CHALLENGE_PROGRESS_COLLECTION, {
          memberId,
          challengeId,
          progressValue: newProgress,
          completedAt,
        }, { suppressAuth: true });
      }

      let pointsAwarded = 0;
      if (completed && challenge.rewardPoints) {
        pointsAwarded = challenge.rewardPoints;
        const mpQuery = await wixData
          .query(MEMBER_POINTS_COLLECTION)
          .eq('memberId', memberId)
          .find({ suppressAuth: true });
        const mp = mpQuery.items[0];
        if (mp) {
          await wixData.update(MEMBER_POINTS_COLLECTION, {
            ...mp,
            totalPoints: mp.totalPoints + pointsAwarded,
            lastActivityAt: new Date(), // cf-bvn
          }, { suppressAuth: true });
        } else {
          await wixData.insert(MEMBER_POINTS_COLLECTION, {
            memberId,
            totalPoints: pointsAwarded,
            currentStreakDays: 0,
            streakStartDate: null,
            lastActivityDate: getTodayET(),
            streakMultiplier: 1,
            milestoneBonus: 0,
            graceTokenUsedDate: null,
            graceApplied: false,
            tier: getTierForPoints(pointsAwarded),
            bonusSpinsAvailable: 0,
            lastActivityAt: new Date(), // cf-bvn
          }, { suppressAuth: true });
        }
      }

      if (completed && challenge.rewardPoints > 0) {
        try {
          await recordChallengeCompleteEvent(memberId, challengeId, challenge.rewardPoints);
        } catch (err) {
          logError(`recordChallengeProgress — PointsLedger write failed for member ${memberId} challenge ${challengeId}`, err);
        }
      }

      // CF-3wl: AnalyticsEvents pipeline — best-effort, never throws
      try {
        if (!existing) {
          await insertAnalyticsEvent({ memberId, eventType: 'challenge_started', source: 'gamification', payload: { challengeId } });
        }
        if (completed) {
          await insertAnalyticsEvent({ memberId, eventType: 'challenge_completed', source: 'gamification', payload: { challengeId, pointsAwarded } });
        }
      } catch (err) {
        logError(`recordChallengeProgress — analytics insert failed for member ${memberId}`, err);
      }

      if (completed) {
        try { await dispatchBusEvent({ event: 'challenge_completed', userId: memberId, challengeId }); }
        catch (err) { logError(`recordChallengeProgress — bus dispatch (challenge_completed) failed for ${memberId}`, err, { silent: true }); }
      }

      return { success: true, newProgress, completed, pointsAwarded };
    } catch (err) {
      logError(`recordChallengeProgress — failed for member ${memberId} challenge ${challengeId}`, err);
      return { success: false, error: 'internal_error' };
    }
  }
);

// ── recoverStreak (Phase 2 v2) ────────────────────────────────────────────────

const STREAK_RECOVERY_COOLDOWN_DAYS = 30;

/**
 * Spend STREAK_RECOVERY_COST points to restore a broken streak to 1 day.
 * Allowed once per 30 days (tracked via MemberPoints.lastStreakRecoveryDate).
 *
 * TODO (blocked on CF-ledger): insert MemberPointsLedger entry
 *   reason: 'streak_recovery', delta: -STREAK_RECOVERY_COST
 *
 * @param {string} memberId
 * @returns {Promise<{ success: boolean, newTotal?: number, currentStreakDays?: number, error?: string }>}
 */
export const recoverStreak = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (!memberId) {
      return { success: false, error: 'memberId is required' };
    }
    try {
      const todayET = getTodayET();
      const record = await findMemberRecord(memberId);
      if (!record) {
        return { success: false, error: 'no record found for member' };
      }

      if (record.totalPoints < STREAK_RECOVERY_COST) {
        return { success: false, error: 'insufficient points for streak recovery' };
      }

      // Cooldown: once per 30 days
      const lastRecovery = record.lastStreakRecoveryDate || null;
      if (lastRecovery) {
        const [ly, lm, ld] = lastRecovery.split('-').map(Number);
        const [ty, tm, td] = todayET.split('-').map(Number);
        const daysDiff = Math.floor(
          (Date.UTC(ty, tm - 1, td) - Date.UTC(ly, lm - 1, ld)) / 86400000
        );
        if (daysDiff < STREAK_RECOVERY_COOLDOWN_DAYS) {
          return { success: false, error: `streak recovery on 30 day cooldown (${daysDiff} days elapsed)` };
        }
      }
      const newTotal = record.totalPoints - STREAK_RECOVERY_COST;
      const updatedRecord = {
        ...record,
        totalPoints: newTotal,
        currentStreakDays: 1,
        streakStartDate: todayET,    // reset so derived streak length stays accurate
        lastStreakRecoveryDate: todayET,
        lastActivityAt: new Date(),  // cf-bvn: user-initiated action
      };
      // NOTE: When CF-ledger lands this will become two sequential wixData writes
      // with no rollback. If the ledger insert fails after the points deduction,
      // the member is debited with no audit trail. Track in CF-ledger story.
      await wixData.update(MEMBER_POINTS_COLLECTION, updatedRecord, { suppressAuth: true });

      try {
        await insertLedgerEntry({
          memberId,
          traceId: `${memberId}_streak_recovery_${Date.now()}`,
          operationType: 'burn',
          delta: -STREAK_RECOVERY_COST,
          reason: 'streak_recovery',
          previousBalance: record.totalPoints,
          newBalance: newTotal,
        });
      } catch (err) {
        logError(`recoverStreak — ledger insert failed for ${memberId}`, err);
      }

      return { success: true, newTotal, currentStreakDays: 1 };
    } catch (err) {
      logError(`recoverStreak — failed for member ${memberId}`, err);
      return { success: false, error: 'Failed to recover streak' };
    }
  }
);

/**
 * Get streak data for a member (admin-callable, takes memberId).
 * Returns { currentStreak, longestStreak, lastActivityDate }.
 *
 * CF-4xnp
 *
 * @param {string} memberId
 * @returns {Promise<{ currentStreak: number, longestStreak: number, lastActivityDate: string|null }>}
 */
export const getStreakData = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (!memberId) {
      // Velo SiteMember gate leak — distinguishable from "authed but no streak
      // yet" (which also returns zeros, but without the error field).
      // See cf-1y7 (cf-2ag cascade).
      console.warn('[gamificationCore] getStreakData: no memberId on session (cf-1y7)');
      return { currentStreak: 0, longestStreak: 0, lastActivityDate: null, error: 'auth_required' };
    }
    const record = await findMemberRecord(memberId);
    if (!record) {
      return { currentStreak: 0, longestStreak: 0, lastActivityDate: null };
    }
    const currentStreak = record.currentStreakDays ?? 0;
    return {
      currentStreak,
      longestStreak: record.longestStreakDays ?? currentStreak,
      lastActivityDate: record.lastActivityDate ?? null,
    };
  }
);

/**
 * Get top-N leaderboard entries sorted by totalPoints DESC.
 * Returns [{ nickname, totalPoints, rank, avatarUrl, memberId }].
 *
 * CF-ttcd
 *
 * @param {number} [limit=10] - Max entries to return
 * @returns {Promise<Array<{ nickname: string, totalPoints: number, rank: number, avatarUrl: string|null, memberId: string }>>}
 */
export const getLeaderboard = webMethod(
  Permissions.Anyone,
  async (limit = 10, memberId = null) => {
    const result = await wixData
      .query(MEMBER_POINTS_COLLECTION)
      .eq('leaderboardOptIn', true)
      .descending('totalPoints')
      .limit(limit)
      .find({ suppressAuth: true });

    const entries = result.items.map((item, i) => ({
      rank: i + 1,
      nickname: item.displayName ?? 'Anonymous',
      totalPoints: item.totalPoints ?? 0,
      avatarUrl: item.avatarUrl ?? null,
      memberId: item.memberId ?? null,
    }));

    // CF-bs92: calculate current user rank if not in top N
    let currentUserRank = null;
    let pointsToTopTen = 0;

    if (memberId) {
      const inTop = entries.find(e => e.memberId === memberId);
      if (inTop) {
        currentUserRank = inTop.rank;
      } else {
        // Count how many opted-in members have more points than this user
        const userRecord = await findMemberRecord(memberId);
        const userPoints = userRecord?.totalPoints ?? 0;
        const countResult = await wixData
          .query(MEMBER_POINTS_COLLECTION)
          .eq('leaderboardOptIn', true)
          .gt('totalPoints', userPoints)
          .count({ suppressAuth: true });
        currentUserRank = countResult + 1;

        // Points gap to last entry in top N
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          pointsToTopTen = Math.max(0, lastEntry.totalPoints - userPoints + 1);
        }
      }
    }

    return { entries, currentUserRank, pointsToTopTen };
  }
);

// ── Tier benefits (keyed by canonical tier name from gamificationTokens.js) ──
// CF-f5j9, CF-r6r1: uses TIER_NAMES from gamificationTokens.js as single source of truth

const TIER_BENEFITS = {
  'Trail Blazer':      ['1x points'],
  'Mountain Guide':    ['1.5x points', 'Free shipping on orders over $500'],
  'Summit Master':     ['2x points', 'Free shipping all orders', 'Early access to sales'],
  'Blue Ridge Legend': ['3x points', 'Free shipping', 'Early access', 'Birthday double points', 'Exclusive products'],
};

export function computeTierInfo(totalPoints) {
  const pts = Math.max(0, totalPoints ?? 0);
  let tierIdx = 0;
  for (let i = TIER_NAMES.length - 1; i >= 0; i--) {
    if (pts >= TIER_NAMES[i].threshold) { tierIdx = i; break; }
  }
  const tier = TIER_NAMES[tierIdx];
  const nextTier = TIER_NAMES[tierIdx + 1] ?? null;
  return {
    currentTier: tier.name.toLowerCase().replace(/\s+/g, '-'),
    tierName: tier.name,
    pointsInTier: pts - tier.threshold,
    pointsToNextTier: nextTier ? nextTier.threshold - pts : 0,
    nextTierName: nextTier ? nextTier.name : null,
    benefits: TIER_BENEFITS[tier.name] ?? [],
    nextTierBenefits: nextTier ? (TIER_BENEFITS[nextTier.name] ?? []) : null,
  };
}

/**
 * Get tier info for a member based on totalPoints.
 * Returns tier name, progress, benefits, and next tier preview.
 *
 * CF-f5j9
 *
 * @param {string} memberId
 * @returns {Promise<{ currentTier, tierName, pointsInTier, pointsToNextTier, nextTierName, benefits, nextTierBenefits }>}
 */
export const getMemberTier = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    if (!memberId) {
      // Velo SiteMember gate leak — return the baseline Trail Blazer shape
      // but signal the auth anomaly so widgets can gate tier benefits display.
      // See cf-1y7 (cf-2ag cascade).
      console.warn('[gamificationCore] getMemberTier: no memberId on session (cf-1y7)');
      return { ...computeTierInfo(0), error: 'auth_required' };
    }
    const record = await findMemberRecord(memberId);
    return computeTierInfo(record ? record.totalPoints : 0);
  }
);

// ── Activity type → icon mapping (CF-gx44) ──────────────────────────────────

const ACTIVITY_ICONS = {
  purchase:       'cart',
  review:         'star',
  referral:       'gift',
  streak:         'fire',
  quest_complete: 'trophy',
  spin:           'wheel',
  badge_earned:   'shield',
  tier_up:        'arrow-up',
};

/**
 * Get recent activity feed for a member from AnalyticsEvents.
 * Returns [{ activityId, type, description, pointsEarned, timestamp, iconType }].
 *
 * CF-gx44
 *
 * @param {string} memberId
 * @param {number} [limit=10]
 * @returns {Promise<Array<{ activityId: string, type: string, description: string, pointsEarned: number, timestamp: string, iconType: string }>>}
 */
export const getActivityFeed = webMethod(
  Permissions.SiteMember,
  async (memberId, limit = 10) => {
    const { currentMember } = await import('wix-members-backend');
    const caller = await currentMember.getMember();
    if (!caller?._id) {
      // Velo SiteMember gate leak. Array return preserved for consumer compat;
      // observability lives in the warn so Wix runtime logs surface the leak.
      // See cf-1y7 (cf-2ag cascade).
      console.warn('[gamificationCore] getActivityFeed: no member on session (auth_required) (cf-1y7)');
      return [];
    }
    if (caller._id !== memberId) {
      // Cross-member read attempt. Keep defense-in-depth (empty array) but
      // warn distinctly so the two failure modes are separable in logs.
      console.warn('[gamificationCore] getActivityFeed: caller/memberId mismatch (forbidden) (cf-1y7)');
      return [];
    }

    const result = await wixData
      .query('AnalyticsEvents')
      .eq('memberId', memberId)
      .descending('timestamp')
      .limit(limit)
      .find({ suppressAuth: true });

    return result.items.map((item) => {
      const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : (item.payload ?? {});
      return {
        activityId: item._id,
        type: item.eventType ?? 'unknown',
        description: payload.description ?? `${item.eventType ?? 'Activity'}`,
        pointsEarned: payload.pointsEarned ?? 0,
        timestamp: item.timestamp ? new Date(item.timestamp).toISOString() : null,
        iconType: ACTIVITY_ICONS[item.eventType] ?? 'cart',
      };
    });
  }
);

// ── getActiveChallengeOfWeek (cf-rsr) ─────────────────────────────────────────

/**
 * Returns the current featured Challenge of the Week with the authenticated
 * member's individual progress. Accessible to anyone (homepage widget); progress
 * fields default to 0 for unauthenticated visitors.
 *
 * The CMS editor marks a challenge as featured by setting `isFeatured: true`
 * on the Challenges collection item.
 *
 * progressStatus lets callers distinguish between "real 0 from a member",
 * "default 0 because the caller is a visitor", and "default 0 because the
 * progress query failed" — all three used to be indistinguishable.
 *
 * Return discriminant (cf-9lp.3):
 *   • Challenge object → found a featured challenge, render it
 *   • null → no featured challenge this week (legitimate)
 *   • { error: 'internal_error' } → outer catch fired (DB/internal failure);
 *     callers must check `result?.error` before treating as a challenge.
 *
 * @returns {Promise<{
 *   challengeId: string,
 *   title: string,
 *   description: string|null,
 *   conditionType: string,
 *   targetCount: number,
 *   rewardPoints: number,
 *   progressValue: number,
 *   completedAt: string|null,
 *   progressStatus: 'member'|'visitor'|'unavailable',
 *   expiresAt: string,
 *   ctaUrl: string|null,
 * } | null | { error: 'internal_error' }>}
 */
export const getActiveChallengeOfWeek = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const nowDate = new Date();

      const result = await wixData
        .query(CHALLENGES_COLLECTION)
        .eq('active', true)
        .eq('isFeatured', true)
        .gt('expiresAt', nowDate.toISOString())
        .descending('_createdDate')
        .limit(1)
        .find({ suppressAuth: true });

      if (result.items.length === 0) return null;

      const challenge = result.items[0];
      const cId = challenge.challengeId || challenge._id;

      let memberId = null;
      let memberLookupFailed = false;
      try {
        const { currentMember: cm } = await import('wix-members-backend');
        const member = await cm.getMember();
        memberId = member?._id ?? null;
      } catch (err) {
        memberLookupFailed = true;
        logError('getActiveChallengeOfWeek — member lookup threw', err, { silent: true });
      }

      let progressValue = 0;
      let completedAt = null;
      let progressStatus = memberLookupFailed
        ? 'unavailable'
        : memberId
          ? 'member'
          : 'visitor';

      if (memberId) {
        try {
          const progResult = await wixData
            .query(CHALLENGE_PROGRESS_COLLECTION)
            .eq('memberId', memberId)
            .eq('challengeId', cId)
            .limit(1)
            .find({ suppressAuth: true });
          const rec = progResult.items[0];
          if (rec) {
            progressValue = rec.progressValue ?? 0;
            completedAt = rec.completedAt ?? null;
          }
        } catch (err) {
          logError(`getActiveChallengeOfWeek — progress lookup failed for ${memberId}`, err, { silent: true });
          progressStatus = 'unavailable';
        }
      }

      return {
        challengeId: cId,
        title: challenge.title,
        description: challenge.description || null,
        conditionType: challenge.conditionType,
        targetCount: challenge.targetCount,
        rewardPoints: challenge.rewardPoints ?? 0,
        progressValue,
        completedAt,
        progressStatus,
        expiresAt: challenge.expiresAt instanceof Date
          ? challenge.expiresAt.toISOString()
          : challenge.expiresAt,
        ctaUrl: challenge.ctaUrl || null,
      };
    } catch (err) {
      // cf-9lp.3: surface internal_error instead of bare null so callers can
      // distinguish a DB/internal failure from the legitimate no-featured-
      // challenge-this-week case (the `result.items.length === 0` branch
      // above). Mirrors cf-tlt (getActiveChallenges) and the cascade in
      // cf-9lp.1/.2; uses the project-wide `internal_error` convention.
      logError('getActiveChallengeOfWeek — failed', err);
      return { error: 'internal_error' };
    }
  }
);
