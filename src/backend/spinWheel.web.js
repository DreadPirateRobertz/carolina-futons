/**
 * @module spinWheel.web
 * @description Spin wheel webMethods — daily spin with weighted prize draw,
 * eligibility checking, and prize award.
 *
 * Exported webMethods:
 *   spinWheel(memberId)          — execute a spin (rate-limited, server-side draw)
 *   getSpinEligibility(memberId) — read-only eligibility check for page load
 *
 * CF-ecs
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { getTierForPoints } from 'public/gamificationTokens.js';
import { logError } from 'backend/utils/errorHandler';
import { getTodayET } from 'backend/utils/dateUtils';
import { insertLedgerEntry } from 'backend/utils/memberPointsLedger';
import { getGamePrefsForMember } from 'backend/memberGamePreferences.web';
import { insertAnalyticsEvent } from 'backend/utils/analyticsEvents';

// ── Collections ──────────────────────────────────────────────────────────────

const SPIN_PRIZES = 'SpinPrizes';
const SPIN_HISTORY = 'SpinHistory';
const MEMBER_POINTS = 'MemberPoints';
const MEMBER_PENDING_PRIZES = 'MemberPendingPrizes';

// ── Constants ────────────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const FALLBACK_POINTS = 25;

/**
 * Milliseconds until next ET midnight. Uses Intl verification loop so the
 * result is correct regardless of server timezone or DST state.
 * Tries offsetHours 4 (EDT) and 5 (EST); the Intl check confirms which
 * candidate is actually midnight in America/New_York.
 */
function nextETMidnightMs() {
  const now = new Date();
  for (const offsetHours of [4, 5]) {
    const candidate = new Date(now);
    candidate.setUTCHours(offsetHours, 0, 0, 0);
    if (candidate <= now) {
      candidate.setUTCDate(candidate.getUTCDate() + 1);
    }
    const etHour = parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        hour12: false,
      }).format(candidate),
      10,
    );
    if (etHour === 0 || etHour === 24) {
      return candidate.getTime() - now.getTime();
    }
  }
  // Defensive fallback — should never reach here
  const fb = new Date(now);
  fb.setUTCHours(5, 0, 0, 0);
  if (fb <= now) fb.setUTCDate(fb.getUTCDate() + 1);
  return fb.getTime() - now.getTime();
}

// ── Eligibility helpers ──────────────────────────────────────────────────────

async function hasDailySpinToday(memberId) {
  const todayET = getTodayET();
  const res = await wixData.query(SPIN_HISTORY)
    .eq('memberId', memberId)
    .eq('spinDate', todayET)
    .eq('spinType', 'DAILY')
    .limit(1)
    .find({ suppressAuth: true });
  return res.items.length > 0;
}

async function getBonusSpinsAvailable(memberId) {
  const res = await wixData.query(MEMBER_POINTS)
    .eq('memberId', memberId)
    .limit(1)
    .find({ suppressAuth: true });
  return res.items.length > 0 ? (res.items[0].bonusSpinsAvailable || 0) : 0;
}

async function withinRateLimit(memberId) {
  const cutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  const res = await wixData.query(SPIN_HISTORY)
    .eq('memberId', memberId)
    .ge('createdAt', cutoff)
    .find({ suppressAuth: true });
  return res.items.length < RATE_LIMIT_MAX;
}

// ── Prize draw ───────────────────────────────────────────────────────────────

async function getActivePrizes() {
  const res = await wixData.query(SPIN_PRIZES)
    .eq('active', true)
    .find({ suppressAuth: true });
  return res.items;
}

function weightedDraw(prizes) {
  if (!prizes || prizes.length === 0) return null;
  const totalWeight = prizes.reduce((sum, p) => sum + (p.weight || 0), 0);
  if (totalWeight <= 0) return null;
  let rand = Math.random() * totalWeight;
  for (const p of prizes) {
    rand -= p.weight || 0;
    if (rand <= 0) return p;
  }
  return prizes[prizes.length - 1];
}

