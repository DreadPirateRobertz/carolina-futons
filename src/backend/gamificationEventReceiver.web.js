/**
 * @module gamificationEventReceiver.web
 * @description Wix backend webMethod for receiving gamification events from the mobile app.
 * Awards points to members based on trackEvent calls and returns updated tier state.
 * After awarding points, checks BonusSpinGrants for active grants matching the event
 * and increments bonusSpinsAvailable on MemberPoints accordingly.
 *
 * Supported events:
 *   gamification_add_to_cart      — +5 pts
 *   gamification_submit_review    — +50 pts (+25 bonus if has_photo)
 *   gamification_referral_shared  — +100 pts
 *   gamification_order_complete   — +Math.floor(orderTotal) pts (0 if missing)
 *   gamification_ar_used          — +POINT_VALUES.AR_USED (10 pts)
 *   gamification_wishlist_add     — +POINT_VALUES.WISHLIST_ADD (2 pts), capped at 5/day
 *   gamification_spin_completed   — +0 pts (tracked for bonus-spin grant only)
 *   (unknown)                     — no-op, returns current total
 *
 * CF-eo88, CF-9l0
 */

import { Permissions, webMethod } from 'wix-web-module';
import { POINT_VALUES, STREAK_RECOVERY_COST, getTierForPoints, getStreakMultiplier } from 'public/gamificationTokens.js';
import { logError } from 'backend/utils/errorHandler';
import { getTodayET, getYesterdayOf, tsToETDate } from 'backend/utils/dateUtils';
import wixData from 'wix-data';
import { recordChallengeCompleteEvent } from 'backend/loyaltyService.web';
import { insertLedgerEntry } from 'backend/utils/memberPointsLedger';

const MEMBER_POINTS_COLLECTION = 'MemberPoints';
const MEMBER_BADGES_COLLECTION = 'MemberBadges';
const BONUS_SPIN_GRANTS_COLLECTION = 'BonusSpinGrants';
const CHALLENGE_PROGRESS_COLLECTION = 'MemberChallengeProgress';
const WISHLIST_ADD_LOG_COLLECTION = 'WishlistAddLog';
const WISHLIST_DAILY_CAP = 5;
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

/**
 * Receive a gamification event and award points to the member.
 *
 * @param {string} eventName  - e.g. 'gamification_add_to_cart'
 * @param {Object} payload    - Event-specific data (product_id, has_photo, etc.)
 * @param {string} memberId   - Wix member ID
 * @returns {Promise<{success: boolean, newTotal?: number, tierChanged?: boolean, newTier?: string, error?: string}>}
 */
