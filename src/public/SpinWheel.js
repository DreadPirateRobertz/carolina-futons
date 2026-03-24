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

// ── createSpinWheelAudio ──────────────────────────────────────────────

/**
 * Create Web Audio API helpers for the spin wheel.
 * AudioContext is created lazily on first call (must be on a user gesture).
 * Returns no-op functions when prefers-reduced-motion is set or AudioContext
 * is unavailable (e.g. SSR / test environments).
 *
 * @param {Window|null} [win] - Window object; defaults to the global window (injectable for tests).
 * @returns {{ playTick: () => void, playWin: () => void }}
 */
export function createSpinWheelAudio(win) {
  const w = win !== undefined ? win : (typeof window !== 'undefined' ? window : null);
  if (!w) return { playTick: () => {}, playWin: () => {} };

  const reducedMotion = typeof w.matchMedia === 'function'
    && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return { playTick: () => {}, playWin: () => {} };

  const AudioCtx = w.AudioContext || w.webkitAudioContext;
  if (!AudioCtx) return { playTick: () => {}, playWin: () => {} };

  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new AudioCtx();
    return ctx;
  }
  function playTone(freq, duration) {
    try {
      const context = getCtx();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.connect(gain);
      gain.connect(context.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
      osc.start();
      osc.stop(context.currentTime + duration);
    } catch (e) { /* AudioContext unavailable or suspended */ }
  }

  return {
    playTick: () => playTone(800, 0.05),
    playWin: () => playTone(1200, 0.3),
  };
}

// ── buildShareCard ────────────────────────────────────────────────────

/** Escape characters that are unsafe inside SVG text content. */
function escapeSvgText(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a branded SVG share card for a spin win.
 * Suitable for display in an <img> src, Blob URL, or HtmlComponent.
 *
 * @param {{prize: string, prizeType: string, pointsAwarded?: number}} result
 * @returns {string} SVG markup string
 */
export function buildShareCard({ prize, prizeType, pointsAwarded } = {}) {
  const isPoints = prizeType === 'POINTS';
  const headline = escapeSvgText(
    isPoints
      ? `I won ${pointsAwarded ?? 0} bonus points!`
      : `I won ${prize || 'a prize'}!`,
  );
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" role="img" aria-label="Spin win share card">',
    '<rect width="400" height="200" rx="12" fill="#2d6a4f"/>',
    '<text x="200" y="72" font-family="sans-serif" font-size="26" font-weight="bold" fill="#FAF7F2" text-anchor="middle">Carolina Futons</text>',
    `<text x="200" y="118" font-family="sans-serif" font-size="22" fill="#FAF7F2" text-anchor="middle">${headline}</text>`,
    '<text x="200" y="162" font-family="sans-serif" font-size="13" fill="#b5e8c8" text-anchor="middle">Spin the wheel at carolinafutons.com</text>',
    '</svg>',
  ].join('');
}
