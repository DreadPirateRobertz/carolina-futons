/**
 * @module referralUI
 * @description Public-facing referral program UI helpers.
 * Handles HTTP calls to referral endpoints, share URL construction,
 * clipboard operations, and page/widget initialisation.
 */
import { fetch } from 'wix-fetch';

const ENDPOINT = '/_functions/generateReferralLink';

// Domains whose share-URL parameter must match (open-redirect guard)
const ALLOWED_SHARE_HOSTS = ['carolinafutons.com', 'www.carolinafutons.com'];

// ── fetchReferralLink ─────────────────────────────────────────────────

/**
 * Call GET /_functions/generateReferralLink and return { referralCode, shareUrl, stats }.
 * Throws on any non-OK HTTP response or network failure.
 */
export async function fetchReferralLink() {
  const response = await fetch(ENDPOINT, { method: 'GET' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ── buildShareUrls ────────────────────────────────────────────────────

/**
 * Build platform share URLs for a validated referral shareUrl.
 * Throws if shareUrl is not from an approved domain (open-redirect guard).
 *
 * @param {string} shareUrl - Full referral URL (must be https://carolinafutons.com/…)
 * @returns {{ facebook: string, twitter: string, sms: string }}
 */
export function buildShareUrls(shareUrl) {
  if (!shareUrl || typeof shareUrl !== 'string') {
    throw new Error('shareUrl is required');
  }

  let parsed;
  try {
    parsed = new URL(shareUrl);
  } catch (_) {
    throw new Error('shareUrl is not a valid URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('shareUrl must use https');
  }

  if (!ALLOWED_SHARE_HOSTS.includes(parsed.hostname)) {
    throw new Error(`shareUrl hostname not allowed: ${parsed.hostname}`);
  }

  const encoded = encodeURIComponent(shareUrl);
  const message = encodeURIComponent(
    `Check out Carolina Futons — get $25 off your first order: ${shareUrl}`
  );

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    twitter: `https://twitter.com/intent/tweet?url=${encoded}&text=${message}`,
    sms: `sms:?body=${message}`,
  };
}

// ── copyToClipboard ───────────────────────────────────────────────────

/**
 * Copy text to clipboard using the Clipboard API.
 * Returns true on success, false if unavailable or permission denied.
 *
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    if (!navigator?.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

// ── formatStats ───────────────────────────────────────────────────────

/**
 * Format raw stats from the endpoint into display strings.
 *
 * @param {{ totalReferrals?: number, pendingRewards?: number, earnedRewards?: number }|null} stats
 * @returns {{ totalReferrals: string, pendingRewards: string, earnedRewards: string }}
 */
export function formatStats(stats) {
  const s = stats || {};
  return {
    totalReferrals: String(s.totalReferrals ?? 0),
    pendingRewards: _formatDollars(s.pendingRewards ?? 0),
    earnedRewards: _formatDollars(s.earnedRewards ?? 0),
  };
}

function _formatDollars(amount) {
  const n = typeof amount === 'number' && !isNaN(amount) ? Math.max(0, amount) : 0;
  return n === Math.floor(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

// ── initReferralPage ──────────────────────────────────────────────────

/**
 * Wire up the referral share page.
 * Expected elements: #referralLink, #loadingState, #errorState, #copyBtn, #shareButtons
 *
 * @param {Function} $w - Wix element selector
 */
export async function initReferralPage($w) {
  try {
    const data = await fetchReferralLink();
    $w('#referralLink').setText(data.shareUrl || data.referralCode || '');
    $w('#loadingState').hide();
    $w('#shareButtons').show();

    $w('#copyBtn').onClick(async () => {
      await copyToClipboard(data.shareUrl || '');
    });
  } catch (_) {
    $w('#loadingState').hide();
    $w('#errorState').show();
  }
}

// ── initPostCheckoutReferralWidget ────────────────────────────────────

/**
 * Show a small referral invite block on the thank-you page.
 * Silently hides if not authenticated or on any error (non-critical UI).
 *
 * @param {Function} $w - Wix element selector
 */
export async function initPostCheckoutReferralWidget($w) {
  try {
    const data = await fetchReferralLink();
    $w('#referralLink').setText(data.shareUrl || '');
    $w('#referralWidget').show();
  } catch (_) {
    // Non-critical — don't show widget if unauthenticated or errored
  }
}

// ── initReferralDashboard ─────────────────────────────────────────────

/**
 * Populate the account dashboard stats panel.
 * Expected elements: #totalReferrals, #pendingRewards, #earnedRewards, #dashboardError
 *
 * @param {Function} $w - Wix element selector
 */
export async function initReferralDashboard($w) {
  try {
    const data = await fetchReferralLink();
    const stats = formatStats(data.stats || {});
    $w('#totalReferrals').setText(stats.totalReferrals);
    $w('#pendingRewards').setText(stats.pendingRewards);
    $w('#earnedRewards').setText(stats.earnedRewards);
  } catch (_) {
    $w('#dashboardError').show();
  }
}