export const receiveGamificationEvent = webMethod(
  Permissions.Member,
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

      // Phase 4: wishlist daily cap — use same event-derived date as streak logic
      const capResult = eventName === 'gamification_wishlist_add'
        ? await checkWishlistDailyCap(memberId, todayET)
        : null;
      const canEarnWishlist = capResult?.canEarn ?? false;
      const effectiveBase = eventName !== 'gamification_wishlist_add' || canEarnWishlist
        ? basePoints
        : 0;

      // Apply streak multiplier to effective base points
      const adjustedPoints = Math.round(effectiveBase * streakState.streakMultiplier);
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
      };

      if (record) {
        await wixData.update(MEMBER_POINTS_COLLECTION, { ...record, ...updatedRecord });
      } else {
        await wixData.insert(MEMBER_POINTS_COLLECTION, { memberId, ...updatedRecord });
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
      if (streakState.milestoneBonus > 0) {
        try {
          await wixData.insert(MEMBER_BADGES_COLLECTION, {
            _id: `${memberId}_week_wanderer`,
            memberId,
            badgeId: 'week_wanderer',
          });
        } catch (err) {
          const msg = String(err?.message ?? err).toLowerCase();
          const isDuplicate = msg.includes('duplicate') || msg.includes('unique constraint');
          logError(`gamificationEventReceiver — badge award failed for ${memberId}`, err, { silent: isDuplicate });
        }
      }

      return {
        success: true,
        newTotal,
        tierChanged,
        newTier,
        currentStreakDays: streakState.currentStreakDays,
        streakMultiplier: streakState.streakMultiplier,
        milestoneUnlocked: streakState.milestoneBonus > 0,
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
    case 'gamification_order_complete':
      return Math.floor(payload?.orderTotal || 0);
    case 'gamification_spin_completed':
      return 0;
    case 'gamification_ar_used':
      return POINT_VALUES.AR_USED;
    case 'gamification_wishlist_add':
      return POINT_VALUES.WISHLIST_ADD;
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
async function findMemberRecord(memberId) {
  const results = await wixData.query(MEMBER_POINTS_COLLECTION)
    .eq('memberId', memberId)
    .limit(1)
    .find({ suppressAuth: true });
  return results.items.length > 0 ? results.items[0] : null;
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

  // Branch 1: already active today — no change
  if (lastActivity === todayET) {
    return {
      currentStreakDays: existingDays,
      streakStartDate: existingStart,
      lastActivityDate: todayET,
      streakMultiplier: existingMultiplier,
      milestoneBonus: 0,
      graceTokenUsedDate: graceUsed,
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
    };
  }

  // Branch 3b: missed 2+ days, or grace already used — reset streak
  return {
    currentStreakDays: 1,
    streakStartDate: todayET,
    lastActivityDate: todayET,
    streakMultiplier: 1,
    milestoneBonus: 0,
    graceTokenUsedDate: graceUsed, // preserve existing (not consumed)
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
export async function updateChallengeProgress(memberId, challenge, eventId, now) {
  const { challengeId, title, targetCount } = challenge;
  const base = { challengeId, title, targetCount };

  try {
    const results = await wixData
      .query(CHALLENGE_PROGRESS_COLLECTION)
      .eq('memberId', memberId)
      .eq('challengeId', challengeId)
      .find();

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
      await wixData.update(CHALLENGE_PROGRESS_COLLECTION, updatedRecord);
    } else {
      await wixData.insert(CHALLENGE_PROGRESS_COLLECTION, updatedRecord);
    }

    return { ...base, progressValue: newProgress, justCompleted, completedAt };
  } catch (err) {
    logError(`updateChallengeProgress — failed for member ${memberId} challenge ${challengeId}`, err, { silent: true });
    return { ...base, progressValue: 0, justCompleted: false, completedAt: null, progressError: true };
  }
}

// ── Phase 4: Wishlist daily cap helpers ───────────────────────────────────────

/**
 * Check whether a member can earn points for a wishlist add today.
 * Returns { canEarn: true } when count < WISHLIST_DAILY_CAP (5); { canEarn: false } when at cap.
 * Fails open on DB error — members earn points rather than being silently blocked.
 *
 * @param {string} memberId
 * @param {string} todayET  - ET date string e.g. "2026-03-22"
 * @returns {Promise<{ canEarn: boolean, count: number }>}
 */
export async function checkWishlistDailyCap(memberId, todayET) {
  try {
    const results = await wixData.query(WISHLIST_ADD_LOG_COLLECTION)
      .eq('memberId', memberId)
      .eq('date', todayET)
      .find({ suppressAuth: true });
    const count = results.items.length;
    // Note: this cap is best-effort under concurrent load — Wix Data has no atomic
    // increment, so two rapid simultaneous wishlist adds could both pass the check.
    return { canEarn: count < WISHLIST_DAILY_CAP, count };
  } catch (err) {
    // Fail open — member earns points if the cap check itself is broken
    logError(`checkWishlistDailyCap — query failed for member ${memberId} on ${todayET}`, err, { silent: true });
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
  await wixData.insert(WISHLIST_ADD_LOG_COLLECTION, { memberId, date: todayET });
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
  Permissions.Member,
  async (memberId) => {
    if (!memberId) return { challenges: [] };

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

      // Filter expired, sort by expiresAt ASC, cap at 5
      const active = challengeResults.items
        .filter(c => c.expiresAt && new Date(c.expiresAt) > nowDate)
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
      logError(`getActiveChallenges — failed for member ${memberId}`, err);
      return { challenges: [] };
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
  Permissions.Member,
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
        .find();
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
        .find();
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
        });
      } else {
        await wixData.insert(CHALLENGE_PROGRESS_COLLECTION, {
          memberId,
          challengeId,
          progressValue: newProgress,
          completedAt,
        });
      }

      let pointsAwarded = 0;
      if (completed && challenge.rewardPoints) {
        pointsAwarded = challenge.rewardPoints;
        const mpQuery = await wixData
          .query(MEMBER_POINTS_COLLECTION)
          .eq('memberId', memberId)
          .find();
        const mp = mpQuery.items[0];
        if (mp) {
          await wixData.update(MEMBER_POINTS_COLLECTION, {
            ...mp,
            totalPoints: mp.totalPoints + pointsAwarded,
          });
        } else {
          await wixData.insert(MEMBER_POINTS_COLLECTION, {
            memberId,
            totalPoints: pointsAwarded,
          });
        }
      }

      if (completed && challenge.rewardPoints > 0) {
        try {
          await recordChallengeCompleteEvent(memberId, challengeId, challenge.rewardPoints);
        } catch (err) {
          logError(`recordChallengeProgress — PointsLedger write failed for member ${memberId} challenge ${challengeId}`, err);
        }
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
  Permissions.Member,
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
      };
      // NOTE: When CF-ledger lands this will become two sequential wixData writes
      // with no rollback. If the ledger insert fails after the points deduction,
      // the member is debited with no audit trail. Track in CF-ledger story.
      await wixData.update(MEMBER_POINTS_COLLECTION, updatedRecord);

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
