/**
 * @module SpinWheel
 * @description Pure frontend helpers for the spin-the-wheel gamification feature.
 *
 * Exports four pure functions consumed by the Member Page spin section:
 *   - buildWheelSegments(prizes)       — arc-proportional segment data
 *   - computeCountdown(nextSpinAt, nowMs) — hours/minutes/seconds until spin
 *   - renderPendingPrizes(pending)     — PENDING prizes mapped to display labels
 *   - renderSpinResult({prize, prizeType, pointsAwarded}) — headline + flags
 *
 * No Wix imports — fully portable, testable with Vitest.
 * CF-e27
 */

// ── Constants ─────────────────────────────────────────────────────────

/** Mountain palette for wheel segment backgrounds. */
export const SEGMENT_COLORS = ['#7c6af7', '#2d6a4f', '#b5451b'];

/** Human-readable labels for each prize type. */
const PRIZE_LABELS = {
  FREE_SHIP: 'Free Shipping',
  DISCOUNT_PCT: 'Discount',
  SWATCH: 'Free Swatch',
  POINTS: 'Bonus Points',
};

// ── buildWheelSegments ────────────────────────────────────────────────

/**
 * Build arc-proportional wheel segments from a list of prizes.
 * Filters out inactive prizes. Arc angle for each segment is proportional
 * to its weight relative to the total weight (same formula as server draw).
 *
 * @param {Array<{name: string, weight: number, active?: boolean}>} prizes
 * @returns {Array<{name: string, weight: number, angle: number, color: string}>}
 */
export function buildWheelSegments(prizes) {
  if (!Array.isArray(prizes) || prizes.length === 0) return [];

  const active = prizes.filter((p) => p.active !== false);
  if (active.length === 0) return [];

  const totalWeight = active.reduce((sum, p) => sum + (p.weight || 0), 0);
  if (totalWeight <= 0) return [];

  return active.map((p, i) => ({
    name: p.name,
    weight: p.weight,
    angle: (p.weight / totalWeight) * 360,
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }));
}

// ── computeCountdown ──────────────────────────────────────────────────

/**
 * Compute hours, minutes, seconds remaining until the next spin.
 * Returns zeros when nextSpinAt is in the past (or missing).
 * Accepts nowMs for deterministic testing.
 *
 * @param {string|number|Date} nextSpinAt - ISO string, epoch ms, or Date
 * @param {number} [nowMs=Date.now()] - current time in epoch ms
 * @returns {{hours: number, minutes: number, seconds: number}}
 */
export function computeCountdown(nextSpinAt, nowMs) {
  const now = typeof nowMs === 'number' ? nowMs : Date.now();
  const target = new Date(nextSpinAt).getTime();
  const diff = target - now;

  if (!Number.isFinite(diff) || diff <= 0) {
    return { hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSeconds = Math.floor(diff / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

// ── renderPendingPrizes ───────────────────────────────────────────────

/**
 * Filter to PENDING prizes and map each to a display label.
 * Non-PENDING statuses (e.g. REDEEMED, EXPIRED) are excluded.
 *
 * @param {Array<{status: string, prizeType: string, name?: string}>} pending
 * @returns {Array<{prizeType: string, label: string, name?: string}>}
 */
export function renderPendingPrizes(pending) {
  if (!Array.isArray(pending)) return [];

  return pending
    .filter((p) => p.status === 'PENDING')
    .map((p) => ({
      prizeType: p.prizeType,
      label: PRIZE_LABELS[p.prizeType] || p.prizeType,
      ...(p.name ? { name: p.name } : {}),
    }));
}

// ── renderSpinResult ──────────────────────────────────────────────────

/**
 * Build display data for a spin result.
 * Sets isPoints flag for POINTS-type prizes. Headline includes
 * the points amount for point prizes, or the prize name otherwise.
 *
 * @param {{prize: string, prizeType: string, pointsAwarded?: number}} result
 * @returns {{headline: string, isPoints: boolean, prize: string, prizeType: string}}
 */
export function renderSpinResult({ prize, prizeType, pointsAwarded } = {}) {
  const isPoints = prizeType === 'POINTS';

  const headline = isPoints
    ? `You won ${pointsAwarded ?? 0} points!`
    : `You won ${prize}!`;

  return {
    headline,
    isPoints,
    prize: prize || '',
    prizeType: prizeType || '',
  };
}
