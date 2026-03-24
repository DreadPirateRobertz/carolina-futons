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
