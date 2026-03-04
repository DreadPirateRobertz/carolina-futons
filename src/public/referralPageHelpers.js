/**
 * @module referralPageHelpers
 * @description Pure helper functions for the Referral page. Handles formatting,
 * status mapping, share link generation, and data transformation for the
 * referral invite + rewards tracking interface.
 */
import { colors } from 'public/sharedTokens.js';

const BASE_URL = 'https://www.carolinafutons.com';
const REFERRER_CREDIT = 50;
const REFEREE_CREDIT = 25;

// ── Status Mappings ───────────────────────────────────────────────────

const STATUS_LABELS = {
  pending: 'Invite Sent',
  signed_up: 'Friend Joined',
  purchased: 'Purchase Made',
  processing: 'Processing',
  credited: 'Credit Earned',
  expired: 'Expired',
};

const STATUS_COLORS = {
  pending: colors.mountainBlue,
  signed_up: colors.sunsetCoral,
  purchased: colors.sunsetCoral,
  processing: colors.mountainBlue,
  credited: colors.success,
  expired: colors.muted,
};

// ── formatReferralLink ────────────────────────────────────────────────

/**
 * Build a shareable referral URL from a referral code.
 * @param {string} code - The referral code
 * @returns {string} Full referral URL or base URL if code is empty
 */
export function formatReferralLink(code) {
  if (!code) return BASE_URL;
  const clean = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return BASE_URL;
  return `${BASE_URL}?ref=${clean}`;
}

// ── formatCreditAmount ────────────────────────────────────────────────

/**
 * Format a credit amount as a dollar string.
 * @param {number} amount
 * @returns {string} Formatted amount (e.g. "$50" or "$25.50")
 */
export function formatCreditAmount(amount) {
  const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  const safe = Math.max(0, num);
  if (safe === Math.floor(safe)) return `$${safe}`;
  return `$${safe.toFixed(2)}`;
}

// ── getReferralStatusLabel ────────────────────────────────────────────

/**
 * Map a referral status code to a user-friendly label.
 * @param {string} status
 * @returns {string}
 */
export function getReferralStatusLabel(status) {
  return STATUS_LABELS[status] || 'Unknown';
}

// ── getReferralStatusColor ────────────────────────────────────────────

/**
 * Map a referral status to a design-token color.
 * @param {string} status
 * @returns {string} Hex color
 */
export function getReferralStatusColor(status) {
  return STATUS_COLORS[status] || colors.muted;
}

// ── getHowItWorksSteps ────────────────────────────────────────────────

/**
 * Return the "How It Works" steps data for the referral page repeater.
 * @returns {Array<{_id: string, title: string, description: string, icon: string}>}
 */
export function getHowItWorksSteps() {
  return [
    {
      _id: 'step-share',
      title: 'Share Your Link',
      description: 'Copy your personal referral link and share it with friends, family, or anyone who deserves handcrafted mountain comfort.',
      icon: 'share',
    },
    {
      _id: 'step-friend',
      title: 'Friend Makes a Purchase',
      description: `When your friend shops with us using your link, they get a $${REFEREE_CREDIT} credit on their first order.`,
      icon: 'cart',
    },
    {
      _id: 'step-earn',
      title: 'You Both Earn Rewards',
      description: `Once their order ships, you earn a $${REFERRER_CREDIT} credit toward your next purchase. Sharing comfort pays off!`,
      icon: 'gift',
    },
  ];
}

// ── getSocialShareLinks ───────────────────────────────────────────────

/**
 * Generate social sharing URLs for a referral code.
 * @param {string} code - Referral code
 * @returns {{email?: string, sms?: string, facebook?: string}}
 */
export function getSocialShareLinks(code) {
  if (!code) return {};
  const clean = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return {};

  const referralUrl = formatReferralLink(clean);
  const subject = encodeURIComponent('Check out Carolina Futons!');
  const emailBody = encodeURIComponent(
    `I love my furniture from Carolina Futons — handcrafted comfort at mountain-town prices. ` +
    `Use my referral link and get $${REFEREE_CREDIT} off your first order: ${referralUrl}`
  );
  const smsBody = encodeURIComponent(
    `Hey! Check out Carolina Futons. Use my link for $${REFEREE_CREDIT} off: ${referralUrl}`
  );

  return {
    email: `mailto:?subject=${subject}&body=${emailBody}`,
    sms: `sms:?body=${smsBody}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`,
  };
}

// ── calculateReferralProgress ─────────────────────────────────────────

/**
 * Derive progress/summary data from raw referral stats.
 * @param {Object} stats - Stats from getReferralStats()
 * @returns {{totalFriends: number, successRate: number, totalEarned: number, availableCredit: number}}
 */
export function calculateReferralProgress(stats) {
  if (!stats) {
    return { totalFriends: 0, successRate: 0, totalEarned: 0, availableCredit: 0 };
  }

  const total = stats.totalReferrals || 0;
  const completed = stats.completedReferrals || 0;
  const rate = total > 0 ? Math.floor((completed / total) * 100) : 0;

  return {
    totalFriends: total,
    successRate: rate,
    totalEarned: stats.totalEarned || 0,
    availableCredit: stats.totalAvailable || 0,
  };
}

// ── formatExpiryDate ──────────────────────────────────────────────────

/**
 * Format a credit expiry date to a readable string.
 * @param {Date|string} date
 * @returns {string}
 */
export function formatExpiryDate(date) {
  if (!date) return 'No expiry';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'No expiry';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── buildReferralHistoryItems ─────────────────────────────────────────

/**
 * Transform raw referral data into repeater-ready items.
 * @param {Array} referrals - Array from getMyReferrals()
 * @returns {Array<{_id: string, friendName: string, statusLabel: string, statusColor: string, creditText: string, dateText: string}>}
 */
export function buildReferralHistoryItems(referrals) {
  if (!referrals || !Array.isArray(referrals)) return [];

  return referrals.map((r, i) => ({
    _id: `ref-${i}-${r.code || i}`,
    friendName: r.refereeName || 'Awaiting friend',
    statusLabel: getReferralStatusLabel(r.status),
    statusColor: getReferralStatusColor(r.status),
    creditText: formatCreditAmount(r.credit),
    dateText: formatExpiryDate(r.createdDate),
    code: r.code || '',
  }));
}
