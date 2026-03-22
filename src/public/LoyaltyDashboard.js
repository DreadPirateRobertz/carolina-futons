/**
 * @module LoyaltyDashboard
 * @description Velo frontend module for the loyalty tier progress bar,
 * tier badge, and animated tier-up milestone popup on the Member Page.
 *
 * Calls getMyLoyaltyAccount() once on page load, then updates:
 *   #loyaltyProgressBar  — Wix ProgressBar (.progress 0–100)
 *   #loyaltyTierBadge    — Text element showing icon + tier name
 *   #tierUpModal         — Container shown on tier-up milestone
 *   #tierUpModalText     — Text element inside the modal
 *
 * Tier-up detection uses sessionStorage so the popup fires only once per
 * browser session on the first visit after earning a new tier.
 *
 * CF-gkgv: Loyalty tier progress bar + milestone popups
 *
 * Editor nickname → element ID mapping (Member Page):
 *   loyaltyProgressBar → #loyaltyProgressBar
 *   loyaltyTierBadge   → #loyaltyTierBadge
 *   tierUpModal        → #tierUpModal
 *   tierUpModalText    → #tierUpModalText
 *
 * @example
 *   // In Member Page code (page file):
 *   import { initLoyaltyDashboard } from 'public/LoyaltyDashboard';
 *   $w.onReady(() => initLoyaltyDashboard());
 */
import { getMyLoyaltyAccount } from 'backend/loyaltyService.web';
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
 * Returns null if sessionStorage is unavailable (SSR / private browsing).
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

// ── Render helpers ────────────────────────────────────────────────────

/**
 * Update the #loyaltyProgressBar element.
 * Sets .progress (0–100) and .label to the human-readable progress text.
 * No-ops silently if the element does not exist on this page.
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
  } catch (_) { /* element may not exist on this page */ }
}

/**
 * Update the #loyaltyTierBadge text element.
 * Renders the tier icon + tier name; sets font color to the tier colour.
 * No-ops silently if the element does not exist on this page.
 *
 * @param {Function} $wFn
 * @param {Object} account - Loyalty account from getMyLoyaltyAccount
 */
export function renderTierBadge($wFn, account) {
  try {
    const badge = $wFn('#loyaltyTierBadge');
    if (!badge) return;
    const tier = account?.tier || 'Bronze';
    badge.text        = `${getTierIcon(account)} ${tier}`;
    badge.style.color = getTierColor(tier);
  } catch (_) { /* element may not exist on this page */ }
}

/**
 * Check whether the member has just crossed a tier threshold this session.
 * Compares the stored previous tier (sessionStorage) to the current tier.
 * On a tier-up, shows the #tierUpModal popup and updates the stored value.
 * Always updates the stored tier regardless of whether a tier-up occurred.
 *
 * @param {Function} $wFn
 * @param {Object} account - Loyalty account from getMyLoyaltyAccount
 * @param {Object|null} storage - sessionStorage-like object (or null)
 */
export function checkTierUp($wFn, account, storage) {
  const currentTier = account?.tier;
  if (!currentTier) return;

  if (!storage) {
    // No storage — can't detect tier-up; skip gracefully
    return;
  }

  let prevTier = null;
  try {
    prevTier = storage.getItem(TIER_KEY);
  } catch (_) {
    // getItem failed — can't determine previous tier; skip tier-up detection
    return;
  }

  // Persist current tier independently so a write failure (quota exceeded)
  // does not prevent a legitimate tier-up popup from showing.
  try {
    storage.setItem(TIER_KEY, currentTier);
  } catch (_) { /* storage write failed — non-fatal, popup still fires */ }

  if (!prevTier) return; // First visit — no previous tier to compare

  const prevIdx    = TIER_ORDER.indexOf(prevTier);
  const currentIdx = TIER_ORDER.indexOf(currentTier);

  if (currentIdx > prevIdx) {
    showTierUpModal($wFn, currentTier);
  }
}

/**
 * Show the tier-up celebration modal with the appropriate message.
 * No-ops silently if the modal elements do not exist on this page.
 *
 * @param {Function} $wFn
 * @param {string} tier - The new tier name ('Silver' or 'Gold')
 */
export function showTierUpModal($wFn, tier) {
  try {
    const modal = $wFn('#tierUpModal');
    const text  = $wFn('#tierUpModalText');
    if (!modal || !text) return;
    text.text = TIER_UP_MESSAGES[tier] || `You've reached ${tier}!`;
    modal.show();
  } catch (_) { /* elements may not exist on this page */ }
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
 * @param {Object}   [opts.storage]                - Injectable sessionStorage for testing
 * @returns {Promise<Object|null>} The account object, or null on error
 */
export async function initLoyaltyDashboard(opts = {}) {
  const $wFn     = get$w(opts);
  const getAcct  = getAccountFn(opts);
  const storage  = getStorage(opts);

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

  return account;
}
