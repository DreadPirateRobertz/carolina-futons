/**
 * Badge icon renderer — generates inline SVG strings for achievement badges.
 *
 * Badges with an svgPath in BADGE_REGISTRY get a 48×48 circular SVG icon with
 * a Blue Ridge Mountain animal silhouette.  Badges without svgPath fall back to
 * the stored emoji icon (e.g. voice_of_mountain keeps 🏔️).
 *
 * CF-pf9
 */
import { BADGE_REGISTRY } from './gamificationTokens.js';
import { colors } from './sharedTokens.js';

/** Escape characters that are unsafe inside SVG attribute values. */
function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render a badge entry as an inline SVG (or emoji fallback, or empty string).
 *
 * @param {object|null|undefined} badge  Entry from BADGE_REGISTRY
 * @returns {string}
 */
export function renderBadgeIcon(badge) {
  if (!badge) return '';
  if (!badge.svgPath) return badge.icon || '';

  const label = escAttr(badge.svgLabel || badge.label || '');
  const color = escAttr(badge.svgColor || colors.badgeForestBlue);
  const path = escAttr(badge.svgPath);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${label}">` +
    `<circle cx="24" cy="24" r="22" fill="${color}" opacity="0.12"/>` +
    `<path d="${path}" fill="${color}"/>` +
    `</svg>`
  );
}

/**
 * Look up a badge by key and return its rendered icon.
 *
 * @param {string|null|undefined} badgeKey
 * @returns {string} SVG markup, emoji, or ''
 */
export function getBadgeIcon(badgeKey) {
  if (!badgeKey || !BADGE_REGISTRY[badgeKey]) return '';
  return renderBadgeIcon(BADGE_REGISTRY[badgeKey]);
}

// ── Sharp-shinned Hawk — streak chip icon ─────────────────────────────────────
//
// Distinct from the Red-Tailed Hawk (week_wanderer): Sharp-shinned is a compact
// accipiter — shorter, more rounded wings and a squared tail versus the broad
// buteo shape of a Red-Tail.  Pose: banking turn, wings half-folded.
//
const STREAK_HAWK_PATH =
  'M24 9 C21 9 18 11 17 13 L13 12 C11 11 10 13 12 15 L15 16 ' +
  'C14 19 14 22 16 25 L11 29 C9 31 11 34 13 32 L18 28 ' +
  'C19 31 21 34 23 37 L22 40 L24 39 L26 40 L25 37 ' +
  'C27 34 29 31 30 28 L35 32 C37 34 39 31 37 29 L32 25 ' +
  'C34 22 34 19 33 16 L36 15 C38 13 37 11 35 12 L31 13 ' +
  'C30 11 27 9 24 9Z';

const STREAK_HAWK_COLOR = colors.badgeAmber;

/**
 * Returns the inline SVG for the streak chip (Sharp-shinned Hawk).
 * @returns {string}
 */
export function getStreakChipIcon() {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="Sharp-shinned Hawk">` +
    `<circle cx="24" cy="24" r="22" fill="${STREAK_HAWK_COLOR}" opacity="0.12"/>` +
    `<path d="${STREAK_HAWK_PATH}" fill="${STREAK_HAWK_COLOR}"/>` +
    `</svg>`
  );
}