// ── Award helpers ────────────────────────────────────────────────────────────

async function awardPoints(memberId, points) {
  const res = await wixData.query(MEMBER_POINTS)
    .eq('memberId', memberId)
    .limit(1)
    .find({ suppressAuth: true });

  if (res.items.length > 0) {
    const rec = res.items[0];
    const previousBalance = rec.totalPoints || 0;
    const newBalance = previousBalance + points;
    await wixData.update(MEMBER_POINTS, {
      ...rec,
      totalPoints: newBalance,
      tier: getTierForPoints(newBalance),
    });
    return { previousBalance, newBalance };
  } else {
    await wixData.insert(MEMBER_POINTS, {
      memberId,
      totalPoints: points,
      tier: getTierForPoints(points),
    });
    return { previousBalance: 0, newBalance: points };
  }
}

async function awardNonPointsPrize(memberId, prize, spinHistoryId, eventId) {
  await wixData.insert(MEMBER_PENDING_PRIZES, {
    memberId,
    prizeType: prize.prizeType,
    prizeValue: prize.prizeValue,
    prizeLabel: prize.label,
    spinHistoryId,
    eventId,
    claimedAt: null,
    createdAt: new Date(),
  });
}

async function decrementBonusSpin(memberId) {
  const res = await wixData.query(MEMBER_POINTS)
    .eq('memberId', memberId)
    .limit(1)
    .find({ suppressAuth: true });

  if (res.items.length > 0 && (res.items[0].bonusSpinsAvailable || 0) > 0) {
    const rec = res.items[0];
    await wixData.update(MEMBER_POINTS, {
      ...rec,
      bonusSpinsAvailable: rec.bonusSpinsAvailable - 1,
    });
  }
}

// ── Exported webMethods ──────────────────────────────────────────────────────

/**
 * Read-only eligibility check — safe to call on page load, never writes.
 *
 * @param {string} memberId
 * @returns {Promise<{eligible: boolean, spinType?: string, reason?: string, bonusSpinsRemaining?: number, nextETMidnightMs?: number}>}
 */
export const getSpinEligibility = webMethod(
  Permissions.Member,
  async (memberId) => {
    if (!memberId) return { eligible: false, reason: 'NO_MEMBER' };
    try {
      const prefs = await getGamePrefsForMember(memberId);
      if (prefs.spinWheelVisible === false) {
        return { eligible: false, reason: 'PREF_DISABLED' };
      }
      if (!(await withinRateLimit(memberId))) {
        return { eligible: false, reason: 'RATE_LIMITED', spinType: null, nextETMidnightMs: nextETMidnightMs() };
      }
      const usedDaily = await hasDailySpinToday(memberId);
      if (!usedDaily) {
        return { eligible: true, spinType: 'DAILY', nextETMidnightMs: nextETMidnightMs() };
      }
      const bonus = await getBonusSpinsAvailable(memberId);
      if (bonus > 0) {
        return { eligible: true, spinType: 'BONUS', bonusSpinsRemaining: bonus, nextETMidnightMs: nextETMidnightMs() };
      }
      return { eligible: false, reason: 'ALREADY_SPUN', nextETMidnightMs: nextETMidnightMs() };
    } catch (err) {
      logError('spinWheel.getSpinEligibility', err);
      return { eligible: false, reason: 'ERROR' };
    }
  },
);

/**
 * Execute a spin: eligibility → weighted draw → history write → prize award.
 *
 * @param {string} memberId
 * @returns {Promise<{success: boolean, spinType?: string, prize?: Object, historyId?: string, eventId?: string, isFallback?: boolean, nextETMidnightMs?: number, error?: string}>}
 */
