/**
 * @module LoyaltyDashboard
 * @description Velo frontend module for the loyalty tier progress bar,
 * tier badge, and tier-up milestone popup on the Member Page.
 *
 * Calls getMyLoyaltyAccount() once on page load, then updates:
 *   #loyaltyProgressBar  — Wix ProgressBar (.progress 0–100)
 *   #loyaltyTierBadge    — Text element showing icon + tier name
 *   #tierUpModal         — Container revealed on tier-up milestone
 *   #tierUpModalText     — Text element inside the modal
 *
 * Tier-up detection uses sessionStorage so the popup fires only once per
 * browser session on the first visit after earning a new tier.
 *
 * CF-gkgv: Loyalty tier progress bar + milestone popups
 *
 * @example
 *   // In Member Page code (page file):
 *   import { initLoyaltyDashboard } from 'public/LoyaltyDashboard';
 *   $w.onReady(() => initLoyaltyDashboard());
 */
import { getMyLoyaltyAccount, getMyBurnRate } from 'backend/loyaltyService.web';
import { saveBirthday, getBirthdayStatus } from 'backend/loyaltyMarketing.web';
import {
  formatProgressText,
  getProgressPercent,
  getTierColor,
  getTierIcon,
} from 'public/loyaltyHelpers';

// ── Constants ─────────────────────────────────────────────────────────

const TIER_KEY = 'cf_loyalty_tier';

const TIER_ORDER = ['Bronze', 'Silver', 'Gold'];

/** Congratulatory messages shown when a member earns a new tier. */
const TIER_UP_MESSAGES = {
  Silver: "You've reached Silver status! Enjoy 5% off your next order.",
  Gold:   "Welcome to Gold! Enjoy 10% off every order going forward.",
};

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Resolve injectable $w from opts or fall back to globalThis.$w.
 * @param {Object} opts
 * @returns {Function}
 */
function get$w(opts) {
  return opts.$w || globalThis.$w;
}

/**
 * Resolve injectable sessionStorage from opts or fall back to the global.
 * Returns null if sessionStorage is unavailable (SSR context or blocked
 * cross-origin iframe). Modern browsers expose sessionStorage in private
 * browsing, so null here indicates a non-browser environment.
 * @param {Object} opts
 * @returns {Object|null}
 */
function getStorage(opts) {
  if ('storage' in opts) return opts.storage;
  try { return sessionStorage; } catch (_) { return null; }
}

/**
 * Resolve injectable getMyLoyaltyAccount from opts or use the backend import.
 * @param {Object} opts
 * @returns {Function}
 */
function getAccountFn(opts) {
  return opts.getMyLoyaltyAccount || getMyLoyaltyAccount;
}

/**
 * Resolve injectable getMyBurnRate from opts or use the backend import.
 * @param {Object} opts
 * @returns {Function}
 */
function getBurnRateFn(opts) {
  return opts.getMyBurnRate || getMyBurnRate;
}

// ── Render helpers ────────────────────────────────────────────────────

/**
 * Update the #loyaltyProgressBar element.
 * Sets .progress (0–100) and .label to the human-readable progress text.
 * No-ops if the element does not exist on this page ($wFn returns null) or
 * if $wFn itself throws (element not yet mounted). Unexpected errors are
 * logged before being swallowed so production issues remain diagnosable.
 *
 * @param {Function} $wFn
 * @param {Object} account - Loyalty account from getMyLoyaltyAccount
 */
export function renderProgressBar($wFn, account) {
  try {
    const bar = $wFn('#loyaltyProgressBar');
    if (!bar) return;
    bar.progress = getProgressPercent(account);
    bar.label    = formatProgressText(account);
  } catch (err) {
    console.warn('[LoyaltyDashboard] renderProgressBar failed:', err?.message ?? err);
  }
}

/**
 * Update the #loyaltyTierBadge text element.
 * Renders the tier icon + tier name; sets font color to the tier colour.
 * No-ops if the element does not exist on this page or if $wFn throws.
 * Unexpected errors are logged before being swallowed.
 *
 * @param {Function} $wFn
 * @param {Object} account - Loyalty account from getMyLoyaltyAccount
 */
