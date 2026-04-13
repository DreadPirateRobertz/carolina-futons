/**
 * @module LoyaltyBadgeWidget
 * @description Compact loyalty tier badge + streak indicator for Collection
 * and Category pages. Shows member's current tier badge and active streak
 * without the full tier-progress UI. Hidden for guests (no layout shift).
 *
 * Elements (no-op if absent):
 *   #loyaltyBadgeContainer — Box wrapper; hidden for guests
 *   #loyaltyTierBadge      — HtmlComponent or Text; receives tier badge SVG / name
 *   #loyaltyStreakText     — Text; receives streak chip text (hidden when streak < 1)
 *
 * CF-gamif2
 */
import {
  getMemberTier as _defaultGetMemberTier,
  getStreakData as _defaultGetStreakData,
} from 'backend/gamificationEventReceiver.web';
import { getTierBadgeIcon } from './badgeIcons';
import { buildStreakChipText, shouldShowStreakChip } from './StreakDisplay';

/**
 * Initialise the loyalty badge widget on a collection or category page.
 *
 * Fetches tier and streak data for the current member in parallel.
 * For unauthenticated visitors, keeps #loyaltyBadgeContainer hidden so
 * there is no layout shift.
 *
 * @param {Object} [opts]                    - Injectable overrides for testing
 * @param {Function} [opts.$w]               - Wix selector
 * @param {Function} [opts.getCurrentMember] - Returns current member or null
 * @param {Function} [opts.getMemberTier]    - Backend getMemberTier(memberId)
 * @param {Function} [opts.getStreakData]    - Backend getStreakData(memberId)
 * @returns {Promise<void>}
 */
export async function initLoyaltyBadge(opts = {}) {
  const $w = opts.$w ?? globalThis.$w;
  const getCurrentMember = opts.getCurrentMember
    ?? (() => import('wix-members-frontend').then(m => m.currentMember.getMember()));
  const getMemberTier = opts.getMemberTier ?? _defaultGetMemberTier;
  const getStreakData = opts.getStreakData ?? _defaultGetStreakData;

  // Start hidden — reveal only for authenticated members with valid tier data.
  try { $w('#loyaltyBadgeContainer').hide(); } catch (_) {}

  // Resolve current member.
  let member;
  try { member = await getCurrentMember(); } catch (_) { member = null; }
  if (!member?._id) return; // guest or auth error — keep container hidden

  const memberId = member._id;

  // Fetch tier and streak in parallel; treat each failure independently.
  const [tierResult, streakResult] = await Promise.allSettled([
    getMemberTier(memberId),
    getStreakData(memberId),
  ]);

  const tier = tierResult.status === 'fulfilled' ? tierResult.value : null;
  const streak = streakResult.status === 'fulfilled' ? streakResult.value : null;

  if (!tier) return; // tier fetch failed — keep container hidden

  // ── Tier badge ───────────────────────────────────────────────────────────────
  try {
    const svg = getTierBadgeIcon(tier.tierName);
    const badgeEl = $w('#loyaltyTierBadge');
    if (svg) {
      badgeEl.html = svg;
    } else {
      badgeEl.text = tier.tierName;
    }
  } catch (_) {}

  // ── Streak text ──────────────────────────────────────────────────────────────
  try {
    const streakDays = streak?.currentStreak ?? 0;
    const streakEl = $w('#loyaltyStreakText');
    if (shouldShowStreakChip(streakDays)) {
      streakEl.text = buildStreakChipText(streakDays);
      streakEl.show();
    } else {
      streakEl.hide();
    }
  } catch (_) {}

  // Reveal the container only when we have something to show.
  try { $w('#loyaltyBadgeContainer').show(); } catch (_) {}
}