export const spinWheel = webMethod(
  Permissions.Member,
  async (memberId) => {
    if (!memberId) return { success: false, error: 'memberId is required' };
    try {
      // 1. Rate limit
      if (!(await withinRateLimit(memberId))) {
        return { success: false, error: 'RATE_LIMITED' };
      }

      // 2. Eligibility → spinType
      const usedDaily = await hasDailySpinToday(memberId);
      let spinType;
      if (!usedDaily) {
        spinType = 'DAILY';
      } else {
        const bonus = await getBonusSpinsAvailable(memberId);
        if (bonus > 0) {
          spinType = 'BONUS';
        } else {
          return { success: false, error: 'NOT_ELIGIBLE' };
        }
      }

      // 3. Weighted draw from active prizes
      const activePrizes = await getActivePrizes();
      let prize;
      let isFallback = false;

      if (activePrizes.length === 0) {
        prize = { prizeType: 'POINTS', pointsAwarded: FALLBACK_POINTS, label: '25 Bonus Points' };
        isFallback = true;
      } else {
        prize = weightedDraw(activePrizes);
        if (!prize) {
          prize = { prizeType: 'POINTS', pointsAwarded: FALLBACK_POINTS, label: '25 Bonus Points' };
          isFallback = true;
        }
      }

      const eventId = `spin_${memberId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const todayET = getTodayET();

      // 4. SpinHistory write — capture insertedHistory._id
      const insertedHistory = await wixData.insert(SPIN_HISTORY, {
        memberId,
        spinDate: todayET,
        spinType,
        prize: prize.label || prize.prizeType,
        pointsAwarded: prize.pointsAwarded || 0,
        prizeType: prize.prizeType,
        eventId,
        createdAt: new Date(),
      });

      // 5. Race guard re-query (DAILY only)
      if (spinType === 'DAILY') {
        const raceCheck = await wixData.query(SPIN_HISTORY)
          .eq('memberId', memberId)
          .eq('spinDate', todayET)
          .eq('spinType', 'DAILY')
          .find({ suppressAuth: true });
        if (raceCheck.items.length > 1) {
          await wixData.remove(SPIN_HISTORY, insertedHistory._id);
          return { success: false, error: 'RACE_CONDITION' };
        }
      }

      // 6. Award prize
      if (prize.prizeType === 'POINTS') {
        const { previousBalance, newBalance } = await awardPoints(memberId, prize.pointsAwarded);
        try {
          await insertLedgerEntry({
            memberId,
            traceId: `${memberId}_spin_${eventId}`,
            operationType: 'earn',
            delta: prize.pointsAwarded,
            reason: 'spin_wheel_prize',
            previousBalance,
            newBalance,
            sourceData: { prizeLabel: prize.label, spinType, eventId },
          });
        } catch (err) {
          logError(`spinWheel — ledger insert failed for ${memberId}`, err);
        }
      } else {
        await awardNonPointsPrize(memberId, prize, insertedHistory._id, eventId);
      }

      // 7. Decrement bonus spin (BONUS only)
      if (spinType === 'BONUS') {
        await decrementBonusSpin(memberId);
      }

      // CF-3wl: AnalyticsEvents pipeline — best-effort, never throws
      try {
        await insertAnalyticsEvent({ memberId, eventType: 'spin_wheel_spin', source: 'gamification', payload: { spinType, eventId } });
        await insertAnalyticsEvent({ memberId, eventType: 'spin_wheel_prize', source: 'gamification', payload: { prizeType: prize.prizeType, pointsAwarded: prize.pointsAwarded || 0, label: prize.label } });
      } catch (err) {
        logError('spinWheel — analytics insert failed', err);
      }

      return {
        success: true,
        spinType,
        prize: {
          type: prize.prizeType,
          label: prize.label,
          pointsAwarded: prize.pointsAwarded || 0,
          prizeValue: prize.prizeValue || null,
        },
        historyId: insertedHistory._id,
        eventId,
        isFallback,
        nextETMidnightMs: nextETMidnightMs(),
      };
    } catch (err) {
      logError('spinWheel.spinWheel', err);
      return { success: false, error: 'SPIN_FAILED' };
    }
  },
);