export function renderTierBadge($wFn, account) {
  try {
    const badge = $wFn('#loyaltyTierBadge');
    if (!badge) return;
    const tier = account?.tier || 'Bronze';
    badge.text        = `${getTierIcon(tier)} ${tier}`;
    badge.style.color = getTierColor(tier);
  } catch (err) {
    console.warn('[LoyaltyDashboard] renderTierBadge failed:', err?.message ?? err);
  }
}

/**
 * Check whether the member has just crossed a tier threshold this session.
 * Compares the stored previous tier (sessionStorage) to the current tier.
 * On a tier-up, shows the #tierUpModal popup.
 *
 * Storage writes are attempted independently of the tier comparison so a
 * write failure (e.g. quota exceeded) does not suppress the popup.
 * Skips gracefully when account.tier is absent, storage is unavailable, or
 * the stored value is not a recognised tier name.
 *
 * @param {Function} $wFn
 * @param {Object} account - Loyalty account from getMyLoyaltyAccount
 * @param {Object|null} storage - sessionStorage-like object (or null)
 */
export function checkTierUp($wFn, account, storage) {
  const currentTier = account?.tier;
  if (!currentTier) return;

  if (!storage) return; // No storage — tier-up detection not possible

  let prevTier = null;
  try {
    prevTier = storage.getItem(TIER_KEY);
  } catch (_) {
    // getItem failed — can't determine previous tier; skip tier-up detection
    return;
  }

  // Persist current tier independently — write failure must not block popup.
  try {
    storage.setItem(TIER_KEY, currentTier);
  } catch (_) { /* non-fatal — popup fires regardless */ }

  if (!prevTier) return; // First visit — no previous tier to compare

  const prevIdx    = TIER_ORDER.indexOf(prevTier);
  const currentIdx = TIER_ORDER.indexOf(currentTier);

  // Skip if either tier is unrecognised (stale storage from a renamed tier).
  if (prevIdx < 0 || currentIdx < 0) return;

  if (currentIdx > prevIdx) {
    showTierUpModal($wFn, currentTier);
  }
}

/**
 * Show the tier-up celebration modal with the appropriate message.
 * No-ops if either modal element is absent. Accepts any tier name; uses a
 * generic fallback message for tiers not in TIER_UP_MESSAGES.
 * Unexpected errors are logged before being swallowed.
 *
 * @param {Function} $wFn
 * @param {string} tier - The new tier name (e.g. 'Silver', 'Gold')
 */
export function showTierUpModal($wFn, tier) {
  try {
    const modal = $wFn('#tierUpModal');
    const text  = $wFn('#tierUpModalText');
    if (!modal || !text) return;
    text.text = TIER_UP_MESSAGES[tier] || `You've reached ${tier}!`;
    modal.show();
  } catch (err) {
    console.warn('[LoyaltyDashboard] showTierUpModal failed:', err?.message ?? err);
  }
}

// ── Burn rate ─────────────────────────────────────────────────────────

/**
 * Formats a burn-rate result into a human-readable pace message.
 * Exported for unit testing.
 *
 * @param {Object} burnRate - Result from getMyBurnRate
 * @returns {string} e.g. "At this pace, Free Shipping by Apr 15"
 */
export function formatBurnRateText(burnRate) {
  if (!burnRate || burnRate.status === 401) return '';
  if (burnRate.daysTill === 0 && burnRate.nearestRewardName) {
    return `You can redeem ${burnRate.nearestRewardName} now!`;
  }
  if (burnRate.projectedRewardDate && burnRate.nearestRewardName) {
    const d = new Date(burnRate.projectedRewardDate);
    const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const day   = d.getUTCDate();
    return `At this pace, ${burnRate.nearestRewardName} by ${month} ${day}`;
  }
  return '';
}

/**
 * Update the #burnRateText element with the member's projected reward date.
 * No-ops if the element does not exist on this page.
 *
 * @param {Function} $wFn
 * @param {Object} burnRate - Result from getMyBurnRate
 */
