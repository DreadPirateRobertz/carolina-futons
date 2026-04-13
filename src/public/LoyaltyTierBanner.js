/**
 * LoyaltyTierBanner.js — Tier XP progress, badge, and active perks on the
 * member account page.  Hidden for guests to avoid layout shift.
 *
 * Elements:
 *   #tierBannerSection  Box            — hidden for guests; shown for members
 *   #tierBadgeIcon      HtmlComponent  — inline SVG tier badge
 *   #tierName           Text           — e.g. "Mountain Guide"
 *   #tierXpLabel        Text           — e.g. "450 / 500 XP to Summit Master"
 *   #tierXpFill         Box            — progress bar fill; style.width set to %
 *   #tierNextLabel      Text           — "Next tier: Summit Master" or "Max tier reached"
 *   #tierPerksRepeater  Repeater       — one item per perk (max 3)
 *     #perkText         Text           — perk description
 *   #tierStreakText     Text           — streak line, e.g. "🔥 7-day streak"
 *
 * CF-7bl
 */
import {
  getMemberTier as _defaultGetMemberTier,
  getStreakData as _defaultGetStreakData,
} from 'backend/gamificationEventReceiver.web';
import { getTierBadgeIcon } from './badgeIcons';
import { buildStreakChipText, shouldShowStreakChip } from './StreakDisplay';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute the XP progress percentage toward the next tier.
 * Returns 100 when already at the max tier.
 * @param {number} pointsInTier
 * @param {number} pointsToNextTier
 * @returns {number}  0–100
 */
function xpPercent(pointsInTier, pointsToNextTier) {
  if (!pointsToNextTier) return 100; // max tier
  const total = pointsInTier + pointsToNextTier;
  if (total <= 0) return 0;
  return Math.round((pointsInTier / total) * 100);
}

// ── Module init ───────────────────────────────────────────────────────────────

/**
 * Initialize the loyalty tier banner on the account page.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.$w]               — Wix selector
 * @param {Function} [opts.getCurrentMember] — returns current member or null
 * @param {Function} [opts.getMemberTier]    — backend getMemberTier(memberId)
 * @param {Function} [opts.getStreakData]    — backend getStreakData(memberId)
 * @returns {Promise<void>}
 */
export async function initLoyaltyTierBanner(opts = {}) {
  const $w               = opts.$w               ?? globalThis.$w;
  const getCurrentMember = opts.getCurrentMember
    ?? (() => import('wix-members-frontend').then(m => m.currentMember.getMember()));
  const getMemberTier    = opts.getMemberTier    ?? _defaultGetMemberTier;
  const getStreakData     = opts.getStreakData    ?? _defaultGetStreakData;

  // Start hidden — shown only for authenticated members with valid tier data
  try { $w('#tierBannerSection').hide(); } catch (_) {}

  let member;
  try { member = await getCurrentMember(); } catch (_) { member = null; }
  if (!member?._id) return; // guest or auth error

  const memberId = member._id;

  // Fetch tier and streak in parallel; treat each independently
  const [tierResult, streakResult] = await Promise.allSettled([
    getMemberTier(memberId),
    getStreakData(memberId),
  ]);

  const tier   = tierResult.status   === 'fulfilled' ? tierResult.value   : null;
  const streak = streakResult.status === 'fulfilled' ? streakResult.value : null;

  if (!tier) return; // tier fetch failed — keep banner hidden

  // ── Tier badge icon ───────────────────────────────────────────────────────

  try {
    const svg = getTierBadgeIcon(tier.tierName);
    const badgeEl = $w('#tierBadgeIcon');
    if (svg) {
      badgeEl.html = svg;
    } else {
      badgeEl.text = tier.tierName;
    }
  } catch (_) {}

  // ── Tier name ─────────────────────────────────────────────────────────────

  try { $w('#tierName').text = tier.tierName || ''; } catch (_) {}

  // ── XP progress ───────────────────────────────────────────────────────────

  const pct      = xpPercent(tier.pointsInTier ?? 0, tier.pointsToNextTier ?? 0);
  const nextName = tier.nextTierName;

  try {
    const xpText = nextName
      ? `${tier.pointsInTier ?? 0} / ${(tier.pointsInTier ?? 0) + (tier.pointsToNextTier ?? 0)} XP to ${nextName}`
      : `${tier.pointsInTier ?? 0} XP — max tier reached`;
    $w('#tierXpLabel').text = xpText;
  } catch (_) {}

  try {
    $w('#tierXpFill').style.width = `${pct}%`;
  } catch (_) {}

  // ── Next tier label ───────────────────────────────────────────────────────

  try {
    $w('#tierNextLabel').text = nextName
      ? `Next tier: ${nextName}`
      : 'Max tier reached';
  } catch (_) {}

  // ── Top-3 active perks ────────────────────────────────────────────────────
  // Why: showing more than 3 perks clutters the banner on mobile; the top-3
  // are the most valuable benefits (ordering established in TIER_BENEFITS). (CF-7bl)

  try {
    const perks = (tier.benefits ?? []).slice(0, 3);
    $w('#tierPerksRepeater').onItemReady(($item, itemData) => {
      try { $item('#perkText').text = itemData.text; } catch (_) {}
    });
    $w('#tierPerksRepeater').data = perks.map((p, i) => ({ _id: `perk-${i}`, text: p }));
  } catch (_) {}

  // ── Streak ────────────────────────────────────────────────────────────────

  try {
    const streakDays = streak?.currentStreak ?? 0;
    const streakEl   = $w('#tierStreakText');
    if (shouldShowStreakChip(streakDays)) {
      streakEl.text = buildStreakChipText(streakDays);
      streakEl.show();
    } else {
      streakEl.hide();
    }
  } catch (_) {}

  // ── Show banner ───────────────────────────────────────────────────────────

  try { $w('#tierBannerSection').show(); } catch (_) {}
}
