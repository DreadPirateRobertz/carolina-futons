/**
 * @module GamificationProductChip
 * @description Renders the member's loyalty tier badge on any page —
 * product pages and nav (masterPage). Shows a compact chip with the
 * tier badge icon and tier name so loyalty presence is ambient, not
 * confined to the Member Page.
 *
 * Elements used (no-op if absent):
 *   #memberTierChip      — Container or text element; receives tier + badge text
 *   #memberPointsChip    — Optional text element; receives formatted points balance
 *
 * CF-e2r
 */
import { getMyLoyaltyAccount } from 'backend/loyaltyService.web';
import { getTierIcon, getTierColor } from 'public/loyaltyHelpers';

/**
 * Format the tier chip label: badge icon + tier name.
 * Exported for unit testing.
 *
 * @param {Object|null} account - Loyalty account from getMyLoyaltyAccount
 * @returns {string} e.g. "🔵 Trail Blazer" or ''
 */
export function formatTierChipLabel(account) {
  if (!account || !account.tier) return '';
  const icon = getTierIcon(account.tier);
  return icon ? `${icon} ${account.tier}` : account.tier;
}

/**
 * Format the points chip label.
 * Exported for unit testing.
 *
 * @param {Object|null} account - Loyalty account from getMyLoyaltyAccount
 * @returns {string} e.g. "350 pts" or ''
 */
export function formatPointsChipLabel(account) {
  if (!account) return '';
  const balance = account.points?.balance ?? account.points ?? null;
  if (balance == null) return '';
  return `${balance} pts`;
}

/**
 * Render the member's tier badge chip on a page.
 * No-ops gracefully if elements are absent or account is null.
 *
 * @param {Function} $wFn - Wix selector ($w)
 * @param {Object|null} account - Loyalty account from getMyLoyaltyAccount
 */
export function renderTierChip($wFn, account) {
  try {
    const chip = $wFn('#memberTierChip');
    if (chip) {
      const label = formatTierChipLabel(account);
      if (label) {
        chip.text = label;
        if (account?.tier) chip.style.color = getTierColor(account.tier);
        chip.show();
      } else {
        chip.hide();
      }
    }
  } catch (err) {
    console.warn('[GamificationProductChip] renderTierChip failed:', err?.message ?? err);
  }

  try {
    const pointsEl = $wFn('#memberPointsChip');
    if (pointsEl) {
      const label = formatPointsChipLabel(account);
      if (label) {
        pointsEl.text = label;
        pointsEl.show();
      } else {
        pointsEl.hide();
      }
    }
  } catch (err) {
    console.warn('[GamificationProductChip] renderPointsChip failed:', err?.message ?? err);
  }
}

/**
 * Format the compact card chip label used on collection/category product
 * grids. Combines tier and points so a member sees their standing while
 * browsing. Exported for unit testing.
 *
 * CF-pyw
 *
 * @param {Object|null} account - Loyalty account from getMyLoyaltyAccount
 * @returns {string} e.g. "🔵 Trail Blazer · 200 pts", or tier-only, or points-only, or ''
 */
export function formatCardChipLabel(account) {
  const tierLabel   = formatTierChipLabel(account);
  const pointsLabel = formatPointsChipLabel(account);
  if (tierLabel && pointsLabel) return `${tierLabel} · ${pointsLabel}`;
  return tierLabel || pointsLabel || '';
}

/**
 * Render the gamification chip on a single product card within a
 * collection/category repeater. Called from the repeater's onItemReady
 * with the per-item selector ($item). No-ops gracefully if the chip
 * element is absent (template without the chip) or if $item throws
 * (item not mounted). Hides the chip for unauthenticated visitors.
 *
 * CF-pyw
 *
 * @param {Function} $item - Repeater item selector
 * @param {Object|null} account - Loyalty account from getMyLoyaltyAccount
 */
export function renderCardGamificationChip($item, account) {
  try {
    const chip = $item('#gridGamificationChip');
    if (!chip) return;
    const label = formatCardChipLabel(account);
    if (label) {
      chip.text = label;
      if (account?.tier) chip.style.color = getTierColor(account.tier);
      chip.show();
    } else {
      chip.hide();
    }
  } catch (err) {
    console.warn('[GamificationProductChip] renderCardGamificationChip failed:', err?.message ?? err);
  }
}

/**
 * Format a compact chip label combining badge count, streak, and points.
 * Used by renderBadgeStreakChip for the richer category-page overlay.
 *
 * cf-tcs
 *
 * @param {{ points: number, tier: string|null, streak: number, badges: string[], hasActivity: boolean }|null} chips
 * @returns {string} e.g. "🏅 2 badges · 🔥 5d streak · 420 pts", or ''
 */
export function formatBadgeStreakChipLabel(chips) {
  if (!chips || !chips.hasActivity) return '';
  const parts = [];
  if (chips.badges && chips.badges.length > 0) {
    parts.push(`🏅 ${chips.badges.length} badge${chips.badges.length === 1 ? '' : 's'}`);
  }
  if (chips.streak > 0) {
    parts.push(`🔥 ${chips.streak}d streak`);
  }
  if (chips.points > 0) {
    parts.push(`${chips.points} pts`);
  }
  return parts.join(' · ');
}

/**
 * Render badge, streak, and points chips on a single product card.
 * Targets #gridGamificationChip (combined label) and optionally
 * #gridBadgeChip, #gridStreakChip as separate elements.
 * No-ops gracefully if elements are absent.
 *
 * cf-tcs
 *
 * @param {Function} $item - Repeater item selector
 * @param {{ points: number, tier: string|null, streak: number, badges: string[], hasActivity: boolean }|null} chips
 */
export function renderBadgeStreakChip($item, chips) {
  try {
    const label = formatBadgeStreakChipLabel(chips);
    const chip = $item('#gridGamificationChip');
    if (!chip) return;
    if (label) {
      chip.text = label;
      chip.show();
    } else {
      chip.hide();
    }
  } catch (err) {
    console.warn('[GamificationProductChip] renderBadgeStreakChip failed:', err?.message ?? err);
  }

  // Optional separate badge chip
  try {
    const badgeChip = $item('#gridBadgeChip');
    if (badgeChip) {
      const count = chips?.badges?.length ?? 0;
      if (count > 0) {
        badgeChip.text = `🏅 ${count} badge${count === 1 ? '' : 's'}`;
        badgeChip.show();
      } else {
        badgeChip.hide();
      }
    }
  } catch (_) {}

  // Optional separate streak chip
  try {
    const streakChip = $item('#gridStreakChip');
    if (streakChip) {
      const streak = chips?.streak ?? 0;
      if (streak > 0) {
        streakChip.text = `🔥 ${streak}d`;
        streakChip.show();
      } else {
        streakChip.hide();
      }
    }
  } catch (_) {}
}

/**
 * Initialise the member tier chip on any page.
 * Fetches the loyalty account and renders the chip elements.
 * Silently no-ops for unauthenticated visitors (null account).
 *
 * @param {Object} [opts]
 * @param {Function} [opts.$w]                  - Injectable $w for testing
 * @param {Function} [opts.getMyLoyaltyAccount] - Injectable backend call for testing
 * @returns {Promise<Object|null>} The account, or null if unauthenticated/error
 */
export async function initMemberTierChip(opts = {}) {
  const $wFn    = opts.$w || globalThis.$w;
  const getAcct = opts.getMyLoyaltyAccount || getMyLoyaltyAccount;

  let account = null;
  try {
    account = await getAcct();
  } catch (_) {
    // Not logged in or backend error — hide chips
  }

  renderTierChip($wFn, account);
  return account;
}