export function renderBurnRate($wFn, burnRate) {
  try {
    const el = $wFn('#burnRateText');
    if (!el) return;
    const text = formatBurnRateText(burnRate);
    if (text) {
      el.text = text;
      el.show();
    } else {
      el.hide();
    }
  } catch (err) {
    console.warn('[LoyaltyDashboard] renderBurnRate failed:', err?.message ?? err);
  }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Initialise the loyalty dashboard on the Member Page.
 * Fetches the current member's loyalty account, then updates the progress
 * bar, tier badge, and (if applicable) the tier-up modal.
 *
 * Call this inside $w.onReady() on the Member Page.
 *
 * @param {Object} [opts]
 * @param {Function} [opts.$w]                     - Injectable $w for testing
 * @param {Function} [opts.getMyLoyaltyAccount]    - Injectable backend call for testing
 * @param {Function} [opts.getMyBurnRate]          - Injectable backend call for testing
 * @param {Object}   [opts.storage]                - Injectable sessionStorage for testing
 * @returns {Promise<Object|null>} The account object, or null on error
 */
export async function initLoyaltyDashboard(opts = {}) {
  const $wFn        = get$w(opts);
  const getAcct     = getAccountFn(opts);
  const getBurnRate = getBurnRateFn(opts);
  const storage     = getStorage(opts);

  let account;
  try {
    account = await getAcct();
  } catch (err) {
    console.error('[LoyaltyDashboard] Failed to load account:', err?.message ?? err);
    return null;
  }

  renderProgressBar($wFn, account);
  renderTierBadge($wFn, account);
  checkTierUp($wFn, account, storage);

  // Burn rate — best-effort; never blocks the main render
  try {
    const burnRate = await getBurnRate();
    renderBurnRate($wFn, burnRate);
  } catch (_) {
    // silent — burn rate is ambient info, not critical path
  }

  // Birthday capture — show prompt if member hasn't added DOB yet
  if (account?.memberId) {
    initBirthdayCapture($wFn, account.memberId).catch(() => {});
  }

  return account;
}

// ── Birthday capture (CF-c5z6) ────────────────────────────────────────────────

/**
 * Show the birthday capture section if member has no DOB on file.
 * Wires #birthdaySaveButton to saveBirthday() and shows/hides the section.
 *
 * Required Wix Editor elements:
 *   #birthdayCaptureSection — container (collapsed by default)
 *   #birthdayMonthInput     — number input (1–12)
 *   #birthdayDayInput       — number input (1–31)
 *   #birthdaySaveButton     — button
 *   #birthdayCaptureMessage — text element for feedback
 *
 * @param {Function} $wFn - Wix element selector
 * @param {string} memberId
 * @returns {Promise<void>}
 */
export async function initBirthdayCapture($wFn, memberId) {
  try {
    // Skip if member already has a birthday on file
    const status = await getBirthdayStatus(memberId);
    if (status.hasBirthday) return;

    try { $wFn('#birthdayCaptureSection').expand(); } catch (_) { return; }
    try { $wFn('#birthdayCaptureMessage').text = 'Add your birthday for +50 bonus points!'; } catch (_) {}

    $wFn('#birthdaySaveButton').onClick(async () => {
      try { $wFn('#birthdaySaveButton').disable(); } catch (_) {}

      const month = parseInt($wFn('#birthdayMonthInput').value, 10);
      const day = parseInt($wFn('#birthdayDayInput').value, 10);

      const result = await saveBirthday(memberId, month, day);

      if (result.success && result.pointsAwarded > 0) {
        try { $wFn('#birthdayCaptureMessage').text = result.message; } catch (_) {}
        try { $wFn('#birthdaySaveButton').collapse(); } catch (_) {}
        try { $wFn('#birthdayMonthInput').disable(); } catch (_) {}
        try { $wFn('#birthdayDayInput').disable(); } catch (_) {}
      } else if (result.reason === 'already_set') {
        try { $wFn('#birthdayCaptureSection').collapse(); } catch (_) {}
      } else if (result.reason === 'invalid_month' || result.reason === 'invalid_day') {
        try { $wFn('#birthdayCaptureMessage').text = 'Please enter a valid birthday (month 1–12, day 1–31).'; } catch (_) {}
        try { $wFn('#birthdaySaveButton').enable(); } catch (_) {}
      } else if (!result.success && result.reason === 'error') {
        try { $wFn('#birthdayCaptureMessage').text = 'Something went wrong. Please try again.'; } catch (_) {}
        try { $wFn('#birthdaySaveButton').enable(); } catch (_) {}
      } else {
        try { $wFn('#birthdayCaptureMessage').text = result.message || 'Birthday saved!'; } catch (_) {}
        try { $wFn('#birthdaySaveButton').collapse(); } catch (_) {}
      }
    });
  } catch (err) {
    console.error('[LoyaltyDashboard] initBirthdayCapture failed:', err?.message);
  }
}
